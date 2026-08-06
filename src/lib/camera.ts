import {
  facingModeFromLocalTrack,
  isLocalTrack,
  isVideoTrack,
  type LocalParticipant,
  type LocalVideoTrack,
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
  const shared: VideoCaptureOptions = {
    ...(facingMode ? { facingMode } : {}),
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

export async function flipLocalCamera(
  localParticipant: LocalParticipant
): Promise<CameraFacing> {
  const pub = localParticipant.getTrackPublication(Track.Source.Camera);
  const track = pub?.track;
  if (!track || !isLocalVideoTrack(track)) {
    throw new Error("No hay cámara activa");
  }

  const { facingMode: current } = facingModeFromLocalTrack(track, {
    defaultFacingMode: "user",
  });
  const next: CameraFacing = current === "environment" ? "user" : "environment";
  await track.restartTrack(videoCaptureOptionsForViewport(next));
  return next;
}

export async function canFlipCamera(): Promise<boolean> {
  if (typeof navigator === "undefined") return true;
  if (isMobileOrTablet()) return true;
  if (!navigator.mediaDevices?.enumerateDevices) return true;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((d) => d.kind === "videoinput");
    if (cameras.length >= 2) return true;
  } catch {
    // Tras conceder permiso de cámara, suele haber más de un dispositivo en móvil.
  }
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
