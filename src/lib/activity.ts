import "server-only";
import { getAdminSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ActivityItem = {
  id: string;
  type: "view" | "approve" | "decline" | "reset" | "comment" | "download" | "submit" | "access_request";
  actor: string | null;
  createdAt: string;
  roomId: string;
  roomTitle: string;
  fileName: string | null;
  /** Set when one action covered several files ("approved 8 files"). */
  count: number | null;
};

/** What clients did, newest first. Views are left out so the feed stays useful. */
export async function listActivity(limit = 60, opts: { includeViews?: boolean } = {}): Promise<ActivityItem[]> {
  let q = supabaseAdmin()
    .from("activity")
    .select("id, type, actor_name, created_at, room_id, meta, rooms(title), files(file_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!opts.includeViews) q = q.neq("type", "view").neq("type", "reset");
  const { data } = await q;
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
  return (data ?? []).map((a) => ({
    id: a.id as string,
    type: a.type as ActivityItem["type"],
    actor: (a.actor_name as string | null) ?? null,
    createdAt: a.created_at as string,
    roomId: a.room_id as string,
    roomTitle: one(a.rooms as { title: string } | { title: string }[] | null)?.title ?? "A room",
    fileName: one(a.files as { file_name: string } | { file_name: string }[] | null)?.file_name ?? null,
    count: Number((a.meta as { count?: number } | null)?.count) > 1 ? Number((a.meta as { count: number }).count) : null,
  }));
}

/** Count of client actions since this admin last opened the Activity tab. */
export async function unreadActivityCount(): Promise<number> {
  try {
    const session = await getAdminSession();
    if (!session) return 0;
    const db = supabaseAdmin();
    const { data: me } = await db.from("admin_users").select("activity_seen_at").eq("id", session.userId).maybeSingle();
    let q = db
      .from("activity")
      .select("id", { count: "exact", head: true })
      .in("type", ["approve", "decline", "comment", "submit", "access_request"]);
    if (me?.activity_seen_at) q = q.gt("created_at", me.activity_seen_at);
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function markActivitySeen() {
  const session = await getAdminSession();
  if (!session) return;
  await supabaseAdmin()
    .from("admin_users")
    .update({ activity_seen_at: new Date().toISOString() })
    .eq("id", session.userId);
}

export function describe(a: ActivityItem): string {
  const who = a.actor ?? "Someone";
  const file = a.fileName ? ` ${a.fileName}` : " a file";
  switch (a.type) {
    case "approve":
      return a.count ? `${who} approved ${a.count} files at once` : `${who} approved${file}`;
    case "decline":
      return `${who} asked for changes on${file}`;
    case "comment":
      return `${who} commented on${file}`;
    case "download":
      return a.fileName ? `${who} downloaded ${a.fileName}` : `${who} downloaded every file`;
    case "submit":
      return `${who} sent their feedback`;
    case "access_request":
      return `${who} asked to be let in`;
    case "view":
      return `${who} opened the room`;
    default:
      return `${who} reset a review`;
  }
}
