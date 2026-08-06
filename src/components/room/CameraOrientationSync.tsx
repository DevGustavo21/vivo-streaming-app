"use client";

import { useEffect, useRef } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import {
  ConnectionState,
  isLocalTrack,
  isVideoTrack,
  Track,
  VideoPresets,
  type LocalVideoTrack,
} from "livekit-client";

function isLocalVideoTrack(track: unknown): track is LocalVideoTrack {
  return isLocalTrack(track as LocalVideoTrack) && isVideoTrack(track as LocalVideoTrack);
}

function captureResolutionForViewport() {
  const portrait = window.innerHeight > window.innerWidth;
  if (portrait) {
    return {
      width: 720,
      height: 1280,
      frameRate: 30,
      aspectRatio: 9 / 16,
    };
  }
  return VideoPresets.h720.resolution;
}

/** Reinicia la captura de cámara al rotar para que resolución y encuadre coincidan con la orientación. */
export default function CameraOrientationSync() {
  const room = useRoomContext();
  const { localParticipant, isCameraEnabled } = useLocalParticipant();
  const busyRef = useRef(false);
  const lastModeRef = useRef<"portrait" | "landscape" | null>(null);

  useEffect(() => {
    if (room.state !== ConnectionState.Connected || !isCameraEnabled) return;

    let debounce: ReturnType<typeof setTimeout> | undefined;

    async function syncCapture() {
      if (busyRef.current) return;
      const mode = window.innerHeight > window.innerWidth ? "portrait" : "landscape";
      if (lastModeRef.current === mode) return;

      const pub = localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track;
      if (!track || !isLocalVideoTrack(track)) return;

      busyRef.current = true;
      try {
        await track.restartTrack({ resolution: captureResolutionForViewport() });
        lastModeRef.current = mode;
      } catch {
        // Dispositivo ocupado o sin permiso momentáneo
      } finally {
        busyRef.current = false;
      }
    }

    function schedule() {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void syncCapture();
      }, 350);
    }

    schedule();
    window.addEventListener("orientationchange", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      if (debounce) clearTimeout(debounce);
      window.removeEventListener("orientationchange", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [room.state, localParticipant, isCameraEnabled]);

  return null;
}
