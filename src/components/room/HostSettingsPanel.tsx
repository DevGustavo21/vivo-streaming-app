"use client";

import { useState } from "react";
import { Mic, MicOff, ShieldCheck, X } from "lucide-react";
import type { Session } from "@/lib/types";

export default function HostSettingsPanel({
  session,
  onClose,
  onUpdated,
}: {
  session: Session;
  onClose: () => void;
  onUpdated: (patch: Partial<Session>) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const guestsCanSpeak = !session.mute_on_entry;

  async function call(action: string, extra?: Record<string, unknown>) {
    setBusy(action);
    try {
      const res = await fetch("/api/host/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sessionId: session.id, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
      if (data.session) onUpdated(data.session as Session);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error inesperado");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function toggleGuestMics(enabled: boolean) {
    const ok = await call("update_settings", { muteOnEntry: !enabled });
    if (ok) onUpdated({ mute_on_entry: !enabled });
  }

  async function toggleRequireApproval(enabled: boolean) {
    const ok = await call("update_settings", { requireApproval: enabled });
    if (ok) onUpdated({ require_approval: enabled });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="font-semibold">Ajustes generales</h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800"
          aria-label="Cerrar ajustes"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <section className="flex flex-col gap-4">
          <SettingToggle
            icon={guestsCanSpeak ? Mic : MicOff}
            title="Invitados pueden usar el micrófono"
            description={
              guestsCanSpeak
                ? "Cada invitado puede activar su micrófono cuando quiera."
                : "Los invitados entran en silencio. Tú decides quién habla."
            }
            checked={guestsCanSpeak}
            disabled={busy !== null}
            onChange={toggleGuestMics}
          />

          <SettingToggle
            icon={ShieldCheck}
            title="Aprobar ingreso manualmente"
            description={
              session.require_approval
                ? "Los nuevos invitados esperan en la sala hasta que los aceptes."
                : "Los invitados entran directamente al evento."
            }
            checked={session.require_approval}
            disabled={busy !== null}
            onChange={toggleRequireApproval}
          />
        </section>
      </div>
    </div>
  );
}

function SettingToggle({
  icon: Icon,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block text-xs text-zinc-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-rose-500"
      />
    </label>
  );
}
