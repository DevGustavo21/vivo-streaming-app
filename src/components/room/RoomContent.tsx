"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { createClient } from "@/lib/supabase/client";
import InviteCodeShare from "@/components/InviteCodeShare";
import type { ReactionEvent, ReactionKey, Session } from "@/lib/types";
import VideoGrid from "./VideoGrid";
import ControlsBar from "./ControlsBar";
import ChatSidebar from "./ChatSidebar";
import HostPanel from "./HostPanel";
import HostSettingsPanel from "./HostSettingsPanel";
import ReactionsOverlay from "./ReactionsOverlay";

export type SidebarView = "chat" | "panel" | "settings" | null;

export default function RoomContent({
  session,
  userId,
  isHost,
  onFinalizeForAll,
}: {
  session: Session;
  userId: string;
  isHost: boolean;
  onFinalizeForAll?: () => void;
}) {
  const room = useRoomContext();
  const [liveSession, setLiveSession] = useState(session);
  const [sidebar, setSidebar] = useState<SidebarView>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [showInviteBanner, setShowInviteBanner] = useState(false);
  const [inviteDismissed, setInviteDismissed] = useState(false);

  useEffect(() => {
    if (!isHost) return;
    const key = `showInvite:${session.invite_code}`;
    if (sessionStorage.getItem(key) === "1") {
      setShowInviteBanner(true);
      sessionStorage.removeItem(key);
    }
  }, [isHost, session.invite_code]);

  // Sincroniza ajustes de sesión (mute_on_entry, require_approval) en tiempo real
  useEffect(() => {
    setLiveSession(session);
  }, [session]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`session-settings:${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          setLiveSession((cur) => ({ ...cur, ...(payload.new as Session) }));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.id]);

  // Aviso al invitado cuando el host le habilita/revoca el micrófono
  useEffect(() => {
    if (isHost) return;

    function onPermissionsChanged() {
      const perms = room.localParticipant.permissions;
      if (!perms) return;
      const micAllowed =
        perms.canPublishSources.length === 0 ||
        perms.canPublishSources.includes(2); // TrackSource.MICROPHONE
      showToast(
        micAllowed
          ? "El anfitrión habilitó tu micrófono. Ya puedes hablar."
          : "El anfitrión silenció tu micrófono."
      );
    }
    room.on(RoomEvent.ParticipantPermissionsChanged, onPermissionsChanged);
    return () => {
      room.off(RoomEvent.ParticipantPermissionsChanged, onPermissionsChanged);
    };
  }, [room, isHost]);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  // --- Reacciones vía Supabase Broadcast (efímeras, sin tocar disco) ---
  const supabaseRef = useRef(createClient());
  const channelRef = useRef<ReturnType<
    (typeof supabaseRef.current)["channel"]
  > | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase.channel(`reactions:${session.id}`, {
      config: { broadcast: { self: true } },
    });
    channel
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        const evt = payload as ReactionEvent;
        setReactions((prev) => [...prev.slice(-30), evt]);
        setTimeout(
          () => setReactions((prev) => prev.filter((r) => r.id !== evt.id)),
          3000
        );
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [session.id]);

  const sendReaction = useCallback(
    (emoji: ReactionKey) => {
      // Throttle: máximo ~2 reacciones por segundo por usuario
      const now = Date.now();
      if (now - lastSentRef.current < 500) return;
      lastSentRef.current = now;
      channelRef.current?.send({
        type: "broadcast",
        event: "reaction",
        payload: {
          emoji,
          senderName: room.localParticipant.name ?? "Invitado",
          id: `${userId}-${now}`,
        } satisfies ReactionEvent,
      });
    },
    [room, userId]
  );

  function toggleSidebar(view: Exclude<SidebarView, null>) {
    setSidebar((cur) => (cur === view ? null : view));
    if (view === "chat") setUnreadChat(0);
  }

  return (
    <div className="relative flex min-h-0 flex-1">
      {/* Zona de video */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {isHost &&
          !inviteDismissed &&
          (showInviteBanner || liveSession.status === "live") && (
          <InviteCodeShare
            inviteCode={session.invite_code}
            variant="banner"
            onDismiss={() => setInviteDismissed(true)}
          />
        )}
        <div className="flex items-center justify-between px-4 py-2.5">
          <h1 className="truncate text-sm font-semibold text-zinc-300">
            {session.title}
            {isHost && (
              <span className="ml-2 text-xs font-normal text-amber-400/90">
                · Anfitrión
              </span>
            )}
          </h1>
          <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-medium text-rose-400">
            ● En vivo
          </span>
        </div>

        <div className="relative min-h-0 flex-1 px-2 pb-2 md:px-4">
          <VideoGrid />
          <ReactionsOverlay reactions={reactions} />
        </div>

        <ControlsBar
          isHost={isHost}
          sidebar={sidebar}
          unreadChat={unreadChat}
          onToggleChat={() => toggleSidebar("chat")}
          onTogglePanel={() => toggleSidebar("panel")}
          onToggleSettings={() => toggleSidebar("settings")}
          onReaction={sendReaction}
          onNotify={showToast}
          onFinalizeForAll={onFinalizeForAll}
        />
      </div>

      {/* Sidebar: chat o panel del host */}
      {sidebar && (
        <aside className="absolute inset-0 z-20 flex flex-col border-l border-zinc-800 bg-zinc-950 md:static md:w-80 md:shrink-0">
          {sidebar === "chat" ? (
            <ChatSidebar
              sessionId={session.id}
              userId={userId}
              onClose={() => setSidebar(null)}
            />
          ) : sidebar === "settings" && isHost ? (
            <HostSettingsPanel
              session={liveSession}
              onClose={() => setSidebar(null)}
              onUpdated={(patch) =>
                setLiveSession((cur) => ({ ...cur, ...patch }))
              }
            />
          ) : isHost ? (
            <HostPanel session={liveSession} onClose={() => setSidebar(null)} />
          ) : null}
        </aside>
      )}

      {/* Chat cerrado: contar no leídos */}
      {sidebar !== "chat" && (
        <ChatUnreadWatcher
          sessionId={session.id}
          userId={userId}
          onNew={() => setUnreadChat((n) => n + 1)}
        />
      )}

      {/* Toast de avisos */}
      {toast && (
        <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl bg-zinc-800 px-5 py-3 text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/** Escucha mensajes nuevos mientras el chat está cerrado */
function ChatUnreadWatcher({
  sessionId,
  userId,
  onNew,
}: {
  sessionId: string;
  userId: string;
  onNew: () => void;
}) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-unread:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if ((payload.new as { sender_id: string }).sender_id !== userId) {
            onNew();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, userId, onNew]);
  return null;
}
