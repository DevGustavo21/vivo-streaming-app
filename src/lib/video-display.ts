export type VideoFitMode = "cover" | "contain";

const FIT_STORAGE_KEY = "streaming-app:video-fit";

/** cover = rellena el tile (puede recortar). contain = video completo sin recorte. */
export function getVideoFitPreference(): VideoFitMode {
  if (typeof window === "undefined") return "cover";
  return localStorage.getItem(FIT_STORAGE_KEY) === "contain" ? "contain" : "cover";
}

export function setVideoFitPreference(mode: VideoFitMode): void {
  localStorage.setItem(FIT_STORAGE_KEY, mode);
}

/** natural = sin espejo (como te ven los demás). selfie = vista tipo espejo en móvil. */
export type LocalMirrorMode = "natural" | "selfie";

const MIRROR_STORAGE_KEY = "streaming-app:local-mirror";

export function getLocalMirrorPreference(): LocalMirrorMode {
  if (typeof window === "undefined") return "natural";
  return localStorage.getItem(MIRROR_STORAGE_KEY) === "selfie" ? "selfie" : "natural";
}

export function setLocalMirrorPreference(mode: LocalMirrorMode): void {
  localStorage.setItem(MIRROR_STORAGE_KEY, mode);
}
