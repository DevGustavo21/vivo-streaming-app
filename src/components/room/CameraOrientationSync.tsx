"use client";

import { useEffect, useRef } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import {
  ConnectionState,
  facingModeFromLocalTrack,
  isLocalTrack,
  isVideoTrack,
  Track,
  type LocalVideoTrack,
} from "livekit-client";
import { videoCaptureOptionsForViewport, viewportOrientation } from "@/lib/camera";

function isLocalVideoTrack(track: unknown): track is LocalVideoTrack {
  return isLocalTrack(track as LocalVideoTrack) && isVideoTrack(track as LocalVideoTrack);
}

/** Reinicia la captura al rotar para que el stream enviado coincida con la orientación real. */
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
    let orientMedia: MediaQueryList | null = null;

    async function syncCapture() {
      if (busyRef.current) return;
      const orientation = viewportOrientation();
      if (lastOrientationRef.current === orientation) return;

      const pub = localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track;
      if (!track || !isLocalVideoTrack(track)) return;

      const { facingMode } = facingModeFromLocalTrack(track, {
        defaultFacingMode: "user",
      });

      busyRef.current = true;
      try {
        await track.restartTrack(videoCaptureOptionsForViewport(facingMode));
        lastOrientationRef.current = orientation;
      } catch {
        // Reintentar en el siguiente evento de orientación
      } finally {
        busyRef.current = false;
      }
    }

    function schedule() {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void syncCapture();
      }, 450);
    }

    schedule();
    window.addEventListener("orientationchange", schedule);
    window.addEventListener("resize", schedule);
    screen.orientation?.addEventListener("change", schedule);
    if (typeof window.matchMedia === "function") {
      orientMedia = window.matchMedia("(orientation: landscape)");
      orientMedia.addEventListener("change", schedule);
    }

    return () => {
      if (debounce) clearTimeout(debounce);
      window.removeEventListener("orientationchange", schedule);
      window.removeEventListener("resize", schedule);
      screen.orientation?.removeEventListener("change", schedule);
      orientMedia?.removeEventListener("change", schedule);
    };
  }, [room.state, localParticipant, isCameraEnabled]);

  return null;
}
