"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { initialsOf, type ChatMessage } from "@/lib/types";

export default function ChatSidebar({
  sessionId,
  userId,
  onClose,
}: {
  sessionId: string;
  userId: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef(createClient());

  // Historial + suscripción en tiempo real
  useEffect(() => {
    const supabase = supabaseRef.current;
    let active = true;

    supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (active && data) setMessages(data as ChatMessage[]);
      });

    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Autoscroll al último mensaje
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft("");

    const supabase = supabaseRef.current;
    const { data: userData } = await supabase.auth.getUser();
    const senderName =
      userData.user?.user_metadata?.display_name ??
      userData.user?.user_metadata?.full_name ??
      "Invitado";

    const { error } = await supabase.from("chat_messages").insert({
      session_id: sessionId,
      sender_id: userId,
      sender_name: senderName,
      body,
    });
    if (error) setDraft(body); // devolver el texto si falló
    setSending(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="font-semibold">Chat</h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800"
          aria-label="Cerrar chat"
        >
          ✕
        </button>
      </header>

      <div ref={listRef} className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-zinc-600">
            Sé el primero en escribir algo 👋
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {messages.map((m) => {
            const mine = m.sender_id === userId;
            return (
              <li key={m.id} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine && (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-[10px] font-bold text-rose-300">
                    {initialsOf(m.sender_name)}
                  </span>
                )}
                <div className={`max-w-[80%] ${mine ? "text-right" : ""}`}>
                  {!mine && (
                    <p className="text-xs font-medium text-zinc-400">{m.sender_name}</p>
                  )}
                  <p
                    className={`mt-0.5 inline-block rounded-2xl px-3 py-1.5 text-sm break-words ${
                      mine ? "bg-rose-500/90 text-white" : "bg-zinc-800"
                    }`}
                  >
                    {m.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-zinc-800 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribe un mensaje…"
          maxLength={1000}
          className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white hover:bg-rose-400 transition-colors disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
