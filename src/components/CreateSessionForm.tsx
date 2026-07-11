"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InviteCodeShare from "@/components/InviteCodeShare";
import type { Session } from "@/lib/types";

type Mode = "now" | "scheduled";

export default function CreateSessionForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("now");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [muteOnEntry, setMuteOnEntry] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSession, setCreatedSession] = useState<Session | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCreatedSession(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startNow: mode === "now",
          scheduledAt: mode === "scheduled" ? scheduledAt : undefined,
          muteOnEntry,
          requireApproval,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear la sesión");

      const session = data.session as Session;
      setTitle("");
      setScheduledAt("");

      if (mode === "now" && session?.invite_code) {
        sessionStorage.setItem(
          `prejoin:${session.invite_code}`,
          JSON.stringify({ camOn: false, mediaGranted: false })
        );
        sessionStorage.setItem(`showInvite:${session.invite_code}`, "1");
        window.location.assign(`/room/${session.invite_code}`);
        return;
      }

      if (session) {
        setCreatedSession(session);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  if (createdSession) {
    return (
      <div className="flex flex-col gap-4">
        <InviteCodeShare inviteCode={createdSession.invite_code} variant="card" />
        <button
          type="button"
          onClick={() => setCreatedSession(null)}
          className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          Crear otra sesión
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("now")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "now"
              ? "bg-rose-500 text-white"
              : "border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
          }`}
        >
          Empezar ahora
        </button>
        <button
          type="button"
          onClick={() => setMode("scheduled")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "scheduled"
              ? "bg-rose-500 text-white"
              : "border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
          }`}
        >
          Programar
        </button>
      </div>

      <div className={`mt-5 grid gap-4 ${mode === "scheduled" ? "sm:grid-cols-2" : ""}`}>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Título del evento</span>
          <input
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Boda de Ana y Luis, Graduación 2026…"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
          />
        </label>
        {mode === "scheduled" && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Fecha y hora</span>
            <input
              required
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-zinc-300 focus:border-rose-500 focus:outline-none [color-scheme:dark]"
            />
          </label>
        )}
      </div>

      {mode === "now" && (
        <p className="mt-3 text-sm text-zinc-500">
          Al crear la sesión entrarás de inmediato y podrás copiar el código de
          invitación desde la llamada.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={muteOnEntry}
            onChange={(e) => setMuteOnEntry(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-rose-500"
          />
          <span>
            <span className="font-medium">Todos entran muteados</span>
            <span className="block text-zinc-500">
              Los invitados no podrán activar su micrófono hasta que tú lo
              habilites desde el panel.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={requireApproval}
            onChange={(e) => setRequireApproval(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-rose-500"
          />
          <span>
            <span className="font-medium">Aprobar ingreso manualmente</span>
            <span className="block text-zinc-500">
              Cada invitado espera en la sala hasta que lo aceptes.
            </span>
          </span>
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 rounded-xl bg-rose-500 px-6 py-3 font-semibold text-white hover:bg-rose-400 transition-colors disabled:opacity-60"
      >
        {loading
          ? "Creando…"
          : mode === "now"
            ? "Crear e iniciar sesión"
            : "Programar sesión"}
      </button>
    </form>
  );
}
