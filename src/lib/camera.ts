import {
  facingModeFromLocalTrack,
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

/** Restricciones por defecto: cámara frontal en móviles compatibles. */
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

export function markCameraSwitchCooldown(ms = 2500): void {
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

/** Opciones de captura según orientación del dispositivo (evita video acostado/estirado). */
export function videoCaptureOptionsForViewport(
  facingMode?: CameraFacing
): VideoCaptureOptions {
  const landscape = isLandscapeViewport();
  const facing = facingMode ?? preferredFacingMode;
  const shared: VideoCaptureOptions = {
    facingMode: facing,
    frameRate: 30,
  };

  if (landscape) {
    return {
      ...shared,
      resolution: VideoPresets.h720.resolution,
    };
  }

  return {
    ...shared,
    resolution: {
      width: 720,
      height: 1280,
      frameRate: 30,
      aspectRatio: 9 / 16,
    },
  };
}

export function isMobileOrTablet(): boolean {
  if (typeof window === "undefined") return false;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const compact = window.matchMedia("(max-width: 1024px)").matches;
  if (touch && compact) return true;
  if (compact && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return true;
  return false;
}

function isLocalVideoTrack(track: unknown): track is LocalVideoTrack {
  return isLocalTrack(track as LocalVideoTrack) && isVideoTrack(track as LocalVideoTrack);
}

async function findVideoInputDeviceId(
  facing: CameraFacing
): Promise<string | undefined> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return undefined;
  }
  try {
    const videos = (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === "videoinput"
    );
    if (videos.length < 2) return undefined;

    const matches = (label: string, patterns: RegExp[]) =>
      patterns.some((p) => p.test(label));

    if (facing === "environment") {
      const back = videos.find((d) =>
        matches(d.label, [
          /back/i,
          /rear/i,
          /environment/i,
          /trasera/i,
          /trase/i,
          /world/i,
          /wide/i,
        ])
      );
      if (back?.deviceId) return back.deviceId;
      if (isMobileOrTablet()) return videos[videos.length - 1]?.deviceId;
    } else {
      const front = videos.find((d) =>
        matches(d.label, [/front/i, /user/i, /selfie/i, /facetime/i, /frontal/i])
      );
      if (front?.deviceId) return front.deviceId;
      if (isMobileOrTablet()) return videos[0]?.deviceId;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function applyRoomVideoDefaults(room: Room | undefined, capture: VideoCaptureOptions) {
  if (!room?.options.videoCaptureDefaults) return;
  room.options.videoCaptureDefaults = {
    ...room.options.videoCaptureDefaults,
    ...capture,
  };
}

export async function flipLocalCamera(
  localParticipant: LocalParticipant,
  room?: Room
): Promise<CameraFacing> {
  const pub = localParticipant.getTrackPublication(Track.Source.Camera);
  const track = pub?.track;
  if (!track || !isLocalVideoTrack(track)) {
    throw new Error("No hay cámara activa");
  }

  const next: CameraFacing =
    preferredFacingMode === "environment" ? "user" : "environment";
  setPreferredCameraFacing(next);
  markCameraSwitchCooldown();

  const options = videoCaptureOptionsForViewport(next);
  const deviceId = await findVideoInputDeviceId(next);
  const capture: VideoCaptureOptions = {
    ...options,
    facingMode: next,
    ...(deviceId ? { deviceId } : {}),
  };

  applyRoomVideoDefaults(room, capture);

  if (deviceId && room) {
    try {
      await room.switchActiveDevice("videoinput", deviceId, true);
    } catch {
      // Seguir con restartTrack + facingMode
    }
  }

  await track.restartTrack(capture);
  return next;
}

export async function canFlipCamera(): Promise<boolean> {
  return true;
}

/** En móvil la cámara frontal suele verse en espejo; invertimos solo la vista local. */
export function localPreviewNeedsUnmirror(
  facingMode: CameraFacing,
  mirrorMode: LocalMirrorMode
): boolean {
  if (mirrorMode === "selfie") return false;
  return isMobileOrTablet() && facingMode === "user";
}

/** Facing efectivo para UI local (preferencia explícita del usuario). */
export function effectiveLocalFacing(track?: LocalVideoTrack): CameraFacing {
  if (track) {
    const detected = facingModeFromLocalTrack(track, {
      defaultFacingMode: preferredFacingMode,
    }).facingMode;
    if (detected === preferredFacingMode) return detected;
  }
  return preferredFacingMode;
}
