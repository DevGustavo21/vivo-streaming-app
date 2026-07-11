"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mic, MicOff, UserX, X } from "lucide-react";
import { initialsOf, type Participant, type Session } from "@/lib/types";

/**
 * Panel de control del anfitrión:
 * - Aceptar/rechazar solicitudes de ingreso (sala de espera)
 * - Habilitar/silenciar micrófonos (mute duro a nivel servidor)
 * - Expulsar participantes
 */
export default function HostPanel({
  session,
  onClose,
}: {
  session: Session;
  onClose: () => void;
}) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());

  const load = useCallback(async () => {
    const { data } = await supabaseRef.current
      .from("participants")
      .select("*, profiles(display_name, avatar_url, is_anonymous)")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });
    if (data) setParticipants(data as Participant[]);
  }, [session.id]);

  useEffect(() => {
    load();
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`participants:${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${session.id}`,
        },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.id, load]);

  async function control(action: string, participantId: string) {
    setBusy(participantId + action);
    try {
      await fetch("/api/host/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sessionId: session.id, participantId }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  const pending = participants.filter((p) => p.admission === "pending");
  const approved = participants.filter((p) => p.admission === "approved");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="font-semibold">
          Participantes{" "}
          <span className="text-sm font-normal text-zinc-500">
            {approved.length}/{session.max_guests}
          </span>
        </h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800"
          aria-label="Cerrar panel"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {pending.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-400">
              Esperando aprobación ({pending.length})
            </h3>
            <ul className="flex flex-col gap-2">
              {pending.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"
                >
                  <Avatar participant={p} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {p.profiles?.display_name ?? "Invitado"}
                  </span>
                  <button
                    onClick={() => control("approve", p.id)}
                    disabled={busy !== null}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => control("reject", p.id)}
                    disabled={busy !== null}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium hover:bg-zinc-700 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            En la sala ({approved.length})
          </h3>
          {approved.length === 0 && (
            <p className="text-sm text-zinc-600">
              Todavía no hay invitados. Comparte el enlace de invitación.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {approved.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3"
              >
                <Avatar participant={p} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {p.profiles?.display_name ?? "Invitado"}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-zinc-500">
                    {p.can_publish_audio ? (
                      <>
                        <Mic className="h-3 w-3" /> Puede hablar
                      </>
                    ) : (
                      <>
                        <MicOff className="h-3 w-3" /> En silencio
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={() =>
                    control(p.can_publish_audio ? "disable_mic" : "enable_mic", p.id)
                  }
                  disabled={busy !== null}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    p.can_publish_audio
                      ? "bg-zinc-800 hover:bg-zinc-700"
                      : "bg-rose-500 text-white hover:bg-rose-400"
                  }`}
                >
                  {p.can_publish_audio ? "Silenciar" : "Dar voz"}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Expulsar a ${p.profiles?.display_name ?? "este invitado"}?`))
                      control("kick", p.id);
                  }}
                  disabled={busy !== null}
                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-rose-400 disabled:opacity-50"
                  title="Expulsar"
                  aria-label="Expulsar"
                >
                  <UserX className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Avatar({ participant }: { participant: Participant }) {
  const name = participant.profiles?.display_name ?? "Invitado";
  const url = participant.profiles?.avatar_url;
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        className="h-8 w-8 shrink-0 rounded-full"
      />
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-xs font-bold text-rose-300">
      {initialsOf(name)}
    </span>
  );
}
