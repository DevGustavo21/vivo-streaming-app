import {
  facingModeFromLocalTrack,
  isLocalTrack,
  isVideoTrack,
  type LocalParticipant,
  type LocalVideoTrack,
  Track,
  type VideoCaptureOptions,
} from "livekit-client";

export type CameraFacing = NonNullable<VideoCaptureOptions["facingMode"]>;

/** Restricciones por defecto: cámara frontal en móviles compatibles. */
export const DEFAULT_VIDEO_CAPTURE: VideoCaptureOptions = {
  facingMode: "user",
};

export function isMobileOrTablet(): boolean {
  if (typeof window === "undefined") return false;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const compact = window.matchMedia("(max-width: 1024px)").matches;
  return touch && compact;
}

function isLocalVideoTrack(track: unknown): track is LocalVideoTrack {
  return isLocalTrack(track as LocalVideoTrack) && isVideoTrack(track as LocalVideoTrack);
}

export function shouldMirrorLocalVideo(track: LocalVideoTrack | undefined): boolean {
  if (!track) return true;
  const { facingMode } = facingModeFromLocalTrack(track, {
    defaultFacingMode: "user",
  });
  return facingMode === "user";
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
  await track.restartTrack({ facingMode: next });
  return next;
}

export async function canFlipCamera(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return isMobileOrTablet();
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((d) => d.kind === "videoinput");
    if (cameras.length >= 2) return true;
  } catch {
    // Sin permiso aún: en móvil/tablet igualmente ofrecemos el botón.
  }
  return isMobileOrTablet();
}
