"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { DisconnectReason, Room, RoomEvent, VideoPresets } from "livekit-client";
import { createClient } from "@/lib/supabase/client";
import { isMediaDeviceError } from "@/lib/media-errors";
import type { Session } from "@/lib/types";
import RoomContent from "./RoomContent";
import PrejoinMediaSync from "./PrejoinMediaSync";
import CameraOrientationSync from "./CameraOrientationSync";
import CameraSessionInit from "./CameraSessionInit";

type Phase = "connecting" | "ready" | "denied" | "ended" | "error" | "disconnected";

function isBenignDisconnect(reason?: DisconnectReason, message?: string) {
  if (reason === DisconnectReason.CLIENT_INITIATED) return true;
  const msg = message?.toLowerCase() ?? "";
  return (
    msg.includes("client initiated disconnect") ||
    msg.includes("user initiated") ||
    msg.includes("abort")
  );
}

export default function RoomShell({
  session,
  userId,
  isHost: isHostProp,
}: {
  session: Session;
  userId: string;
  isHost: boolean;
}) {
  const router = useRouter();
  const isHost = userId === session.host_id || isHostProp;
  const [phase, setPhase] = useState<Phase>("connecting");
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const sessionEndedRef = useRef(false);
  const hadConnectedRef = useRef(false);
  const intentionalDisconnectRef = useRef(false);
  const connectAttemptRef = useRef(0);

  const markSessionEnded = useCallback(() => {
    sessionEndedRef.current = true;
    setPhase("ended");
  }, []);

  const checkSessionEnded = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("sessions")
      .select("status")
      .eq("id", session.id)
      .single();
    return data?.status === "ended";
  }, [session.id]);

  const room = useMemo(
    () =>
      new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          facingMode: "user",
          frameRate: 30,
        },
        publishDefaults: {
          simulcast: true,
          videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
        },
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: session.invite_code }),
      });
      if (cancelled) return;

      const data = await res.json().catch(() => ({}));

      if (res.status === 403) {
        setErrorDetail(data.error ?? null);
        return setPhase("denied");
      }
      if (res.status === 410) return setPhase("ended");
      if (!res.ok) {
        setErrorDetail(data.error ?? null);
        return setPhase("error");
      }
      if (!data.token || !data.url) {
        setErrorDetail("Respuesta de conexión incompleta");
        return setPhase("error");
      }

      setToken(data.token);
      setServerUrl(data.url);
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [session.invite_code]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`session-status:${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          if ((payload.new as Session).status === "ended") {
            intentionalDisconnectRef.current = true;
            markSessionEnded();
            room.disconnect();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.id, room, markSessionEnded]);

  useEffect(() => {
    if (phase !== "ready") return;

    const interval = setInterval(async () => {
      if (sessionEndedRef.current) return;
      if (await checkSessionEnded()) {
        intentionalDisconnectRef.current = true;
        markSessionEnded();
        room.disconnect();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [phase, room, checkSessionEnded, markSessionEnded]);

  useEffect(() => {
    function onConnected() {
      hadConnectedRef.current = true;
      connectAttemptRef.current = 0;
      setErrorDetail(null);
    }

    async function onDisconnected(reason?: DisconnectReason) {
      if (intentionalDisconnectRef.current || sessionEndedRef.current) {
        if (sessionEndedRef.current) markSessionEnded();
        return;
      }

      if (await checkSessionEnded()) {
        markSessionEnded();
        return;
      }

      if (isBenignDisconnect(reason) && !hadConnectedRef.current) {
        // Strict Mode u otro remount en dev: reintentar en lugar de mostrar error
        connectAttemptRef.current += 1;
        if (connectAttemptRef.current < 3) return;
      }

      if (!hadConnectedRef.current) {
        setErrorDetail(
          (current) =>
            current ??
            "No se pudo conectar a LiveKit. Verifica tus credenciales en .env.local."
        );
        setPhase("error");
        return;
      }

      setPhase("disconnected");
    }

    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room, checkSessionEnded, markSessionEnded]);

  const finalizeForAll = useCallback(async () => {
    if (
      !confirm(
        "¿Finalizar la llamada para todos? Tú y todos los invitados serán desconectados."
      )
    ) {
      return;
    }

    const res = await fetch("/api/host/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end_session", sessionId: session.id }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "No se pudo finalizar la sesión");
      return;
    }

    intentionalDisconnectRef.current = true;
    markSessionEnded();
    room.disconnect();

    if (isHost) {
      router.replace("/dashboard");
    }
  }, [session.id, room, isHost, router, markSessionEnded]);

  if (phase === "denied") {
    return (
      <CenterMessage
        title="Sin acceso a la sala"
        body={
          errorDetail ??
          "No tienes permiso para entrar. Si eres el anfitrión, vuelve al dashboard e intenta de nuevo."
        }
        actionLabel="Volver al dashboard"
        onAction={() => router.replace("/dashboard")}
      />
    );
  }

  if (phase === "ended") {
    return (
      <CenterMessage
        title="El evento finalizó"
        body="El anfitrión cerró la llamada para todos. Gracias por acompañarnos."
        actionLabel={isHost ? "Volver al dashboard" : "Ir al inicio"}
        onAction={() => router.replace(isHost ? "/dashboard" : "/")}
      />
    );
  }

  if (phase === "error") {
    return (
      <CenterMessage
        title="No pudimos conectarte"
        body={
          errorDetail ??
          "Revisa tu conexión y que LiveKit esté configurado en .env.local."
        }
        actionLabel="Reintentar"
        onAction={() => window.location.reload()}
      />
    );
  }

  if (phase === "disconnected") {
    return (
      <CenterMessage
        title="Conexión interrumpida"
        body="Se perdió la conexión con la sala. Puedes intentar entrar de nuevo."
        actionLabel="Reintentar"
        onAction={() => window.location.reload()}
      />
    );
  }

  if (phase !== "ready" || !token || !serverUrl) {
    return (
      <CenterMessage
        title="Conectando…"
        body="Preparando tu lugar en el evento."
        spinner
      />
    );
  }

  return (
    <LiveKitRoom
      key={`${session.invite_code}-${token.slice(0, 12)}`}
      room={room}
      token={token}
      serverUrl={serverUrl}
      connect
      video={false}
      audio={false}
      onError={(error) => {
        if (isBenignDisconnect(undefined, error.message)) return;
        if (isMediaDeviceError(error.message)) return;
        if (sessionEndedRef.current || intentionalDisconnectRef.current) return;
        setErrorDetail(error.message);
        setPhase("error");
      }}
      onDisconnected={() => {
        // LiveKitRoom desmonta: evitar tratarlo como error fatal aquí
      }}
      className="flex h-dvh flex-col bg-zinc-950"
    >
      <RoomAudioRenderer />
      <CameraSessionInit inviteCode={session.invite_code} />
      <PrejoinMediaSync inviteCode={session.invite_code} />
      <CameraOrientationSync />
      <RoomContent
        session={session}
        userId={userId}
        isHost={isHost}
        onFinalizeForAll={isHost ? finalizeForAll : undefined}
      />
    </LiveKitRoom>
  );
}

function CenterMessage({
  title,
  body,
  spinner,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  spinner?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      {spinner && (
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-rose-500" />
      )}
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="max-w-md text-zinc-400">{body}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2 rounded-xl bg-rose-500 px-6 py-3 font-semibold text-white hover:bg-rose-400 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </main>
  );
}
