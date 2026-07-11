import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_GUESTS } from "@/lib/types";

function generateInviteCode(): string {
  // 10 caracteres legibles, sin ambiguos (0/O, 1/l)
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return code;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    return NextResponse.json(
      { error: "Necesitas una cuenta de Google para crear sesiones" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const startNow = Boolean(body?.startNow);
  const scheduledAt = body?.scheduledAt as string | undefined;

  if (!title || title.length > 120) {
    return NextResponse.json({ error: "Título inválido" }, { status: 400 });
  }
  if (!startNow && (!scheduledAt || isNaN(Date.parse(scheduledAt)))) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      host_id: user.id,
      title,
      scheduled_at: startNow
        ? new Date().toISOString()
        : new Date(scheduledAt!).toISOString(),
      invite_code: generateInviteCode(),
      mute_on_entry: Boolean(body?.muteOnEntry ?? true),
      require_approval: Boolean(body?.requireApproval ?? false),
      max_guests: MAX_GUESTS,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // El host no necesita fila en participants: su rol se deriva de host_id
  return NextResponse.json({ session });
}
