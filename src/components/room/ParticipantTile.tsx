"use client";

import { useEffect, useState } from "react";
import {
  isTrackReference,
  useIsSpeaking,
  VideoTrack,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { isLocalTrack, isVideoTrack, ParticipantEvent, TrackEvent } from "livekit-client";
import { Mic, MicOff } from "lucide-react";
import {
  effectiveLocalFacing,
  getPreferredCameraFacing,
  isMobileOrTablet,
  localPreviewNeedsUnmirror,
  type CameraFacing,
} from "@/lib/camera";
import type { LocalMirrorMode } from "@/lib/video-display";
import { remoteVideoRotationCorrection } from "@/lib/video-orientation";
import { initialsOf, type LkMetadata } from "@/lib/types";

export default function ParticipantTile({
  trackRef,
  isScreenShare = false,
  compact = false,
  videoFit = "cover",
  localMirrorMode = "natural",
}: {
  trackRef: TrackReferenceOrPlaceholder;
  isScreenShare?: boolean;
  compact?: boolean;
  videoFit?: "cover" | "contain";
  localMirrorMode?: LocalMirrorMode;
}) {
  const participant = trackRef.participant;
  const isSpeaking = useIsSpeaking(participant);
  const name = participant.name || "Invitado";
  const isLocal = participant.isLocal;

  const metadata = parseMetadata(participant.metadata);
  const micOn = participant.isMicrophoneEnabled;

  const hasVideo =
    isTrackReference(trackRef) &&
    !trackRef.publication.isMuted &&
    trackRef.publication.track != null;

  const [facingMode, setFacingMode] = useState<CameraFacing>("user");

  useEffect(() => {
    if (!isLocal || isScreenShare || !isTrackReference(trackRef)) return;
    const track = trackRef.publication.track;
    if (!track || !isLocalTrack(track) || !isVideoTrack(track)) {
      setFacingMode("user");
      return;
    }
    const sync = () => {
      if (!track || !isLocalTrack(track) || !isVideoTrack(track)) {
        setFacingMode(getPreferredCameraFacing());
        return;
      }
      setFacingMode(effectiveLocalFacing(track));
    };
    sync();
    track.on(TrackEvent.Restarted, sync);
    return () => {
      track.off(TrackEvent.Restarted, sync);
    };
  }, [trackRef, isLocal, isScreenShare]);

  const [remoteRotateDeg, setRemoteRotateDeg] = useState(0);

  useEffect(() => {
    if (isLocal || isScreenShare || !hasVideo || !isTrackReference(trackRef)) return;
    const track = trackRef.publication.track;
    if (!track || !isVideoTrack(track)) return;

    const recompute = () => {
      const pub = trackRef.publication;
      const w = pub.dimensions?.width ?? 0;
      const h = pub.dimensions?.height ?? 0;
      const meta = parseMetadata(participant.metadata);
      setRemoteRotateDeg(
        remoteVideoRotationCorrection(meta.videoOrientation, w, h)
      );
    };

    recompute();
    track.on(TrackEvent.VideoDimensionsChanged, recompute);
    participant.on(ParticipantEvent.ParticipantMetadataChanged, recompute);
    return () => {
      track.off(TrackEvent.VideoDimensionsChanged, recompute);
      participant.off(ParticipantEvent.ParticipantMetadataChanged, recompute);
    };
  }, [trackRef, hasVideo, isLocal, isScreenShare, participant]);

  const fitClass = isScreenShare
    ? "object-contain"
    : videoFit === "cover"
      ? "object-cover"
      : "object-contain";

  /** En móvil, contain evita recortes raros al rotar; el vídeo debe llenar el tile (no max-*). */
  const cameraFitClass =
    isMobileOrTablet() && !isScreenShare ? "object-contain" : fitClass;

  const unMirrorLocal =
    isLocal &&
    !isScreenShare &&
    localPreviewNeedsUnmirror(facingMode, localMirrorMode);

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-xl bg-zinc-900 ${
        isSpeaking && !isScreenShare ? "ring-2 ring-rose-400" : ""
      }`}
    >
      {hasVideo ? (
        remoteRotateDeg !== 0 && !isLocal ? (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-zinc-950">
            <VideoTrack
              trackRef={trackRef}
              className={`max-h-[145%] max-w-[145%] ${cameraFitClass}`}
              style={{ transform: `rotate(${remoteRotateDeg}deg)` }}
            />
          </div>
        ) : (
          <VideoTrack
            trackRef={trackRef}
            className={`absolute inset-0 h-full w-full bg-zinc-950 ${cameraFitClass} ${unMirrorLocal ? "-scale-x-100" : ""}`}
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          {metadata.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={metadata.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className={`rounded-full ${compact ? "h-10 w-10" : "h-16 w-16 md:h-20 md:w-20"}`}
            />
          ) : (
            <div
              className={`flex items-center justify-center rounded-full bg-rose-500/20 font-bold text-rose-300 ${
                compact ? "h-10 w-10 text-sm" : "h-16 w-16 text-xl md:h-20 md:w-20 md:text-2xl"
              }`}
            >
              {initialsOf(name)}
            </div>
          )}
        </div>
      )}

      {/* Nombre + estado de micrófono */}
      <div className="absolute bottom-1.5 left-1.5 flex max-w-[85%] items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 backdrop-blur-sm">
        {!isScreenShare && (
          <span aria-label={micOn ? "Micrófono activo" : "Silenciado"}>
            {micOn ? (
              <Mic className="h-3 w-3" />
            ) : (
              <MicOff className="h-3 w-3 text-zinc-400" />
            )}
          </span>
        )}
        <span className={`truncate text-white ${compact ? "text-[10px]" : "text-xs"}`}>
          {isScreenShare
            ? `Pantalla de ${name}`
            : `${name}${isLocal ? " (tú)" : ""}${metadata.role === "host" ? " · Anfitrión" : ""}`}
        </span>
      </div>
    </div>
  );
}

function parseMetadata(raw: string | undefined): LkMetadata {
  try {
    if (raw) return JSON.parse(raw) as LkMetadata;
  } catch {
    // metadata malformada → defaults
  }
  return { role: "guest", avatarUrl: null };
}
