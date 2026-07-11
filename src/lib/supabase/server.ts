import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminSb } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Cliente ligado a la sesión del usuario (cookies) — respeta RLS */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un Server Component: el middleware refresca la sesión
          }
        },
      },
    }
  );
}

/** Cliente con service role — SOLO para uso en el servidor, salta RLS */
export function createAdminClient() {
  return createAdminSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
