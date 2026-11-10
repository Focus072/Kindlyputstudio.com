"use server";

import { isAdmin } from "@/lib/auth";
import { getClientUser, type ClientUser } from "@/lib/client-auth";
import { clientMayOpen } from "@/lib/access";
import { getRoomBySlug, isRoomOpen } from "@/lib/data";
import { rateLimit } from "@/lib/rate-limit";
import { shareGuestFor, type ShareGuest } from "@/lib/share-links";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ReviewStatus, RoomRow } from "@/lib/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const SIGN_IN = "Please sign in to your account first.";
const VIEW_ONLY = "This link is view only. Ask the studio if you want to leave feedback.";

type Who =
  | { kind: "client"; client: ClientUser; name: string }
  | { kind: "admin"; name: string }
  | { kind: "guest"; guest: ShareGuest; name: string };

/**
 * Who is acting in this room, and the room itself when they may. A signed-in
 * client on the guest list wins; otherwise a live share link lets them in.
 */
async function actorIn(slug: string): Promise<{ who: Who; room: RoomRow } | { error: string }> {
  const room = await getRoomBySlug(slug);
  if (!room || !isRoomOpen(room)) return { error: "This room is no longer available." };
  const client = await getClientUser();
  if (client && (await clientMayOpen(room, client))) return { who: { kind: "client", client, name: client.name }, room };
  if (!client && (await isAdmin())) return { who: { kind: "admin", name: "Kindly Put Studio" }, room };
  const guest = await shareGuestFor(room);
  if (guest) return { who: { kind: "guest", guest, name: guest.name }, room };
  return { error: client ? "This room is no longer available." : SIGN_IN };
}

/** The activity columns that say who did something. */
function actorColumns(who: Who) {
  if (who.kind === "client") return { actor_name: who.name, client_id: who.client.id, viewer_id: who.client.id };
  if (who.kind === "guest") return { actor_name: `${who.name} (guest link)`, client_id: null, viewer_id: `share:${who.guest.linkId}` };
  return null;
}

async function fileInRoom(roomId: string, fileId: string) {
  const { data } = await supabaseAdmin()
    .from("files")
    .select("id")
    .eq("id", fileId)
    .eq("room_id", roomId)
    .is("replaced_by", null)
    .maybeSingle();
  return !!data;
}

/** Counts one view per browser session. Studio visits are not counted. */
export async function recordView(slug: string): Promise<Result> {
  const res = await actorIn(slug);
  if ("error" in res) return { ok: true };
  const cols = actorColumns(res.who);
  if (!cols) return { ok: true };
  await supabaseAdmin().from("activity").insert({ room_id: res.room.id, type: "view", ...cols });
  return { ok: true };
}

export async function setReview(input: { slug: string; fileId: string; status: ReviewStatus }): Promise<Result> {
  if (!["pending", "approved", "changes"].includes(input.status)) {
    return { ok: false, error: "Unknown status." };
  }
  const res = await actorIn(input.slug);
  if ("error" in res) return { ok: false, error: res.error };
  const { who, room } = res;
  if (who.kind === "guest" && !who.guest.canReview) return { ok: false, error: VIEW_ONLY };
  if (who.kind === "guest" && !(await rateLimit(`review:share:${who.guest.linkId}`, 400, 600))) {
    return { ok: false, error: "That is a lot at once. Please wait a few minutes." };
  }
  if (!(await fileInRoom(room.id, input.fileId))) return { ok: false, error: "File not found." };

  const status = input.status;
  const db = supabaseAdmin();
  const { error } = await db
    .from("files")
    .update({
      review_status: status,
      reviewed_by: status === "pending" ? null : who.name,
      reviewed_by_client: status === "pending" || who.kind !== "client" ? null : who.client.id,
      reviewed_at: status === "pending" ? null : new Date().toISOString(),
    })
    .eq("id", input.fileId);
  if (error) return { ok: false, error: "Could not save. Please try again." };

  const cols = actorColumns(who);
  if (cols) {
    await db.from("activity").insert({
      room_id: room.id,
      file_id: input.fileId,
      type: status === "approved" ? "approve" : status === "changes" ? "decline" : "reset",
      ...cols,
    });
  }
  return { ok: true };
}

