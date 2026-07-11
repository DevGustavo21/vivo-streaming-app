import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import type { LkMetadata, Role } from "@/lib/types";

const LK_URL = process.env.LIVEKIT_URL!;
const LK_KEY = process.env.LIVEKIT_API_KEY!;
const LK_SECRET = process.env.LIVEKIT_API_SECRET!;

export function roomService() {
  // La Server API usa https en lugar de wss
  return new RoomServiceClient(
    LK_URL.replace(/^ws/, "http"),
    LK_KEY,
    LK_SECRET
  );
}

interface TokenArgs {
  roomName: string;
  identity: string; // profile_id — estable para reconexión
  name: string;
  role: Role;
  canPublishAudio: boolean;
  avatarUrl: string | null;
  maxParticipants: number;
}

/**
 * Emite el JWT de acceso a LiveKit. Los permisos van EN el token:
 * un invitado muteado no tiene grant de publicar micrófono, por lo
 * que el mute es absoluto a nivel de servidor (no reversible desde
 * el cliente). El host lo levanta después vía updateParticipant.
 */
export async function createRoomToken(args: TokenArgs): Promise<string> {
  const metadata: LkMetadata = { role: args.role, avatarUrl: args.avatarUrl };

  const at = new AccessToken(LK_KEY, LK_SECRET, {
    identity: args.identity,
    name: args.name,
    metadata: JSON.stringify(metadata),
    ttl: "2h", // solo limita el ingreso; la conexión activa no se corta
  });

  const publishSources = [TrackSource.CAMERA, TrackSource.SCREEN_SHARE];
  if (args.canPublishAudio) {
    publishSources.push(TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE_AUDIO);
  }

  at.addGrant({
    room: args.roomName,
    roomJoin: true,
    roomCreate: args.role === "host",
    canPublish: true,
    canPublishSources: publishSources,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: args.role === "host",
  });

  return await at.toJwt();
}

/** Otorga o revoca el permiso de micrófono de un participante en vivo */
export async function setMicPermission(
  roomName: string,
  identity: string,
  allow: boolean
) {
  const svc = roomService();
  const sources = [TrackSource.CAMERA, TrackSource.SCREEN_SHARE];
  if (allow) {
    sources.push(TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE_AUDIO);
  }
  await svc.updateParticipant(roomName, identity, undefined, {
    canPublish: true,
    canPublishSources: sources,
    canSubscribe: true,
    canPublishData: true,
  });
}
