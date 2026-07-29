"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mic, MicOff, Maximize2, Minimize2, UserX, X } from "lucide-react";
import { initialsOf, type Participant, type Profile, type Session } from "@/lib/types";

/**
 * Panel de control del anfitrión:
 * - Aceptar/rechazar solicitudes de ingreso (sala de espera)
 * - Habilitar/silenciar micrófonos (mute duro a nivel servidor)
 * - Vista ampliada de un participante para todos
 * - Expulsar participantes
 */
export default function HostPanel({
  session,
  onClose,
  onSessionUpdated,
}: {
  session: Session;
  onClose: () => void;
  onSessionUpdated: (patch: Partial<Session>) => void;
}) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [hostProfile, setHostProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());

  const load = useCallback(async () => {
    const { data } = await supabaseRef.current
      .from("participants")
      .select("*, profiles(display_name, avatar_url, is_anonymous)")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });
    if (data) setParticipants(data as Participant[]);

    const { data: host } = await supabaseRef.current
      .from("profiles")
      .select("*")
      .eq("id", session.host_id)
      .single();
    if (host) setHostProfile(host as Profile);
  }, [session.id, session.host_id]);

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

  async function setSpotlight(identity: string | null) {
    setBusy("spotlight");
    try {
      const res = await fetch("/api/host/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_spotlight",
          sessionId: session.id,
          spotlightIdentity: identity,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "No se pudo cambiar la vista ampliada");
        return;
      }
      if (data.session) {
        onSessionUpdated(data.session as Session);
      } else {
        onSessionUpdated({ spotlight_identity: identity });
      }
    } finally {
      setBusy(null);
    }
  }

  const spotlightId = session.spotlight_identity ?? null;

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
        {spotlightId && (
          <section className="mb-6 rounded-xl border border-rose-500/25 bg-rose-500/5 p-3">
            <p className="text-xs text-zinc-400">
              Vista ampliada activa para un participante. Todos ven esa cámara en grande.
            </p>
            <button
              type="button"
              onClick={() => setSpotlight(null)}
              disabled={busy !== null}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold hover:bg-zinc-700 disabled:opacity-50"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Volver al grid normal
            </button>
          </section>
        )}

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
            En la sala ({approved.length + 1})
          </h3>
          <ul className="flex flex-col gap-2">
            <li className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-zinc-900 p-3">
              <HostAvatar profile={hostProfile} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {hostProfile?.display_name ?? "Anfitrión"}
                  <span className="text-zinc-500"> · Tú</span>
                </p>
                <p className="text-xs text-amber-400/90">Anfitrión</p>
              </div>
              <SpotlightButton
                active={spotlightId === session.host_id}
                disabled={busy !== null}
                onClick={() =>
                  setSpotlight(spotlightId === session.host_id ? null : session.host_id)
                }
              />
            </li>
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
                <SpotlightButton
                  active={spotlightId === p.profile_id}
                  disabled={busy !== null}
                  onClick={() =>
                    setSpotlight(spotlightId === p.profile_id ? null : p.profile_id)
                  }
                />
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
          {approved.length === 0 && (
            <p className="mt-2 text-sm text-zinc-600">
              Todavía no hay invitados. Comparte el enlace de invitación.
            </p>
          )}
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

function HostAvatar({ profile }: { profile: Profile | null }) {
  const name = profile?.display_name ?? "Anfitrión";
  const url = profile?.avatar_url;
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
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-200">
      {initialsOf(name)}
    </span>
  );
}

function SpotlightButton({
  active,
  disabled,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={active ? "Quitar vista ampliada" : "Ver en grande para todos"}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
        active
          ? "bg-rose-500 text-white hover:bg-rose-400"
          : "bg-zinc-800 hover:bg-zinc-700"
      }`}
    >
      {active ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </button>
  );
}
