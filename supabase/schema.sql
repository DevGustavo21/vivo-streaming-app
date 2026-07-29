-- ============================================================
-- Plataforma de videollamadas para eventos en vivo
-- Esquema de base de datos para Supabase (Postgres)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- PERFILES: extiende auth.users (Google OAuth y anónimos)
-- ------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default 'Invitado',
  avatar_url    text,
  is_anonymous  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, is_anonymous)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      'Invitado'
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.is_anonymous, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- SESIONES (eventos)
-- ------------------------------------------------------------
create table public.sessions (
  id               uuid primary key default gen_random_uuid(),
  host_id          uuid not null references public.profiles (id) on delete cascade,
  title            text not null,
  scheduled_at     timestamptz not null,
  invite_code      text not null unique,
  mute_on_entry    boolean not null default true,
  require_approval boolean not null default false,
  max_guests       int not null default 50 check (max_guests between 1 and 50),
  status           text not null default 'scheduled'
                     check (status in ('scheduled', 'live', 'ended')),
  started_at       timestamptz,
  ended_at         timestamptz,
  created_at       timestamptz not null default now(),
  spotlight_identity text
);

create index sessions_host_idx on public.sessions (host_id);
create index sessions_invite_code_idx on public.sessions (invite_code);

-- ------------------------------------------------------------
-- PARTICIPANTES
-- ------------------------------------------------------------
create table public.participants (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.sessions (id) on delete cascade,
  profile_id         uuid not null references public.profiles (id) on delete cascade,
  role               text not null default 'guest' check (role in ('host', 'guest')),
  admission          text not null default 'pending'
                       check (admission in ('pending', 'approved', 'rejected', 'kicked')),
  can_publish_audio  boolean not null default false,
  joined_at          timestamptz,
  left_at            timestamptz,
  created_at         timestamptz not null default now(),
  unique (session_id, profile_id)
);

create index participants_session_idx on public.participants (session_id);

-- ------------------------------------------------------------
-- MENSAJES DE CHAT
-- ------------------------------------------------------------
create table public.chat_messages (
  id           bigint generated always as identity primary key,
  session_id   uuid not null references public.sessions (id) on delete cascade,
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  sender_name  text not null,
  body         text not null check (char_length(body) between 1 and 1000),
  created_at   timestamptz not null default now()
);

create index chat_messages_session_idx on public.chat_messages (session_id, created_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.sessions      enable row level security;
alter table public.participants  enable row level security;
alter table public.chat_messages enable row level security;

-- Helper: ¿el usuario actual es participante aprobado de la sesión?
create or replace function public.is_approved_participant(p_session_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.participants
    where session_id = p_session_id
      and profile_id = auth.uid()
      and admission = 'approved'
  );
$$;

-- Helper: ¿el usuario actual es el host de la sesión?
create or replace function public.is_session_host(p_session_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.sessions
    where id = p_session_id and host_id = auth.uid()
  );
$$;

-- PROFILES ---------------------------------------------------
create policy "profiles: lectura para autenticados"
  on public.profiles for select to authenticated using (true);

create policy "profiles: cada quien actualiza el suyo"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- SESSIONS ---------------------------------------------------
-- Cualquiera autenticado puede leer una sesión (necesario para
-- ver el título en la página de invitación por invite_code).
create policy "sessions: lectura para autenticados"
  on public.sessions for select to authenticated using (true);

-- Solo usuarios NO anónimos crean sesiones
create policy "sessions: crear solo con cuenta real"
  on public.sessions for insert to authenticated
  with check (
    host_id = auth.uid()
    and (select coalesce(is_anonymous, false) from public.profiles where id = auth.uid()) = false
  );

create policy "sessions: solo el host modifica"
  on public.sessions for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());

create policy "sessions: solo el host elimina"
  on public.sessions for delete to authenticated
  using (host_id = auth.uid());

-- PARTICIPANTS -----------------------------------------------
create policy "participants: leen host y miembros de la sesión"
  on public.participants for select to authenticated
  using (
    profile_id = auth.uid()
    or public.is_session_host(session_id)
    or public.is_approved_participant(session_id)
  );

-- El usuario se registra a sí mismo como pendiente/invitado.
-- La aprobación y el control de audio los gestiona el backend
-- (service role) o el host vía política de update.
create policy "participants: auto-registro"
  on public.participants for insert to authenticated
  with check (profile_id = auth.uid() and role = 'guest');

create policy "participants: solo el host actualiza"
  on public.participants for update to authenticated
  using (public.is_session_host(session_id))
  with check (public.is_session_host(session_id));

-- CHAT -------------------------------------------------------
create policy "chat: leen participantes aprobados y host"
  on public.chat_messages for select to authenticated
  using (
    public.is_approved_participant(session_id)
    or public.is_session_host(session_id)
  );

create policy "chat: escriben participantes aprobados y host"
  on public.chat_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_approved_participant(session_id)
      or public.is_session_host(session_id)
    )
  );

-- ============================================================
-- REALTIME: publicar cambios de estas tablas
-- ============================================================
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.sessions;
