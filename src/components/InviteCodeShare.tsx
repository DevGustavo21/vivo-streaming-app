"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { formatInviteCode, getInviteUrl } from "@/lib/invite";

type Variant = "inline" | "card" | "banner";

export default function InviteCodeShare({
  inviteCode,
  variant = "inline",
  onDismiss,
}: {
  inviteCode: string;
  variant?: Variant;
  onDismiss?: () => void;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const formatted = formatInviteCode(inviteCode);
  const inviteUrl = getInviteUrl(inviteCode);

  async function copyCode() {
    await navigator.clipboard.writeText(formatted);
    setCopied("code");
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied("link");
    setTimeout(() => setCopied(null), 2000);
  }

  if (variant === "banner") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/80 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Código de invitación
          </p>
          <p className="font-mono text-lg font-semibold tracking-widest text-white">
            {formatted}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CopyButton
            label="Copiar código"
            active={copied === "code"}
            onClick={copyCode}
            icon={<Copy className="h-3.5 w-3.5" />}
            activeLabel="¡Copiado!"
          />
          <CopyButton
            label="Copiar enlace"
            active={copied === "link"}
            onClick={copyLink}
            icon={<Link2 className="h-3.5 w-3.5" />}
            activeLabel="¡Copiado!"
          />
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="rounded-lg px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            >
              Ocultar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-5">
        <p className="text-sm font-medium text-emerald-300">Sesión creada</p>
        <p className="mt-1 text-sm text-zinc-400">
          Comparte este código con tus invitados para que entren al evento.
        </p>
        <p className="mt-4 text-center font-mono text-2xl font-bold tracking-[0.2em] text-white">
          {formatted}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <CopyButton
            label="Copiar código"
            active={copied === "code"}
            onClick={copyCode}
            icon={<Copy className="h-4 w-4" />}
            activeLabel="¡Copiado!"
            primary
          />
          <CopyButton
            label="Copiar enlace"
            active={copied === "link"}
            onClick={copyLink}
            icon={<Link2 className="h-4 w-4" />}
            activeLabel="¡Copiado!"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        Código de invitación
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-base font-semibold tracking-widest text-zinc-100">
          {formatted}
        </span>
        <div className="flex gap-1.5">
          <CopyButton
            label="Copiar código"
            active={copied === "code"}
            onClick={copyCode}
            icon={<Copy className="h-3.5 w-3.5" />}
            activeLabel="OK"
            small
          />
          <CopyButton
            label="Copiar enlace"
            active={copied === "link"}
            onClick={copyLink}
            icon={<Link2 className="h-3.5 w-3.5" />}
            activeLabel="OK"
            small
          />
        </div>
      </div>
    </div>
  );
}

function CopyButton({
  label,
  activeLabel,
  active,
  onClick,
  icon,
  primary,
  small,
}: {
  label: string;
  activeLabel: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  primary?: boolean;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors ${
        small ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
      } ${
        primary
          ? "bg-rose-500 text-white hover:bg-rose-400"
          : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
      }`}
    >
      {active ? <Check className="h-3.5 w-3.5" /> : icon}
      {active ? activeLabel : label}
    </button>
  );
}
