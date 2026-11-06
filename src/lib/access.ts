import "server-only";
import type { ClientUser } from "@/lib/client-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RoomRow } from "@/lib/types";

export function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 160;
}

/**
 * Whether this signed-in client may open the room. Rooms set to "link" let
 * anyone with an account in; "invited" rooms only let in emails on the guest list.
 */
export async function clientMayOpen(room: Pick<RoomRow, "id" | "access_mode">, client: ClientUser): Promise<boolean> {
  if (room.access_mode !== "invited") return true;
  const email = normalizeEmail(client.email);
  if (!email) return false;
  const { data } = await supabaseAdmin()
    .from("room_invites")
    .select("email")
    .eq("room_id", room.id)
    .eq("email", email)
    .maybeSingle();
  return !!data;
}

export async function listInvites(roomId: string): Promise<string[]> {
  const { data } = await supabaseAdmin()
    .from("room_invites")
    .select("email")
    .eq("room_id", roomId)
    .order("created_at");
  return (data ?? []).map((r) => r.email as string);
}

export type AccessRequest = {
  id: string;
  email: string | null;
  name: string | null;
  status: "pending" | "approved" | "denied";
  created_at: string;
};

export async function listAccessRequests(roomId: string): Promise<AccessRequest[]> {
  const { data } = await supabaseAdmin()
    .from("access_requests")
    .select("id, email, name, status, created_at")
    .eq("room_id", roomId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []) as AccessRequest[];
}

export async function myAccessRequest(roomId: string, clientId: string) {
  const { data } = await supabaseAdmin()
    .from("access_requests")
    .select("status")
    .eq("room_id", roomId)
    .eq("client_id", clientId)
    .maybeSingle();
  return (data?.status as AccessRequest["status"] | undefined) ?? null;
}
