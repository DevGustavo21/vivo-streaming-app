import { createClient } from "@/lib/supabase/server";
import LandingActions from "@/components/LandingActions";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hasRealAccount = Boolean(user && !user.is_anonymous);

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500 text-sm font-bold">
            V
          </span>
          <span className="text-lg font-semibold tracking-tight">Vivo</span>
        </div>
        {hasRealAccount && (
          <Link
            href="/dashboard"
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-700 transition-colors"
          >
            Mis sesiones
          </Link>
        )}
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          Transmite tu evento en vivo,{" "}
          <span className="text-rose-400">sin límite de tiempo</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-zinc-400">
          Bodas, graduaciones, cumpleaños, conferencias. Invita a quienes no
          pueden asistir con un solo enlace. Tú decides quién habla y cuándo.
        </p>

        <LandingActions hasRealAccount={hasRealAccount} />

        <div className="mt-20 grid max-w-4xl grid-cols-1 gap-6 text-left sm:grid-cols-3">
          {[
            {
              title: "Duración ilimitada",
              body: "Sin cortes a los 40 minutos. Tu evento dura lo que tenga que durar.",
            },
            {
              title: "Silencio bajo tu control",
              body: "Todos entran muteados si así lo decides. Tú habilitas los micrófonos.",
            },
            {
              title: "Entrar es trivial",
              body: "Tus invitados solo escriben su nombre. Sin cuentas, sin descargas.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
            >
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
