export type VideoFitMode = "cover" | "contain";

const STORAGE_KEY = "streaming-app:video-fit";

/** cover = rellena el tile (puede recortar). contain = video completo sin recorte. */
export function getVideoFitPreference(): VideoFitMode {
  if (typeof window === "undefined") return "cover";
  return localStorage.getItem(STORAGE_KEY) === "contain" ? "contain" : "cover";
}

export function setVideoFitPreference(mode: VideoFitMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}
