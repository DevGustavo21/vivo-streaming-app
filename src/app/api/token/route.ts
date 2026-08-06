import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isLiveKitConfigured, liveKitConfigError } from "@/lib/livekit-config";
import { createRoomToken } from "@/lib/livekit";
import { resolveInviteCodeParam } from "@/lib/invite";

/**
 * Emite el token de LiveKit para entrar a la sala.
 * Los permisos (especialmente el micrófono) van dentro del JWT,
 * por lo que el mute configurado por el host es inviolable desde
 * el cliente.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!isLiveKitConfigured()) {
    return NextResponse.json({ error: liveKitConfigError() }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const code = resolveInviteCodeParam(typeof body?.code === "string" ? body.code : "");

  const admin = createAdminClient();

  const { data: session } = await admin
    .from("sessions")
    .select("*")
    .eq("invite_code", code)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }
  if (session.status === "ended") {
    return NextResponse.json({ error: "Esta sesión ya finalizó" }, { status: 410 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const displayName = profile?.display_name ?? "Invitado";
  const isHost = session.host_id === user.id;

  if (isHost) {
    // El primer ingreso del host pone la sesión en vivo
    if (session.status === "scheduled") {
      await admin
        .from("sessions")
        .update({ status: "live", started_at: new Date().toISOString() })
        .eq("id", session.id);
    }

    const token = await createRoomToken({
      roomName: session.id,
      identity: user.id,
      name: displayName,
      role: "host",
      canPublishAudio: true,
      avatarUrl: profile?.avatar_url ?? null,
      maxParticipants: session.max_guests + 1,
    });

    return NextResponse.json({ token, url: process.env.LIVEKIT_URL });
  }

  // Invitado: debe estar aprobado
  const { data: participant } = await admin
    .from("participants")
    .select("*")
    .eq("session_id", session.id)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!participant || participant.admission !== "approved") {
    return NextResponse.json(
      { error: "Aún no tienes acceso a esta sesión" },
      { status: 403 }
    );
  }

  await admin
    .from("participants")
    .update({ joined_at: new Date().toISOString(), left_at: null })
    .eq("id", participant.id);

  const token = await createRoomToken({
    roomName: session.id,
    identity: user.id,
    name: displayName,
    role: "guest",
    canPublishAudio: participant.can_publish_audio,
    avatarUrl: profile?.avatar_url ?? null,
    maxParticipants: session.max_guests + 1,
  });

  return NextResponse.json({ token, url: process.env.LIVEKIT_URL });
}
