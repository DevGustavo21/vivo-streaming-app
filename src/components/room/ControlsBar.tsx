"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { TrackSource } from "@livekit/protocol";
import { RoomEvent } from "livekit-client";
import type { LucideIcon } from "lucide-react";
import {
  Crop,
  FlipHorizontal,
  Hand,
  Heart,
  Laugh,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
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
import { flipLocalCamera, isMobileOrTablet, videoCaptureOptionsForViewport } from "@/lib/camera";
import type { LocalMirrorMode, VideoFitMode } from "@/lib/video-display";
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
  localMirrorMode,
  onToggleLocalMirror,
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
  localMirrorMode: LocalMirrorMode;
  onToggleLocalMirror: () => void;
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
  const [isMobileUi, setIsMobileUi] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    setIsMobileUi(isMobileOrTablet());
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
      if (isCameraEnabled) {
        await localParticipant.setCameraEnabled(false);
      } else {
        await localParticipant.setCameraEnabled(
          true,
          videoCaptureOptionsForViewport("user")
        );
      }
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

  const reactionsPicker = showReactions && (
    <div className="absolute bottom-full left-1/2 z-30 mb-2 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 gap-0.5 rounded-2xl border border-zinc-800 bg-zinc-900 p-1.5 shadow-xl md:gap-1 md:p-2">
      {(Object.keys(REACTION_ICONS) as ReactionKey[]).map((key) => {
        const Icon = REACTION_ICONS[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              onReaction(key);
              setShowReactions(false);
            }}
            className="rounded-xl p-2 text-zinc-300 hover:bg-zinc-800 transition-colors md:p-2.5"
            aria-label={`Reaccionar: ${key}`}
            title={REACTION_EMOJIS[key]}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );

  const moreMenu = showMore && (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        aria-label="Cerrar menú"
        onClick={() => setShowMore(false)}
      />
      <div className="absolute bottom-full right-2 z-50 mb-2 w-56 rounded-2xl border border-zinc-800 bg-zinc-900 py-1 shadow-xl md:hidden">
        <MoreMenuItem
          onClick={() => {
            onToggleVideoFit();
            setShowMore(false);
          }}
          active={videoFit === "cover"}
          label={
            videoFit === "cover" ? "Reencuadre al recuadro" : "Video completo (sin recorte)"
          }
          icon={Crop}
        />
        {isMobileUi && (
          <MoreMenuItem
            onClick={() => {
              onToggleLocalMirror();
              setShowMore(false);
            }}
            active={localMirrorMode === "selfie"}
            label={localMirrorMode === "selfie" ? "Modo espejo" : "Vista sin espejo"}
            icon={FlipHorizontal}
          />
        )}
        <MoreMenuItem
          onClick={() => {
            void switchCamera();
            setShowMore(false);
          }}
          disabled={busy === "flip" || !isCameraEnabled}
          label="Cambiar cámara (frontal / trasera)"
          icon={SwitchCamera}
        />
        {isHostUser && (
          <>
            <div className="my-1 h-px bg-zinc-800" />
            <MoreMenuItem
              onClick={() => {
                onToggleSettings();
                setShowMore(false);
              }}
              active={sidebar === "settings"}
              label="Ajustes generales"
              icon={Settings}
            />
            <MoreMenuItem
              onClick={() => {
                onTogglePanel();
                setShowMore(false);
              }}
              active={sidebar === "panel"}
              label="Participantes"
              icon={Users}
            />
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* ——— Móvil ——— */}
      <div className="relative shrink-0 border-t border-zinc-800/80 bg-zinc-950 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
        {reactionsPicker}
        <div className="flex items-center gap-1 px-2 py-2">
          <div className="flex min-w-0 flex-1 items-center justify-evenly gap-0.5">
            <ControlButton
              mobile
              onClick={toggleMic}
              active={isMicrophoneEnabled}
              disabled={busy === "mic"}
              locked={!micAllowed}
              label={
                !micAllowed
                  ? "Micrófono bloqueado"
                  : isMicrophoneEnabled
                    ? "Silenciarme"
                    : "Activar micrófono"
              }
            >
              {!micAllowed ? (
                <Lock className="h-[18px] w-[18px]" />
              ) : isMicrophoneEnabled ? (
                <Mic className="h-[18px] w-[18px]" />
              ) : (
                <MicOff className="h-[18px] w-[18px]" />
              )}
            </ControlButton>

            <ControlButton
              mobile
              onClick={toggleCam}
              active={isCameraEnabled}
              disabled={busy === "cam"}
              label={isCameraEnabled ? "Apagar cámara" : "Encender cámara"}
            >
              {isCameraEnabled ? (
                <Video className="h-[18px] w-[18px]" />
              ) : (
                <VideoOff className="h-[18px] w-[18px]" />
              )}
            </ControlButton>

            <ControlButton
              mobile
              onClick={() => {
                setShowMore(false);
                setShowReactions((s) => !s);
              }}
              active={showReactions}
              label="Reaccionar"
            >
              <SmilePlus className="h-[18px] w-[18px]" />
            </ControlButton>

            <ControlButton
              mobile
              onClick={() => {
                setShowMore(false);
                onToggleChat();
              }}
              active={sidebar === "chat"}
              label="Chat"
              badge={unreadChat}
            >
              <MessageSquare className="h-[18px] w-[18px]" />
            </ControlButton>

            <div className="relative">
              {moreMenu}
              <ControlButton
                mobile
                onClick={() => {
                  setShowReactions(false);
                  setShowMore((s) => !s);
                }}
                active={showMore}
                label="Más opciones"
              >
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </ControlButton>
            </div>
          </div>

          {isHostUser && onFinalizeForAll ? (
            <button
              type="button"
              onClick={onFinalizeForAll}
              title="Finalizar para todos"
              aria-label="Finalizar para todos"
              className="ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white hover:bg-rose-500"
            >
              <PhoneOff className="h-[18px] w-[18px]" />
            </button>
          ) : (
            !isHostUser && (
              <button
                type="button"
                onClick={leave}
                title="Salir"
                aria-label="Salir de la llamada"
                className="ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-600 text-zinc-300 hover:bg-zinc-800"
              >
                <PhoneOff className="h-[18px] w-[18px]" />
              </button>
            )
          )}
        </div>
      </div>

      {/* ——— Escritorio ——— */}
      <div className="relative hidden shrink-0 flex-wrap items-center justify-center gap-2 px-3 py-3 md:flex md:gap-3">
        {showReactions && (
          <div className="absolute bottom-full mb-2 flex gap-1 rounded-2xl border border-zinc-800 bg-zinc-900 p-2 shadow-xl">
            {(Object.keys(REACTION_ICONS) as ReactionKey[]).map((key) => {
              const Icon = REACTION_ICONS[key];
              return (
                <button
                  key={key}
                  type="button"
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
        onClick={() => void switchCamera()}
        active={false}
        disabled={busy === "flip" || !isCameraEnabled}
        label="Cambiar cámara (frontal / trasera)"
      >
        <SwitchCamera className="h-5 w-5" />
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

      <ControlButton
        onClick={toggleScreenShare}
        active={isScreenShareEnabled}
        disabled={busy === "screen"}
        label={isScreenShareEnabled ? "Dejar de compartir" : "Compartir pantalla"}
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
    </>
  );
}

function MoreMenuItem({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors disabled:opacity-50 ${
        active ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-800/80"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      {label}
    </button>
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
  mobile = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  locked?: boolean;
  label: string;
  badge?: number;
  className?: string;
  mobile?: boolean;
}) {
  const size = mobile
    ? "h-10 w-10 shrink-0 rounded-full"
    : "h-11 w-11 rounded-xl md:h-12 md:w-12";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`relative flex items-center justify-center transition-colors ${size} ${
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
