"use client";

import { useEffect, useRef } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import {
  ConnectionState,
  isLocalTrack,
  isVideoTrack,
  Track,
  type LocalVideoTrack,
} from "livekit-client";
import {
  buildCameraCaptureOptions,
  getPreferredCameraFacing,
  isCameraSwitchCooldown,
  isMobileOrTablet,
  viewportOrientation,
} from "@/lib/camera";

function isLocalVideoTrack(track: unknown): track is LocalVideoTrack {
  return isLocalTrack(track as LocalVideoTrack) && isVideoTrack(track as LocalVideoTrack);
}

/**
 * Solo escritorio: en móvil el SO gestiona la rotación del sensor; reiniciar
 * la pista con resoluciones fijas deforma la cámara trasera.
 */
export default function CameraOrientationSync() {
  const room = useRoomContext();
  const { localParticipant, isCameraEnabled } = useLocalParticipant();
  const busyRef = useRef(false);
  const lastOrientationRef = useRef<"portrait" | "landscape" | null>(null);

  useEffect(() => {
    if (isMobileOrTablet()) return;
    if (room.state !== ConnectionState.Connected || !isCameraEnabled) {
      lastOrientationRef.current = null;
      return;
    }

    let debounce: ReturnType<typeof setTimeout> | undefined;

    async function syncCapture() {
      if (busyRef.current || isCameraSwitchCooldown()) return;
      const orientation = viewportOrientation();
      if (lastOrientationRef.current === orientation) return;

      const pub = localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track;
      if (!track || !isLocalVideoTrack(track)) return;

      busyRef.current = true;
      try {
        await track.restartTrack(
          buildCameraCaptureOptions(getPreferredCameraFacing())
        );
        lastOrientationRef.current = orientation;
      } catch {
        // Ignorar: el usuario puede reintentar rotando de nuevo
      } finally {
        busyRef.current = false;
      }
    }

    function schedule() {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void syncCapture();
      }, 500);
    }

    schedule();
    window.addEventListener("resize", schedule);
    return () => {
      if (debounce) clearTimeout(debounce);
      window.removeEventListener("resize", schedule);
    };
  }, [room.state, localParticipant, isCameraEnabled]);

  return null;
}
