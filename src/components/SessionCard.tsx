"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import InviteCodeShare from "@/components/InviteCodeShare";
import { isImmediateSession, wasSessionCancelled, type Session } from "@/lib/types";

const STATUS_LABEL: Record<Session["status"], { text: string; cls: string }> = {
  scheduled: { text: "Programada", cls: "bg-zinc-800 text-zinc-300" },
  live: { text: "● En vivo", cls: "bg-rose-500/15 text-rose-400" },
  ended: { text: "Finalizada", cls: "bg-zinc-800 text-zinc-500" },
};

function sessionStatusLabel(session: Session) {
  if (wasSessionCancelled(session)) {
    return { text: "Cancelada", cls: "bg-zinc-800 text-zinc-500" };
  }
  return STATUS_LABEL[session.status];
}

export default function SessionCard({ session }: { session: Session }) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const status = sessionStatusLabel(session);

  async function closeSession() {
    const isLive = session.status === "live";
    const message = isLive
      ? "¿Cerrar la sesión en vivo? Todos los participantes serán desconectados."
      : "¿Cancelar esta sesión? El enlace de invitación dejará de funcionar.";

    if (!confirm(message)) return;

    setClosing(true);
    try {
      const res = await fetch("/api/host/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end_session", sessionId: session.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo cerrar la sesión");
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="font-semibold">{session.title}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>
              {status.text}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {isImmediateSession(session)
              ? "Sesión inmediata — lista para empezar"
              : new Date(session.scheduled_at).toLocaleString("es", {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">
            {session.mute_on_entry ? "Invitados entran muteados" : "Micrófonos libres"}
            {session.require_approval ? " · Ingreso con aprobación" : ""}
          </p>
        </div>

        {session.status !== "ended" && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              onClick={() => window.location.assign(`/room/${session.invite_code}`)}
              className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 transition-colors"
            >
              {session.status === "live" ? "Volver a entrar" : "Iniciar"}
            </button>
            <button
              onClick={closeSession}
              disabled={closing}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 transition-colors disabled:opacity-60"
            >
              {closing
                ? "Cerrando…"
                : session.status === "live"
                  ? "Cerrar sesión"
                  : "Cancelar"}
            </button>
          </div>
        )}
      </div>

      {session.status !== "ended" && (
        <InviteCodeShare inviteCode={session.invite_code} variant="inline" />
      )}
    </div>
  );
}
