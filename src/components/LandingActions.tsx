"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeInviteCode } from "@/lib/invite";
import { createClient } from "@/lib/supabase/client";

export default function LandingActions({
  hasRealAccount,
}: {
  hasRealAccount: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
  }

  function goToInvite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    const normalized = normalizeInviteCode(trimmed);
    if (normalized.length >= 6) router.push(`/join/${normalized}`);
  }

  return (
    <div className="mt-10 flex w-full max-w-md flex-col items-center gap-4">
      {hasRealAccount ? (
        <button
          onClick={() => router.push("/dashboard")}
          className="w-full rounded-xl bg-rose-500 px-6 py-3.5 font-semibold text-white hover:bg-rose-400 transition-colors"
        >
          Crear una sesión
        </button>
      ) : (
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-6 py-3.5 font-semibold text-zinc-900 hover:bg-zinc-200 transition-colors disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
            />
          </svg>
          Continuar con Google
        </button>
      )}

      <div className="flex w-full items-center gap-3 text-xs text-zinc-500">
        <div className="h-px flex-1 bg-zinc-800" />
        ¿Te invitaron a un evento?
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      <form onSubmit={goToInvite} className="flex w-full gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Pega tu enlace o código (ej. abc-defg-hij)"
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm placeholder:text-zinc-500 focus:border-rose-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-zinc-800 px-5 py-3 text-sm font-medium hover:bg-zinc-700 transition-colors"
        >
          Unirme
        </button>
      </form>
    </div>
  );
}
