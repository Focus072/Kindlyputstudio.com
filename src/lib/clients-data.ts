import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ClientRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string;
  last_seen_at: string | null;
};

export type ClientSummary = ClientRow & {
  roomCount: number;
  approvals: number;
  comments: number;
};

export async function listClients(): Promise<ClientSummary[]> {
  const db = supabaseAdmin();
  const [{ data: clients, error }, { data: links }, { data: activity }] = await Promise.all([
    db.from("clients").select("*").order("last_seen_at", { ascending: false, nullsFirst: false }),
    db.from("room_clients").select("client_id"),
    db.from("activity").select("client_id, type").in("type", ["approve", "comment"]).not("client_id", "is", null),
  ]);
  if (error) throw error;
  return ((clients ?? []) as ClientRow[]).map((c) => ({
    ...c,
    roomCount: (links ?? []).filter((l) => l.client_id === c.id).length,
    approvals: (activity ?? []).filter((a) => a.client_id === c.id && a.type === "approve").length,
    comments: (activity ?? []).filter((a) => a.client_id === c.id && a.type === "comment").length,
  }));
}

export async function getClientDetail(id: string) {
  const db = supabaseAdmin();
  const { data: client } = await db.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) return null;
  const [{ data: links }, { data: activity }] = await Promise.all([
    db
      .from("room_clients")
      .select("first_opened_at, last_opened_at, rooms(id, slug, title, client_name, status)")
      .eq("client_id", id)
      .order("last_opened_at", { ascending: false }),
    db
      .from("activity")
      .select("id, type, created_at, room_id, rooms(title), files(file_name)")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  type RoomRef = { id: string; slug: string; title: string; client_name: string; status: string };
  type Named = { title?: string; file_name?: string };
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
  return {
    client: client as ClientRow,
    rooms: (links ?? [])
      .map((l) => ({
        room: one(l.rooms as RoomRef | RoomRef[] | null),
        firstOpened: l.first_opened_at as string,
        lastOpened: l.last_opened_at as string,
      }))
      .filter((r) => r.room),
    activity: (activity ?? []).map((a) => ({
      id: a.id as string,
      type: a.type as string,
      at: a.created_at as string,
      roomId: (a.room_id as string | null) ?? null,
      room: one(a.rooms as Named | Named[] | null)?.title ?? null,
      file: one(a.files as Named | Named[] | null)?.file_name ?? null,
    })),
  };
}

/** Clients who have opened a given room (for the admin room page). */
export async function clientsForRoom(roomId: string) {
  const { data } = await supabaseAdmin()
    .from("room_clients")
    .select("last_opened_at, clients(id, full_name, email, avatar_url)")
    .eq("room_id", roomId)
    .order("last_opened_at", { ascending: false });
  type C = { id: string; full_name: string | null; email: string | null; avatar_url: string | null };
  return (data ?? [])
    .map((r) => ({
      client: (Array.isArray(r.clients) ? r.clients[0] : r.clients) as C | null,
      lastOpened: r.last_opened_at as string,
    }))
    .filter((r) => r.client);
}
