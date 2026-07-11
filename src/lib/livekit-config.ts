/** Detecta si LiveKit tiene credenciales reales (no placeholders del .env.example). */
export function isLiveKitConfigured(): boolean {
  const url = process.env.LIVEKIT_URL ?? "";
  const key = process.env.LIVEKIT_API_KEY ?? "";
  const secret = process.env.LIVEKIT_API_SECRET ?? "";

  if (!url || !key || !secret) return false;

  const placeholders = [
    "TU-PROYECTO",
    "API...",
    "...",
    "your-project",
    "YOUR_",
  ];

  const combined = `${url} ${key} ${secret}`.toUpperCase();
  return !placeholders.some((p) => combined.includes(p.toUpperCase()));
}

export function liveKitConfigError(): string {
  return "LiveKit no está configurado. Crea un proyecto en cloud.livekit.io y completa LIVEKIT_URL, LIVEKIT_API_KEY y LIVEKIT_API_SECRET en .env.local.";
}
