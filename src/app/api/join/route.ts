import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { resolveInviteCodeParam } from "@/lib/invite";

/**
 * Registra al usuario actual como participante de la sesión.
 * - Si la sesión exige aprobación → queda 'pending' (sala de espera).
 * - Si no → 'approved' directo, respetando el cupo de 50 invitados.
 * El permiso de micrófono inicial depende de mute_on_entry.
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

  // El host no se registra como invitado
  if (session.host_id === user.id) {
    return NextResponse.json({ session, participant: null, isHost: true });
  }

  // ¿Ya existe? (reingreso / refresh)
  const { data: existing } = await admin
    .from("participants")
    .select("*")
    .eq("session_id", session.id)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.admission === "kicked" || existing.admission === "rejected") {
      return NextResponse.json(
        { error: "No tienes acceso a esta sesión" },
        { status: 403 }
      );
    }
    return NextResponse.json({ session, participant: existing, isHost: false });
  }

  // Cupo máximo de invitados aprobados
  const { count } = await admin
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .eq("admission", "approved");

  if ((count ?? 0) >= session.max_guests) {
    return NextResponse.json(
      { error: `La sesión alcanzó el máximo de ${session.max_guests} invitados` },
      { status: 409 }
    );
  }

  const { data: participant, error } = await admin
    .from("participants")
    .insert({
      session_id: session.id,
      profile_id: user.id,
      role: "guest",
      admission: session.require_approval ? "pending" : "approved",
      // Si el creador no activó "todos muteados", el invitado entra con permiso de mic
      can_publish_audio: !session.mute_on_entry,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session, participant, isHost: false });
}
