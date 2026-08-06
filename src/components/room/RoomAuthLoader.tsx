"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveInviteCodeParam } from "@/lib/invite";

/** Reintenta la sesión en el servidor antes de mandar al join (evita bucles SSR/cliente). */
export default function RoomAuthLoader({ code }: { code: string }) {
  const router = useRouter();
  const inviteCode = resolveInviteCodeParam(code);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.refresh();
      } else {
        router.replace(`/join/${inviteCode}`);
      }
    });
  }, [inviteCode, router]);

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-rose-500" />
      <h1 className="text-xl font-bold">Verificando acceso…</h1>
      <p className="text-sm text-zinc-400">Un momento, estamos preparando tu entrada.</p>
    </main>
  );
}
