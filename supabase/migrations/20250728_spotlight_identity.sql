-- Vista ampliada del anfitrión (ejecutar una vez en Supabase SQL Editor)
alter table public.sessions
  add column if not exists spotlight_identity text;
