import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RoomRow } from "@/lib/types";

/**
 * Share links open a room without an account. The link carries a long random
 * key (/r/<slug>?key=...). The proxy moves that key into a cookie for the
 * room and drops it from the address bar, so the page, its actions and its
 * download routes all see it. Every request checks the key again, so revoking
 * or expiring a link locks it at once.
 */

export type ShareLink = {
  id: string;
  token: string;
  label: string | null;
  can_review: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  open_count: number;
  last_opened_at: string | null;
  created_at: string;
};

/** The guest who opened the room with a share link. */
export type ShareGuest = { linkId: string; name: string; canReview: boolean };

export const SHARE_PARAM = "key";

export function shareCookieName(slug: string) {
  return `kp_share_${slug}`;
}

export function newShareToken() {
  return randomBytes(24).toString("base64url");
}

export function isShareLinkLive(link: Pick<ShareLink, "revoked_at" | "expires_at">, now = Date.now()) {
  if (link.revoked_at) return false;
  return !link.expires_at || new Date(link.expires_at).getTime() > now;
}

/** The share link this browser holds for the room, when it is still live. */
export async function shareGuestFor(room: Pick<RoomRow, "id" | "slug">): Promise<ShareGuest | null> {
  const token = (await cookies()).get(shareCookieName(room.slug))?.value;
  if (!token || token.length < 20 || token.length > 100) return null;
  const { data } = await supabaseAdmin()
    .from("room_share_links")
    .select("id, label, can_review, expires_at, revoked_at")
    .eq("room_id", room.id)
    .eq("token", token)
    .maybeSingle();
  if (!data || !isShareLinkLive(data)) return null;
  return {
    linkId: data.id as string,
    name: ((data.label as string | null)?.trim() || "Guest").slice(0, 80),
    canReview: !!data.can_review,
  };
}

/** Counts an open of the room through this link. */
export async function noteShareOpen(linkId: string) {
  const db = supabaseAdmin();
  const { data } = await db.from("room_share_links").select("open_count").eq("id", linkId).maybeSingle();
  await db
    .from("room_share_links")
    .update({ open_count: ((data?.open_count as number | undefined) ?? 0) + 1, last_opened_at: new Date().toISOString() })
    .eq("id", linkId);
}

export async function listShareLinks(roomId: string): Promise<ShareLink[]> {
  const { data } = await supabaseAdmin()
    .from("room_share_links")
    .select("id, token, label, can_review, expires_at, revoked_at, open_count, last_opened_at, created_at")
    .eq("room_id", roomId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []) as ShareLink[];
}
