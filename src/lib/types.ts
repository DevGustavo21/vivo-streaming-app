export const MAX_GUESTS = 50;

export const REACTION_EMOJIS = {
  clap: "👏",
  heart: "❤️",
  laugh: "😂",
  wow: "😮",
  like: "👍",
  party: "🎉",
} as const;

export type ReactionKey = keyof typeof REACTION_EMOJIS;

export type SessionStatus = "scheduled" | "live" | "ended";
export type Admission = "pending" | "approved" | "rejected" | "kicked";
export type Role = "host" | "guest";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_anonymous: boolean;
}

export interface Session {
  id: string;
  host_id: string;
  title: string;
  scheduled_at: string;
  invite_code: string;
  mute_on_entry: boolean;
  require_approval: boolean;
  max_guests: number;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface Participant {
  id: string;
  session_id: string;
  profile_id: string;
  role: Role;
  admission: Admission;
  can_publish_audio: boolean;
  joined_at: string | null;
  left_at: string | null;
  profiles?: Profile;
}

export interface ChatMessage {
  id: number;
  session_id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
}

export interface ReactionEvent {
  emoji: ReactionKey;
  senderName: string;
  id: string;
}

/** Metadata que viaja dentro del token de LiveKit por participante */
export interface LkMetadata {
  role: Role;
  avatarUrl: string | null;
}

/** Sesión creada para empezar de inmediato (sin fecha futura programada). */
export function isImmediateSession(session: Session): boolean {
  return (
    Math.abs(
      new Date(session.scheduled_at).getTime() -
        new Date(session.created_at).getTime()
    ) < 60_000
  );
}

/** Sesión terminada antes de iniciarse (cancelada por el anfitrión). */
export function wasSessionCancelled(session: Session): boolean {
  return session.status === "ended" && !session.started_at;
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
