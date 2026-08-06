"use client";

import { useEffect, useRef } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { ConnectionState, isLocalTrack, isVideoTrack, Track, type LocalVideoTrack } from "livekit-client";
import {
  buildCameraCaptureOptions,
  getPreferredCameraFacing,
  isCameraSwitchCooldown,
  isMobileOrTablet,
  republishLocalCameraForViewport,
  viewportOrientation,
} from "@/lib/camera";

function isLocalVideoTrack(track: unknown): track is LocalVideoTrack {
  return isLocalTrack(track as LocalVideoTrack) && isVideoTrack(track as LocalVideoTrack);
}

/**
 * Al rotar el dispositivo, republica la cámara con resolución acorde para que
 * quien ve la transmisión reciba horizontal/vertical correcto (no “acostado”).
 */
export default function CameraOrientationSync() {
  const room = useRoomContext();
  const { localParticipant, isCameraEnabled } = useLocalParticipant();
  const busyRef = useRef(false);
  const lastOrientationRef = useRef<"portrait" | "landscape" | null>(null);

  useEffect(() => {
    if (room.state !== ConnectionState.Connected || !isCameraEnabled) {
      lastOrientationRef.current = null;
      return;
    }

    let debounce: ReturnType<typeof setTimeout> | undefined;

    async function syncCapture() {
      if (busyRef.current || isCameraSwitchCooldown()) return;
      const orientation = viewportOrientation();
      if (lastOrientationRef.current === orientation) return;

      busyRef.current = true;
      try {
        if (isMobileOrTablet()) {
          await republishLocalCameraForViewport(localParticipant, room);
        } else {
          const pub = localParticipant.getTrackPublication(Track.Source.Camera);
          const track = pub?.track;
          if (track && isLocalVideoTrack(track)) {
            await track.restartTrack(
              buildCameraCaptureOptions(getPreferredCameraFacing())
            );
          }
        }
        lastOrientationRef.current = orientation;
      } catch {
        // El usuario puede volver a girar el dispositivo
      } finally {
        busyRef.current = false;
      }
    }

    function schedule() {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void syncCapture();
      }, 600);
    }

    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    return () => {
      if (debounce) clearTimeout(debounce);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, [room, room.state, localParticipant, isCameraEnabled]);

  return null;
}
