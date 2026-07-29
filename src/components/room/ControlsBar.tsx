"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { TrackSource } from "@livekit/protocol";
import { RoomEvent } from "livekit-client";
import type { LucideIcon } from "lucide-react";
import {
  Crop,
  Hand,
  Heart,
  Laugh,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PartyPopper,
  PhoneOff,
  Settings,
  SmilePlus,
  Sparkles,
  SwitchCamera,
  ThumbsUp,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { canFlipCamera, flipLocalCamera, isMobileOrTablet } from "@/lib/camera";
import type { VideoFitMode } from "@/lib/video-display";
import { REACTION_EMOJIS, type LkMetadata, type ReactionKey } from "@/lib/types";
import type { SidebarView } from "./RoomContent";

const REACTION_ICONS: Record<ReactionKey, LucideIcon> = {
  clap: Hand,
  heart: Heart,
  laugh: Laugh,
  wow: Sparkles,
  like: ThumbsUp,
  party: PartyPopper,
};

function parseMetadata(raw: string | undefined): LkMetadata {
  try {
    if (raw) return JSON.parse(raw) as LkMetadata;
  } catch {
    // metadata malformada
  }
  return { role: "guest", avatarUrl: null };
}

export default function ControlsBar({
  isHost,
  sidebar,
  unreadChat,
  onToggleChat,
  onTogglePanel,
  onToggleSettings,
  onReaction,
  onNotify,
  onFinalizeForAll,
  videoFit,
  onToggleVideoFit,
}: {
  isHost: boolean;
  sidebar: SidebarView;
  unreadChat: number;
  onToggleChat: () => void;
  onTogglePanel: () => void;
  onToggleSettings: () => void;
  onReaction: (emoji: ReactionKey) => void;
  onNotify: (msg: string) => void;
  onFinalizeForAll?: () => void;
  videoFit: VideoFitMode;
  onToggleVideoFit: () => void;
}) {
  const router = useRouter();
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();

  const roleFromToken = useMemo(
    () => parseMetadata(localParticipant?.metadata).role,
    [localParticipant?.metadata]
  );
  const isHostUser = isHost || roleFromToken === "host";

  const [showReactions, setShowReactions] = useState(false);
  const [micAllowed, setMicAllowed] = useState(isHostUser);
  const [busy, setBusy] = useState<string | null>(null);
  const [showFlipCam, setShowFlipCam] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = (await canFlipCamera()) && isMobileOrTablet();
      if (!cancelled) setShowFlipCam(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function computeMicAllowed(): boolean {
    if (isHostUser) return true;
    const perms = localParticipant?.permissions;
    if (!perms) return false;
    return (
      perms.canPublishSources.length === 0 ||
      perms.canPublishSources.includes(TrackSource.MICROPHONE)
    );
  }

  useEffect(() => {
    const update = () => setMicAllowed(computeMicAllowed());
    update();
    room.on(RoomEvent.ParticipantPermissionsChanged, update);
    room.on(RoomEvent.Connected, update);
    return () => {
      room.off(RoomEvent.ParticipantPermissionsChanged, update);
      room.off(RoomEvent.Connected, update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, localParticipant, isHostUser]);

  async function toggleMic() {
    if (!micAllowed) {
      onNotify("El anfitrión aún no habilita tu micrófono.");
      return;
    }
    try {
      setBusy("mic");
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {
      onNotify("No se pudo acceder a tu micrófono. Revisa los permisos del navegador.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleCam() {
    try {
      setBusy("cam");
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch {
      onNotify("No se pudo acceder a tu cámara. Revisa los permisos del navegador.");
    } finally {
      setBusy(null);
    }
  }

  async function switchCamera() {
    if (!isCameraEnabled) {
      onNotify("Enciende la cámara para cambiar de lente.");
      return;
    }
    try {
      setBusy("flip");
      await flipLocalCamera(localParticipant);
    } catch {
      onNotify("No se pudo cambiar de cámara en este dispositivo.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleScreenShare() {
    try {
      setBusy("screen");
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch {
      // Usuario canceló el diálogo del sistema
    } finally {
      setBusy(null);
    }
  }

  function leave() {
    room.disconnect();
    router.replace("/");
  }

  return (
    <div className="relative flex items-center justify-center gap-2 px-3 py-3 md:gap-3">
      {showReactions && (
        <div className="absolute bottom-full mb-2 flex gap-1 rounded-2xl border border-zinc-800 bg-zinc-900 p-2 shadow-xl">
          {(Object.keys(REACTION_ICONS) as ReactionKey[]).map((key) => {
            const Icon = REACTION_ICONS[key];
            return (
              <button
                key={key}
                onClick={() => {
                  onReaction(key);
                  setShowReactions(false);
                }}
                className="rounded-xl p-2.5 text-zinc-300 hover:bg-zinc-800 transition-colors"
                aria-label={`Reaccionar: ${key}`}
                title={REACTION_EMOJIS[key]}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>
      )}

      <ControlButton
        onClick={toggleMic}
        active={isMicrophoneEnabled}
        disabled={busy === "mic"}
        locked={!micAllowed}
        label={
          !micAllowed
            ? "Micrófono bloqueado por el anfitrión"
            : isMicrophoneEnabled
              ? "Silenciarme"
              : "Activar micrófono"
        }
      >
        {!micAllowed ? (
          <Lock className="h-5 w-5" />
        ) : isMicrophoneEnabled ? (
          <Mic className="h-5 w-5" />
        ) : (
          <MicOff className="h-5 w-5" />
        )}
      </ControlButton>

      <ControlButton
        onClick={toggleCam}
        active={isCameraEnabled}
        disabled={busy === "cam"}
        label={isCameraEnabled ? "Apagar cámara" : "Encender cámara"}
      >
        {isCameraEnabled ? (
          <Video className="h-5 w-5" />
        ) : (
          <VideoOff className="h-5 w-5" />
        )}
      </ControlButton>

      <ControlButton
        onClick={onToggleVideoFit}
        active={videoFit === "cover"}
        label={
          videoFit === "cover"
            ? "Reencuadre automático activado (ajusta al recuadro)"
            : "Reencuadre desactivado (video completo)"
        }
      >
        <Crop className="h-5 w-5" />
      </ControlButton>

      {showFlipCam && (
        <ControlButton
          onClick={switchCamera}
          active={false}
          disabled={busy === "flip" || !isCameraEnabled}
          label="Cambiar cámara (frontal / trasera)"
          className="md:hidden"
        >
          <SwitchCamera className="h-5 w-5" />
        </ControlButton>
      )}

      <ControlButton
        onClick={toggleScreenShare}
        active={isScreenShareEnabled}
        disabled={busy === "screen"}
        label={isScreenShareEnabled ? "Dejar de compartir" : "Compartir pantalla"}
        className="hidden md:flex"
      >
        <MonitorUp className="h-5 w-5" />
      </ControlButton>

      <ControlButton
        onClick={() => setShowReactions((s) => !s)}
        active={showReactions}
        label="Reaccionar"
      >
        <SmilePlus className="h-5 w-5" />
      </ControlButton>

      <ControlButton
        onClick={onToggleChat}
        active={sidebar === "chat"}
        label="Chat"
        badge={unreadChat}
      >
        <MessageSquare className="h-5 w-5" />
      </ControlButton>

      {isHostUser && (
        <>
          <ControlButton
            onClick={onToggleSettings}
            active={sidebar === "settings"}
            label="Ajustes generales"
          >
            <Settings className="h-5 w-5" />
          </ControlButton>
          <ControlButton
            onClick={onTogglePanel}
            active={sidebar === "panel"}
            label="Participantes"
          >
            <Users className="h-5 w-5" />
          </ControlButton>
          {onFinalizeForAll && (
            <button
              onClick={onFinalizeForAll}
              className="ml-2 flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 transition-colors"
            >
              <PhoneOff className="h-4 w-4" />
              Finalizar para todos
            </button>
          )}
        </>
      )}

      {!isHostUser && (
        <button
          onClick={leave}
          className="ml-2 flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <PhoneOff className="h-4 w-4" />
          Salir
        </button>
      )}
    </div>
  );
}

function ControlButton({
  children,
  onClick,
  active,
  disabled,
  locked,
  label,
  badge,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  locked?: boolean;
  label: string;
  badge?: number;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors md:h-12 md:w-12 ${
        locked
          ? "bg-zinc-900 text-zinc-500 opacity-70"
          : active
            ? "bg-zinc-700 text-white"
            : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
      } disabled:opacity-50 ${className}`}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}
