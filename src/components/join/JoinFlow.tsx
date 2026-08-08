"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  initialsOf,
  isImmediateSession,
  type Participant,
  type Session,
} from "@/lib/types";
import type { User } from "@supabase/supabase-js";
import { SwitchCamera } from "lucide-react";
import {
  DEFAULT_VIDEO_CAPTURE,
  localPreviewNeedsUnmirror,
  type CameraFacing,
} from "@/lib/camera";
import { getLocalMirrorPreference } from "@/lib/video-display";

type Step = "loading" | "auth" | "lobby" | "waiting" | "rejected" | "full";

/**
 * Flujo de ingreso del invitado:
 * 1. auth    — modo invitado: solo el nombre (sin Google, el link ya es la credencial)
 * 2. lobby   — preview de cámara/micrófono con permisos explícitos
 * 3. waiting — sala de espera si el host exige aprobación
 * → redirige a /room/{code} cuando está aprobado
 */
export default function JoinFlow({ session }: { session: Session }) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [guestName, setGuestName] = useState("");
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // --- Preview de medios (lobby) ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [mediaAsked, setMediaAsked] = useState(false);
  const [mediaDenied, setMediaDenied] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacing>("user");
  const [localMirrorMode, setLocalMirrorMode] = useState(
    () => getLocalMirrorPreference()
  );

  const lobbyUnMirror = localPreviewNeedsUnmirror(facingMode, localMirrorMode);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;

      const currentUser = data.user;
      setUser(currentUser);

      if (!currentUser) {
        setStep("auth");
        return;
      }

      // El anfitrión entra directo a la sala, sin pasar por el lobby de invitados
      if (currentUser.id === session.host_id) {
        setIsHost(true);
        sessionStorage.setItem(
          `prejoin:${session.invite_code}`,
          JSON.stringify({ camOn: false, mediaGranted: false })
        );
        window.location.assign(`/room/${session.invite_code}`);
        return;
      }

      setStep("lobby");
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpieza del stream al desmontar
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function signInAsGuest(e: React.FormEvent) {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) return;

    setError(null);
    setAuthLoading(true);

    try {
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(payload.error ?? "No se pudo crear tu acceso de invitado.");
        return;
      }

      const { data: verify } = await supabase.auth.getUser();
      if (!verify.user) {
        setError(
          "Tu navegador bloqueó la sesión. Abre el enlace en una ventana normal (sin modo incógnito) e inténtalo de nuevo."
        );
        return;
      }

      setUser(verify.user);
      setStep("lobby");
    } finally {
      setAuthLoading(false);
    }
  }

  async function requestMedia() {
    setMediaAsked(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: DEFAULT_VIDEO_CAPTURE.facingMode ?? "user" } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setFacingMode("user");
      setCamOn(true);
      setMediaDenied(false);
    } catch {
      setMediaDenied(true);
      setCamOn(false);
    }
  }

  async function flipLobbyCamera() {
    const stream = streamRef.current;
    if (!stream || !camOn) return;
    const next: CameraFacing = facingMode === "environment" ? "user" : "environment";
    const audioTracks = stream.getAudioTracks();
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: next } },
      });
      stream.getVideoTracks().forEach((t) => {
        stream.removeTrack(t);
        t.stop();
      });
      const newVideo = videoStream.getVideoTracks()[0];
      if (newVideo) stream.addTrack(newVideo);
      audioTracks.forEach((t) => {
        if (!stream.getAudioTracks().includes(t)) stream.addTrack(t);
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setFacingMode(next);
    } catch {
      setError("No se pudo cambiar a la otra cámara.");
    }
  }

  function toggleCam() {
    const stream = streamRef.current;
    if (!stream) return;
    const next = !camOn;
    stream.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
  }

  const enterRoom = useCallback(() => {
    // El room reutiliza estas preferencias del lobby
    sessionStorage.setItem(
      `prejoin:${session.invite_code}`,
      JSON.stringify({ camOn, mediaGranted: !mediaDenied && mediaAsked })
    );
    streamRef.current?.getTracks().forEach((t) => t.stop());
    router.push(`/room/${session.invite_code}`);
  }, [camOn, mediaAsked, mediaDenied, router, session.invite_code]);

  async function join() {
    setError(null);
    const res = await fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: session.invite_code }),
    });
    const data = await res.json();

    if (res.status === 409) return setStep("full");
    if (res.status === 403) return setStep("rejected");
    if (!res.ok) return setError(data.error ?? "No se pudo entrar a la sesión");

    setIsHost(Boolean(data.isHost));
    setParticipant(data.participant);

    if (data.isHost || data.participant?.admission === "approved") {
      enterRoom();
    } else {
      setStep("waiting");
    }
  }

  // Sala de espera: escucha en tiempo real la decisión del host
  useEffect(() => {
    if (step !== "waiting" || !participant) return;

    const channel = supabase
      .channel(`admission:${participant.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "participants",
          filter: `id=eq.${participant.id}`,
        },
        (payload) => {
          const admission = (payload.new as Participant).admission;
          if (admission === "approved") enterRoom();
          if (admission === "rejected") setStep("rejected");
        }
      )
      .subscribe();

    // Respaldo por si el evento realtime se pierde
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("participants")
        .select("admission")
        .eq("id", participant.id)
        .single();
      if (data?.admission === "approved") enterRoom();
      if (data?.admission === "rejected") setStep("rejected");
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, participant, enterRoom]);

  const displayName =
    user?.user_metadata?.display_name ??
    user?.user_metadata?.full_name ??
    guestName ??
    "Invitado";

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <p className="text-center text-sm font-medium uppercase tracking-widest text-rose-400">
          Estás invitado a
        </p>
        <h1 className="mt-1 text-center text-3xl font-bold tracking-tight">
          {session.title}
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-400">
          {isImmediateSession(session)
            ? "El evento está por comenzar"
            : new Date(session.scheduled_at).toLocaleString("es", {
                dateStyle: "full",
                timeStyle: "short",
              })}
        </p>

        {/* PASO 1: elegir identidad */}
        {step === "auth" && (
          <div className="mt-10 flex flex-col gap-4">
            <p className="text-center text-sm text-zinc-400">
              Escribe tu nombre para entrar
            </p>
            <form onSubmit={signInAsGuest} className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Tu nombre"
                  maxLength={50}
                  required
                  disabled={authLoading}
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={authLoading || !guestName.trim()}
                  className="rounded-xl bg-rose-500 px-5 py-3 font-semibold text-white hover:bg-rose-400 transition-colors disabled:opacity-60"
                >
                  {authLoading ? "Entrando…" : "Continuar"}
                </button>
              </div>
              {error && (
                <p className="text-center text-sm text-rose-400">{error}</p>
              )}
            </form>
          </div>
        )}

        {/* PASO 2: lobby con preview */}
        {step === "lobby" && (
          <div className="mt-8">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`h-full w-full object-cover ${camOn ? "" : "hidden"} ${lobbyUnMirror ? "-scale-x-100" : ""}`}
              />
              {!camOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/20 text-2xl font-bold text-rose-300">
                    {initialsOf(displayName)}
                  </div>
                  <p className="text-sm text-zinc-500">
                    {mediaDenied
                      ? "Sin acceso a la cámara — puedes entrar solo a mirar"
                      : "Cámara apagada"}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-center gap-3">
              {!mediaAsked ? (
                <button
                  onClick={requestMedia}
                  className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium hover:bg-zinc-800 transition-colors"
                >
                  🎥 Probar cámara y micrófono
                </button>
              ) : (
                !mediaDenied && (
                  <>
                    <button
                      onClick={toggleCam}
                      className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium hover:bg-zinc-800 transition-colors"
                    >
                      {camOn ? "Apagar cámara" : "Encender cámara"}
                    </button>
                    {camOn && (
                      <button
                        type="button"
                        onClick={flipLobbyCamera}
                        className="flex items-center gap-2 rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium hover:bg-zinc-800 transition-colors"
                      >
                        <SwitchCamera className="h-4 w-4" />
                        Cambiar cámara
                      </button>
                    )}
                  </>
                )
              )}
            </div>

            {session.mute_on_entry && !isHost && (
              <p className="mt-4 rounded-lg bg-zinc-900 p-3 text-center text-xs text-zinc-400">
                🔇 En este evento entrarás en silencio. El anfitrión habilitará
                tu micrófono cuando sea tu momento de hablar.
              </p>
            )}

            {error && (
              <p className="mt-4 text-center text-sm text-rose-400">{error}</p>
            )}

            <button
              onClick={join}
              className="mt-6 w-full rounded-xl bg-rose-500 px-6 py-3.5 font-semibold text-white hover:bg-rose-400 transition-colors"
            >
              Unirme al evento
            </button>
          </div>
        )}

        {/* PASO 3: sala de espera */}
        {step === "waiting" && (
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-rose-500" />
            <p className="font-medium">Esperando a que el anfitrión te acepte…</p>
            <p className="text-sm text-zinc-500">
              No cierres esta pestaña. Entrarás automáticamente.
            </p>
          </div>
        )}

        {step === "rejected" && (
          <p className="mt-10 text-center text-zinc-400">
            El anfitrión no aprobó tu ingreso a este evento.
          </p>
        )}

        {step === "full" && (
          <p className="mt-10 text-center text-zinc-400">
            La sesión alcanzó el máximo de {session.max_guests} invitados.
          </p>
        )}

        {step === "loading" && (
          <div className="mt-10 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-rose-500" />
          </div>
        )}
      </div>
    </main>
  );
}
