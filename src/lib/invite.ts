/** Normaliza código pegado (con guiones, mayúsculas o URL). */
export function normalizeInviteCode(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const fromUrl = trimmed.match(/(?:\/join\/)?([a-z0-9-]+)$/i)?.[1] ?? trimmed;
  return fromUrl.replace(/-/g, "");
}

/** Formato legible estilo Meet: abc-defgh-ijk */
export function formatInviteCode(code: string): string {
  const c = normalizeInviteCode(code);
  if (c.length !== 10) return c;
  return `${c.slice(0, 3)}-${c.slice(3, 7)}-${c.slice(7)}`;
}

export function getInviteUrl(code: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/join/${normalizeInviteCode(code)}`;
}
