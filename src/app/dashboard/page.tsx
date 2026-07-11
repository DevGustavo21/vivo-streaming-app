import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import CreateSessionForm from "@/components/CreateSessionForm";
import SessionCard from "@/components/SessionCard";
import type { Session } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) redirect("/?login=1");

  const [{ data: profile }, { data: sessions }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("sessions")
      .select("*")
      .eq("host_id", user.id)
      .order("scheduled_at", { ascending: false }),
  ]);

  const list = (sessions ?? []) as Session[];
  const upcoming = list.filter((s) => s.status !== "ended");
  const past = list.filter((s) => s.status === "ended");

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500 text-sm font-bold">
            V
          </span>
          <span className="text-lg font-semibold tracking-tight">Vivo</span>
        </Link>
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          {profile?.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-8 w-8 rounded-full"
              referrerPolicy="no-referrer"
            />
          )}
          {profile?.display_name}
        </div>
      </header>

      <section>
        <h1 className="text-2xl font-bold tracking-tight">Nueva sesión</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Empieza al instante o programa tu evento y comparte el enlace con tus
          invitados (hasta 50).
        </p>
        <div className="mt-6">
          <CreateSessionForm />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Próximas y en vivo</h2>
        <div className="mt-4 flex flex-col gap-3">
          {upcoming.length === 0 && (
            <p className="text-sm text-zinc-500">
              Todavía no tienes sesiones programadas.
            </p>
          )}
          {upcoming.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      </section>

      {past.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-zinc-400">Finalizadas y canceladas</h2>
          <div className="mt-4 flex flex-col gap-3 opacity-60">
            {past.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
