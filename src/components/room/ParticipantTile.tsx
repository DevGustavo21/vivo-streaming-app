"use client";

import {
  isTrackReference,
  useIsSpeaking,
  VideoTrack,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Mic, MicOff } from "lucide-react";
import { initialsOf, type LkMetadata } from "@/lib/types";

export default function ParticipantTile({
  trackRef,
  isScreenShare = false,
  compact = false,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  isScreenShare?: boolean;
  compact?: boolean;
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

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-xl bg-zinc-900 ${
        isSpeaking && !isScreenShare ? "ring-2 ring-rose-400" : ""
      }`}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className={`h-full w-full ${
            isScreenShare ? "object-contain" : "object-cover"
          } ${isLocal && !isScreenShare ? "-scale-x-100" : ""}`}
        />
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
