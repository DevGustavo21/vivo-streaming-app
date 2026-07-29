"use client";

import { useState } from "react";
import {
  isTrackReference,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import ParticipantTile from "./ParticipantTile";
import type { VideoFitMode } from "@/lib/video-display";

const PAGE_SIZE = 12;

/**
 * Grid responsive de participantes.
 * - Con pantalla compartida: layout "spotlight" (pantalla grande +
 *   tira de cámaras).
 * - Con vista ampliada del anfitrión: participante seleccionado en grande.
 * - Sin ella: grid que se reacomoda según cantidad y viewport, con
 *   paginación a partir de 12 tiles.
 */
export default function VideoGrid({
  spotlightIdentity = null,
  videoFit = "cover",
}: {
  spotlightIdentity?: string | null;
  videoFit?: VideoFitMode;
}) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const screenShare = tracks.find(
    (t) => t.source === Track.Source.ScreenShare && isTrackReference(t)
  );
  const cameras = tracks.filter((t) => t.source === Track.Source.Camera);

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(cameras.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = cameras.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  if (screenShare) {
    return (
      <div className="flex h-full flex-col gap-2">
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-black">
          <ParticipantTile trackRef={screenShare} isScreenShare videoFit={videoFit} />
        </div>
        <div className="flex h-24 gap-2 overflow-x-auto md:h-28">
          {cameras.map((t) => (
            <div key={keyOf(t)} className="aspect-video h-full shrink-0">
              <ParticipantTile trackRef={t} compact videoFit={videoFit} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const spotlightTrack = spotlightIdentity
    ? cameras.find(
        (t) => t.participant.identity === spotlightIdentity && isTrackReference(t)
      )
    : undefined;

  if (spotlightIdentity && spotlightTrack) {
    const others = cameras.filter((t) => t.participant.identity !== spotlightIdentity);
    return (
      <div className="flex h-full flex-col gap-2">
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-black">
          <ParticipantTile trackRef={spotlightTrack} videoFit={videoFit} />
        </div>
        {others.length > 0 && (
          <div className="flex h-24 gap-2 overflow-x-auto md:h-28">
            {others.map((t) => (
              <div key={keyOf(t)} className="aspect-video h-full shrink-0">
                <ParticipantTile trackRef={t} compact videoFit={videoFit} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className={`grid min-h-0 flex-1 gap-2 ${gridCols(visible.length)}`}
        style={{ gridAutoRows: "minmax(0, 1fr)" }}
      >
        {visible.map((t) => (
          <ParticipantTile key={keyOf(t)} trackRef={t} videoFit={videoFit} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-2 flex items-center justify-center gap-3 text-sm text-zinc-400">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="rounded-lg border border-zinc-800 px-3 py-1 disabled:opacity-40"
          >
            ←
          </button>
          {safePage + 1} / {totalPages}
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="rounded-lg border border-zinc-800 px-3 py-1 disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

function keyOf(t: TrackReferenceOrPlaceholder): string {
  return `${t.participant.identity}-${t.source}`;
}

/** Columnas responsive según cantidad de tiles y tamaño de pantalla */
function gridCols(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count <= 2) return "grid-cols-1 md:grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  if (count <= 9) return "grid-cols-2 md:grid-cols-3";
  return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
}
