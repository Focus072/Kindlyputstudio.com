import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ClientProfile, ClientNote } from "@/lib/client-profile-types";

export type { ClientProfile, ClientNote } from "@/lib/client-profile-types";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

function normalize(row: Record<string, unknown>): ClientProfile {
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    status: ((row.status as string) ?? "active") as ClientProfile["status"],
    industry: (row.industry as string) ?? null,
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    website: (row.website as string) ?? null,
    address: (row.address as string) ?? null,
    socials: (row.socials && typeof row.socials === "object" ? row.socials : {}) as Record<string, string>,
    contacts: arr(row.contacts),
    package: (row.package as string) ?? null,
    monthly_rate: row.monthly_rate == null ? null : Number(row.monthly_rate),
    billing_notes: (row.billing_notes as string) ?? null,
    client_since: (row.client_since as string) ?? null,
    renews_on: (row.renews_on as string) ?? null,
    dates: arr(row.dates),
    brand_notes: (row.brand_notes as string) ?? null,
    drive_url: (row.drive_url as string) ?? null,
    notes: (row.notes as string) ?? null,
    share_token: (row.share_token as string) ?? null,
    created_at: row.created_at as string,
  };
}

/** True when the client-profile database update (0009) has been applied. */
export async function profilesReady() {
  const { error } = await supabaseAdmin().from("client_notes").select("id", { head: true, count: "exact" }).limit(1);
  return !error;
}

export async function listClientProfiles(): Promise<ClientProfile[]> {
  const { data } = await supabaseAdmin().from("calendar_clients").select("*").order("name");
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

export async function getClientProfile(id: string): Promise<ClientProfile | null> {
  const { data } = await supabaseAdmin().from("calendar_clients").select("*").eq("id", id).maybeSingle();
  return data ? normalize(data as Record<string, unknown>) : null;
}

export async function listClientNotes(clientId: string): Promise<ClientNote[]> {
  const { data } = await supabaseAdmin()
    .from("client_notes")
    .select("id, body, author, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as ClientNote[];
}

/** Rooms belong to a client when "Prepared for" matches the client's name. */
export function sameName(a: string | null | undefined, b: string | null | undefined) {
  const n = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return !!a && n(a) === n(b);
}

/** People with a login who opened any of these rooms. */
export async function loginsForRooms(roomIds: string[]) {
  if (!roomIds.length) return [];
  const { data } = await supabaseAdmin()
    .from("room_clients")
    .select("last_opened_at, clients(id, full_name, email, avatar_url)")
    .in("room_id", roomIds)
    .order("last_opened_at", { ascending: false });
  type C = { id: string; full_name: string | null; email: string | null; avatar_url: string | null };
  const seen = new Map<string, C & { lastOpened: string }>();
  for (const row of data ?? []) {
    const c = one(row.clients as C | C[] | null);
    if (c && !seen.has(c.id)) seen.set(c.id, { ...c, lastOpened: row.last_opened_at as string });
  }
  return [...seen.values()];
}

/** Buffer channels (social accounts) assigned to each client. */
export async function channelsByClient() {
  const { data } = await supabaseAdmin().from("buffer_channels").select("id, name, service, avatar, client_id, removed_at");
  const map = new Map<string, { id: string; name: string; service: string; avatar: string | null }[]>();
  for (const c of data ?? []) {
    if (!c.client_id || c.removed_at) continue;
    const list = map.get(c.client_id as string) ?? [];
    list.push({ id: c.id as string, name: c.name as string, service: c.service as string, avatar: (c.avatar as string) ?? null });
    map.set(c.client_id as string, list);
  }
  return map;
}
