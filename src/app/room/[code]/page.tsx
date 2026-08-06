import { createAdminClient, createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveInviteCodeParam } from "@/lib/invite";
import RoomAuthLoader from "@/components/room/RoomAuthLoader";
import RoomShell from "@/components/room/RoomShell";
import type { Session } from "@/lib/types";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = resolveInviteCodeParam(rawCode);

  if (rawCode !== code) {
    redirect(`/room/${code}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <RoomAuthLoader code={code} />;

  const admin = createAdminClient();
  const { data } = await admin
    .from("sessions")
    .select("*")
    .eq("invite_code", code)
    .single();

  const session = data as Session | null;
  if (!session) redirect("/");
  if (session.status === "ended") redirect(`/join/${code}`);

  return (
    <RoomShell
      session={session}
      userId={user.id}
      isHost={session.host_id === user.id}
    />
  );
}