export async function addComment(input: {
  slug: string;
  fileId: string;
  body: string;
  /** Seconds into a video. */
  timecode?: number | null;
}): Promise<Result<{ id: string; createdAt: string; author: string; fromAgency: boolean; timecode: number | null }>> {
  const body = String(input.body ?? "").trim().slice(0, 2000);
  if (!body) return { ok: false, error: "Write a comment first." };
  const tc = Number(input.timecode);
  const timecode = input.timecode != null && Number.isFinite(tc) && tc >= 0 && tc < 86400 ? Math.round(tc * 10) / 10 : null;
  const res = await actorIn(input.slug);
  if ("error" in res) return { ok: false, error: res.error };
  const { who, room } = res;
  if (who.kind === "guest" && !who.guest.canReview) return { ok: false, error: VIEW_ONLY };
  const limitKey = who.kind === "client" ? who.client.id : who.kind === "guest" ? `share:${who.guest.linkId}` : null;
  if (limitKey && !(await rateLimit(`comment:${limitKey}`, 40, 600))) {
    return { ok: false, error: "That is a lot of comments at once. Please wait a few minutes." };
  }
  if (!(await fileInRoom(room.id, input.fileId))) return { ok: false, error: "File not found." };

  const fromAgency = who.kind === "admin";
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("comments")
    .insert({
      room_id: room.id,
      file_id: input.fileId,
      author_name: fromAgency ? room.delivered_by : who.name,
      body,
      from_agency: fromAgency,
      client_id: who.kind === "client" ? who.client.id : null,
      timecode,
    })
    .select("id, created_at, author_name")
    .single();
  if (error || !data) return { ok: false, error: "Could not post. Please try again." };

  const cols = actorColumns(who);
  if (cols) {
    await db.from("activity").insert({ room_id: room.id, file_id: input.fileId, type: "comment", ...cols });
  }
  return {
    ok: true,
    data: { id: data.id, createdAt: data.created_at, author: data.author_name, fromAgency, timecode },
  };
}

/** The client says they are done reviewing this round. The studio sees it in the activity feed. */
export async function submitFeedback(slug: string): Promise<Result<{ sentAt: string }>> {
  const res = await actorIn(slug);
  if ("error" in res) return { ok: false, error: res.error };
  const { who, room } = res;
  const cols = actorColumns(who);
  if (!cols) return { ok: false, error: SIGN_IN };
  if (who.kind === "guest" && !who.guest.canReview) return { ok: false, error: VIEW_ONLY };
  if (!(await rateLimit(`submit:${cols.viewer_id}:${room.id}`, 5, 3600))) {
    return { ok: false, error: "Your feedback is already on its way." };
  }
  const sentAt = new Date().toISOString();
  const db = supabaseAdmin();
  await db.from("rooms").update({ feedback_sent_at: sentAt }).eq("id", room.id);
  await db.from("activity").insert({ room_id: room.id, type: "submit", ...cols });
  return { ok: true, data: { sentAt } };
}

/** Signed in, but not on the room's guest list: ask the studio to let them in. */
export async function requestAccess(slug: string): Promise<Result> {
  const client = await getClientUser();
  if (!client) return { ok: false, error: SIGN_IN };
  const room = await getRoomBySlug(slug);
  if (!room || !isRoomOpen(room)) return { ok: false, error: "This room is no longer available." };
  if (!(await rateLimit(`access:${client.id}`, 10, 3600))) return { ok: false, error: "Request already sent." };
  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("access_requests")
    .select("id, status")
    .eq("room_id", room.id)
    .eq("client_id", client.id)
    .maybeSingle();
  if (existing) {
    if (existing.status === "denied") return { ok: false, error: "The studio has not opened this room to you." };
    return { ok: true };
  }
  await db.from("access_requests").insert({
    room_id: room.id,
    client_id: client.id,
    email: client.email,
    name: client.name,
  });
  await db.from("activity").insert({
    room_id: room.id,
    type: "access_request",
    actor_name: client.name,
    client_id: client.id,
  });
  return { ok: true };
}
