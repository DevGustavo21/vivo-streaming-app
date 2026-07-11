import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Registra al invitado con nombre (auth anónima) y establece la sesión en cookies. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name || name.length > 50) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }

  let cookieResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name: cookieName, value }) =>
            request.cookies.set(cookieName, value)
          );
          cookieResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name: cookieName, value, options }) =>
            cookieResponse.cookies.set(cookieName, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInAnonymously({
    options: { data: { display_name: name } },
  });

  if (error || !data.user) {
    const message = error?.message?.toLowerCase().includes("anonymous")
      ? "El acceso con nombre no está activado. Activa «Allow anonymous sign-ins» en Supabase o usa Google."
      : error?.message ?? "No se pudo crear tu acceso de invitado";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", data.user.id);

  const jsonResponse = NextResponse.json({ ok: true, userId: data.user.id });
  cookieResponse.cookies.getAll().forEach(({ name: cookieName, value }) =>
    jsonResponse.cookies.set(cookieName, value)
  );
  return jsonResponse;
}
