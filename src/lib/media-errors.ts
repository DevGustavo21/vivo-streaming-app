/** Errores de cámara/micrófono que no deben bloquear la conexión a la sala. */
export function isMediaDeviceError(message?: string): boolean {
  const msg = message?.toLowerCase() ?? "";
  return (
    msg.includes("requested device not found") ||
    msg.includes("notfounderror") ||
    msg.includes("notallowederror") ||
    msg.includes("permission denied") ||
    msg.includes("could not start video source") ||
    msg.includes("could not start audio source") ||
    msg.includes("device in use") ||
    msg.includes("overconstrainederror")
  );
}
