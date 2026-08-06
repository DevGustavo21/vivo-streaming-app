import type { LkMetadata } from "@/lib/types";

/**
 * Corrige vídeo remoto “acostado”: el emisor declaró landscape pero el frame
 * llega en vertical (o al revés).
 */
export function remoteVideoRotationCorrection(
  declared: LkMetadata["videoOrientation"],
  width: number,
  height: number
): number {
  if (!declared || !width || !height) return 0;
  const frameLandscape = width > height * 1.08;
  const framePortrait = height > width * 1.08;
  if (declared === "landscape" && framePortrait) return 90;
  if (declared === "portrait" && frameLandscape) return -90;
  return 0;
}
