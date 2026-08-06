import { createAdminClient } from "@/lib/supabase/server";
import JoinFlow from "@/components/join/JoinFlow";
import Link from "next/link";
import { resolveInviteCodeParam } from "@/lib/invite";
import { redirect } from "next/navigation";
import type { Session } from "@/lib/types";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = resolveInviteCodeParam(rawCode);

  if (rawCode !== code) {
    redirect(`/join/${code}`);
  }

  // Lectura con service role: el invitado aún no está autenticado
  // y necesita ver el título del evento antes de entrar.
  const admin = createAdminClient();
  const { data } = await admin
    .from("sessions")
    .select("id, title, scheduled_at, created_at, status, invite_code, mute_on_entry, require_approval, host_id, max_guests")
    .eq("invite_code", code)
    .single();

  const session = data as Session | null;

  if (!session) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold">Invitación no encontrada</h1>
        <p className="mt-2 text-zinc-400">
          Revisa que el enlace esté completo o pide uno nuevo al anfitrión.
        </p>
        <Link href="/" className="mt-6 text-sm text-rose-400 hover:underline">
          Ir al inicio
        </Link>
      </main>
    );
  }

  if (session.status === "ended") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold">{session.title}</h1>
        <p className="mt-2 text-zinc-400">Este evento ya finalizó. ¡Gracias por acompañarnos!</p>
        <Link href="/" className="mt-6 text-sm text-rose-400 hover:underline">
          Ir al inicio
        </Link>
      </main>
    );
  }

  return <JoinFlow session={session} />;
}
