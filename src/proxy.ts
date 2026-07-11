import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresca el token de sesión si expiró (necesario para SSR)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El dashboard requiere cuenta real (no anónima)
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    if (!user || user.is_anonymous) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("login", "1");
      const redirect = NextResponse.redirect(url);
      response.cookies.getAll().forEach(({ name, value }) =>
        redirect.cookies.set(name, value)
      );
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
