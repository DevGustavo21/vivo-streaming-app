"use client";

import { useMemo } from "react";
import { REACTION_EMOJIS, type ReactionEvent } from "@/lib/types";

/** Emojis flotando brevemente sobre la zona de video (estilo Meet) */
export default function ReactionsOverlay({
  reactions,
}: {
  reactions: ReactionEvent[];
}) {
  // Posición horizontal estable por reacción (derivada del id)
  const positioned = useMemo(
    () =>
      reactions.map((r) => ({
        ...r,
        left: 10 + (hashCode(r.id) % 70),
      })),
    [reactions]
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {positioned.map((r) => (
        <div
          key={r.id}
          className="animate-reaction absolute bottom-6 flex flex-col items-center"
          style={{ left: `${r.left}%` }}
        >
          <span className="text-4xl drop-shadow-lg">
            {REACTION_EMOJIS[r.emoji] ?? "👏"}
          </span>
          <span className="mt-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
            {r.senderName}
          </span>
        </div>
      ))}
    </div>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
