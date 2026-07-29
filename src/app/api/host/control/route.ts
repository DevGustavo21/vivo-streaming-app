import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { roomService, setMicPermission } from "@/lib/livekit";

type Action =
  | "approve"
  | "reject"
  | "enable_mic"
  | "disable_mic"
  | "kick"
  | "end_session"
  | "update_settings"
  | "set_spotlight";

async function applyMicToAllApproved(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string,
  allow: boolean
) {
  await admin
    .from("participants")
    .update({ can_publish_audio: allow })
    .eq("session_id", sessionId)
    .eq("admission", "approved");

  const { data: participants } = await admin
    .from("participants")
    .select("profile_id")
    .eq("session_id", sessionId)
    .eq("admission", "approved");

  for (const p of participants ?? []) {
    try {
      await setMicPermission(sessionId, p.profile_id, allow);
    } catch {
      // Puede no estar conectado en LiveKit aún
    }
  }
}

/**
 * Acciones del anfitrión sobre la sesión y sus participantes.
 * Toda acción se aplica primero en la DB (fuente de verdad) y
 * luego se refleja en LiveKit vía Server API.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const action = body?.action as Action;
  const sessionId = body?.sessionId as string;
  const participantId = body?.participantId as string | undefined;

  if (!action || !sessionId) {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: session } = await admin
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session || session.host_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (action === "end_session") {
    const now = new Date().toISOString();
    await admin
      .from("sessions")
      .update({ status: "ended", ended_at: now })
      .eq("id", sessionId);
    await admin
      .from("participants")
      .update({ left_at: now })
      .eq("session_id", sessionId)
      .is("left_at", null);
    try {
      await roomService().deleteRoom(sessionId);
    } catch {
      // La sala puede no existir aún en LiveKit; la DB manda
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "update_settings") {
    const muteOnEntry = body?.muteOnEntry as boolean | undefined;
    const requireApproval = body?.requireApproval as boolean | undefined;
    const updates: Record<string, boolean> = {};

    if (typeof muteOnEntry === "boolean") updates.mute_on_entry = muteOnEntry;
    if (typeof requireApproval === "boolean") {
      updates.require_approval = requireApproval;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const { data: updated, error } = await admin
      .from("sessions")
      .update(updates)
      .eq("id", sessionId)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json({ error: error?.message ?? "Error al guardar" }, { status: 500 });
    }

    if (typeof muteOnEntry === "boolean") {
      await applyMicToAllApproved(admin, sessionId, !muteOnEntry);
    }

    return NextResponse.json({ ok: true, session: updated });
  }

  if (action === "set_spotlight") {
    const raw = body?.spotlightIdentity;
    const spotlightIdentity =
      raw === null || raw === undefined || raw === ""
        ? null
        : typeof raw === "string"
          ? raw
          : undefined;

    if (spotlightIdentity === undefined) {
      return NextResponse.json({ error: "spotlightIdentity inválido" }, { status: 400 });
    }

    const { data: updated, error } = await admin
      .from("sessions")
      .update({ spotlight_identity: spotlightIdentity })
      .eq("id", sessionId)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: error?.message ?? "Error al actualizar vista ampliada" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, session: updated });
  }

  if (!participantId) {
    return NextResponse.json({ error: "Falta participantId" }, { status: 400 });
  }

  const { data: participant } = await admin
    .from("participants")
    .select("*")
    .eq("id", participantId)
    .eq("session_id", sessionId)
    .single();

  if (!participant) {
    return NextResponse.json({ error: "Participante no encontrado" }, { status: 404 });
  }

  switch (action) {
    case "approve":
      await admin
        .from("participants")
        .update({ admission: "approved" })
        .eq("id", participantId);
      break;

    case "reject":
      await admin
        .from("participants")
        .update({ admission: "rejected" })
        .eq("id", participantId);
      break;

    case "enable_mic":
    case "disable_mic": {
      const allow = action === "enable_mic";
      await admin
        .from("participants")
        .update({ can_publish_audio: allow })
        .eq("id", participantId);
      try {
        // Al revocar el grant, LiveKit despublica el micrófono
        // automáticamente: mute duro a nivel servidor.
        await setMicPermission(sessionId, participant.profile_id, allow);
      } catch {
        // Si no está conectado, el token de su próximo ingreso
        // ya reflejará el nuevo permiso desde la DB.
      }
      break;
    }

    case "kick":
      await admin
        .from("participants")
        .update({ admission: "kicked", left_at: new Date().toISOString() })
        .eq("id", participantId);
      try {
        await roomService().removeParticipant(sessionId, participant.profile_id);
      } catch {
        // No conectado — con la DB actualizada no podrá reingresar
      }
      break;

    default:
      return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
