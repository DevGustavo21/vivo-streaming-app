import {
  isLocalTrack,
  isVideoTrack,
  type LocalParticipant,
  type LocalVideoTrack,
  type Room,
  Track,
  VideoPresets,
  type VideoCaptureOptions,
} from "livekit-client";
import type { LocalMirrorMode } from "@/lib/video-display";

export type CameraFacing = NonNullable<VideoCaptureOptions["facingMode"]>;

export const DEFAULT_VIDEO_CAPTURE: VideoCaptureOptions = {
  facingMode: "user",
};

let preferredFacingMode: CameraFacing = "user";
let cameraSwitchCooldownUntil = 0;

export function getPreferredCameraFacing(): CameraFacing {
  return preferredFacingMode;
}

export function setPreferredCameraFacing(mode: CameraFacing): void {
  preferredFacingMode = mode;
}

export function resetCameraSessionState(): void {
  preferredFacingMode = "user";
  cameraSwitchCooldownUntil = 0;
}

export function markCameraSwitchCooldown(ms = 4000): void {
  cameraSwitchCooldownUntil = Date.now() + ms;
}

export function isCameraSwitchCooldown(): boolean {
  return Date.now() < cameraSwitchCooldownUntil;
}

export function isLandscapeViewport(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia("(orientation: landscape)").matches) return true;
  return window.innerWidth > window.innerHeight;
}

export function viewportOrientation(): "portrait" | "landscape" {
  return isLandscapeViewport() ? "landscape" : "portrait";
}

export function isMobileOrTablet(): boolean {
  if (typeof window === "undefined") return false;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const compact = window.matchMedia("(max-width: 1024px)").matches;
  if (touch && compact) return true;
  if (compact && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return true;
  return false;
}

/**
 * En móvil/tablet evitamos width/height fijos: el SO rota el sensor y forzar
 * 720×1280 suele deformar la trasera y lo que reciben los demás.
 */
export function buildCameraCaptureOptions(facing?: CameraFacing): VideoCaptureOptions {
  const facingMode = facing ?? preferredFacingMode;
  if (isMobileOrTablet()) {
    return { facingMode, frameRate: 30 };
  }

  const landscape = isLandscapeViewport();
  if (landscape) {
    return {
      facingMode,
      frameRate: 30,
      resolution: VideoPresets.h720.resolution,
    };
  }

  return {
    facingMode,
    frameRate: 30,
    resolution: {
      width: 720,
      height: 1280,
      frameRate: 30,
      aspectRatio: 9 / 16,
    },
  };
}

/** @deprecated use buildCameraCaptureOptions */
export function videoCaptureOptionsForViewport(
  facingMode?: CameraFacing
): VideoCaptureOptions {
  return buildCameraCaptureOptions(facingMode);
}

function isLocalVideoTrack(track: unknown): track is LocalVideoTrack {
  return isLocalTrack(track as LocalVideoTrack) && isVideoTrack(track as LocalVideoTrack);
}

function applyRoomVideoDefaults(room: Room | undefined, capture: VideoCaptureOptions) {
  if (!room?.options.videoCaptureDefaults) return;
  room.options.videoCaptureDefaults = {
    resolution: VideoPresets.h720.resolution,
    ...room.options.videoCaptureDefaults,
    facingMode: capture.facingMode,
    frameRate: capture.frameRate,
    deviceId: undefined,
  };
}

export async function unpublishLocalCamera(
  localParticipant: LocalParticipant
): Promise<void> {
  const pub = localParticipant.getTrackPublication(Track.Source.Camera);
  if (pub?.track) {
    try {
      await localParticipant.unpublishTrack(pub.track);
    } catch {
      // Ya despublicado
    }
  }
  try {
    await localParticipant.setCameraEnabled(false);
  } catch {
    // Sin cámara activa
  }
}

/** Publica cámara con opciones coherentes (móvil: solo facingMode). */
export async function publishLocalCamera(
  localParticipant: LocalParticipant,
  room?: Room,
  facing?: CameraFacing
): Promise<void> {
  if (facing) setPreferredCameraFacing(facing);
  const capture = buildCameraCaptureOptions(facing);
  applyRoomVideoDefaults(room, capture);
  await localParticipant.setCameraEnabled(true, capture);
}

/**
 * Cambio frontal/trasera: despublicar y volver a publicar (fiable en iOS/Android).
 */
export async function flipLocalCamera(
  localParticipant: LocalParticipant,
  room?: Room
): Promise<CameraFacing> {
  const pub = localParticipant.getTrackPublication(Track.Source.Camera);
  if (!pub?.track || !isLocalVideoTrack(pub.track)) {
    throw new Error("No hay cámara activa");
  }

  const next: CameraFacing =
    preferredFacingMode === "environment" ? "user" : "environment";
  setPreferredCameraFacing(next);
  markCameraSwitchCooldown();

  await unpublishLocalCamera(localParticipant);
  await publishLocalCamera(localParticipant, room, next);
  return next;
}

export async function canFlipCamera(): Promise<boolean> {
  return true;
}

export function localPreviewNeedsUnmirror(
  facingMode: CameraFacing,
  mirrorMode: LocalMirrorMode
): boolean {
  if (mirrorMode === "selfie") return false;
  return isMobileOrTablet() && facingMode === "user";
}

export function effectiveLocalFacing(track?: LocalVideoTrack): CameraFacing {
  return preferredFacingMode;
}
