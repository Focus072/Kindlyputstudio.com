"use server";

import { isAdmin } from "@/lib/auth";
import { getClientUser, type ClientUser } from "@/lib/client-auth";
import { clientMayOpen } from "@/lib/access";
import { getRoomBySlug, isRoomOpen } from "@/lib/data";
import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ReviewStatus } from "@/lib/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const SIGN_IN = "Please sign in to your account first.";

/** The room, when it is live and this client is allowed in (or no client is given). */
async function openRoom(slug: string, client?: ClientUser | null) {
  const room = await getRoomBySlug(slug);
  if (!room || !isRoomOpen(room)) return null;
  if (client && !(await clientMayOpen(room, client))) return null;
  return room;
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

/** The signed-in client, or (when previewing) the studio itself. */
async function actor(): Promise<{ client: ClientUser | null; name: string } | null> {
  const client = await getClientUser();
  if (client) return { client, name: client.name };
  if (await isAdmin()) return { client: null, name: "Kindly Put Studio" };
  return null;
}

/** Counts one view per browser session. Studio visits are not counted. */
export async function recordView(slug: string): Promise<Result> {
  const client = await getClientUser();
  if (!client) return { ok: true };
  const room = await openRoom(slug, client);
  if (!room) return { ok: false, error: "Room not found." };
  await supabaseAdmin().from("activity").insert({
    room_id: room.id,
    type: "view",
    client_id: client.id,
    actor_name: client.name,
    viewer_id: client.id,
  });
  return { ok: true };
}

export async function setReview(input: { slug: string; fileId: string; status: ReviewStatus }): Promise<Result> {
  if (!["pending", "approved", "changes"].includes(input.status)) {
    return { ok: false, error: "Unknown status." };
  }
  const who = await actor();
  if (!who) return { ok: false, error: SIGN_IN };
  const room = await openRoom(input.slug, who.client);
  if (!room) return { ok: false, error: "This room is no longer available." };
  if (!(await fileInRoom(room.id, input.fileId))) return { ok: false, error: "File not found." };

  const status = input.status;
  const db = supabaseAdmin();
  const { error } = await db
    .from("files")
    .update({
      review_status: status,
      reviewed_by: status === "pending" ? null : who.name,
      reviewed_by_client: status === "pending" ? null : who.client?.id ?? null,
      reviewed_at: status === "pending" ? null : new Date().toISOString(),
    })
    .eq("id", input.fileId);
  if (error) return { ok: false, error: "Could not save. Please try again." };

  if (who.client) {
    await db.from("activity").insert({
      room_id: room.id,
      file_id: input.fileId,
      type: status === "approved" ? "approve" : status === "changes" ? "decline" : "reset",
      actor_name: who.name,
      client_id: who.client.id,
      viewer_id: who.client.id,
    });
  }
  return { ok: true };
}

/**
 * "Approve the rest": approves every file in the list that nobody has reviewed yet.
 * Files already approved or marked for changes are left alone.
 */
export async function approveRemaining(input: { slug: string; fileIds: string[] }): Promise<Result<{ approved: string[] }>> {
  const ids = Array.isArray(input.fileIds) ? [...new Set(input.fileIds.map(String))].slice(0, 500) : [];
  if (ids.length === 0) return { ok: true, data: { approved: [] } };
  const who = await actor();
  if (!who) return { ok: false, error: SIGN_IN };
  const room = await openRoom(input.slug, who.client);
  if (!room) return { ok: false, error: "This room is no longer available." };

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("files")
    .update({
      review_status: "approved",
      reviewed_by: who.name,
      reviewed_by_client: who.client?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("room_id", room.id)
    .eq("review_status", "pending")
    .is("replaced_by", null)
    .in("id", ids)
    .select("id");
  if (error) return { ok: false, error: "Could not save. Please try again." };
  const approved = (data ?? []).map((f) => f.id as string);

  if (who.client && approved.length > 0) {
    // One line in the studio's activity feed instead of one per file.
    const row = {
      room_id: room.id,
      file_id: approved.length === 1 ? approved[0] : null,
      type: "approve",
      actor_name: who.name,
      client_id: who.client.id,
      viewer_id: who.client.id,
    };
    const { error: logError } = await db.from("activity").insert({ ...row, meta: { count: approved.length } });
    // Databases without the activity.meta column (migration 0007) still get the line.
    if (logError) await db.from("activity").insert(row);
  }
  return { ok: true, data: { approved } };
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
  const who = await actor();
  if (!who) return { ok: false, error: SIGN_IN };
  if (who.client && !(await rateLimit(`comment:${who.client.id}`, 40, 600))) {
    return { ok: false, error: "That is a lot of comments at once. Please wait a few minutes." };
  }

  const room = await openRoom(input.slug, who.client);
  if (!room) return { ok: false, error: "This room is no longer available." };
  if (!(await fileInRoom(room.id, input.fileId))) return { ok: false, error: "File not found." };

  const fromAgency = !who.client;
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("comments")
    .insert({
      room_id: room.id,
      file_id: input.fileId,
      author_name: fromAgency ? room.delivered_by : who.name,
      body,
      from_agency: fromAgency,
      client_id: who.client?.id ?? null,
      timecode,
    })
    .select("id, created_at, author_name")
    .single();
  if (error || !data) return { ok: false, error: "Could not post. Please try again." };

  if (who.client) {
    await db.from("activity").insert({
      room_id: room.id,
      file_id: input.fileId,
      type: "comment",
      actor_name: who.name,
      client_id: who.client.id,
      viewer_id: who.client.id,
    });
  }
  return {
    ok: true,
    data: { id: data.id, createdAt: data.created_at, author: data.author_name, fromAgency, timecode },
  };
}

/** The client says they are done reviewing this round. The studio sees it in the activity feed. */
export async function submitFeedback(slug: string): Promise<Result<{ sentAt: string }>> {
  const client = await getClientUser();
  if (!client) return { ok: false, error: SIGN_IN };
  const room = await openRoom(slug, client);
  if (!room) return { ok: false, error: "This room is no longer available." };
  if (!(await rateLimit(`submit:${client.id}:${room.id}`, 5, 3600))) {
    return { ok: false, error: "Your feedback is already on its way." };
  }
  const sentAt = new Date().toISOString();
  const db = supabaseAdmin();
  await db.from("rooms").update({ feedback_sent_at: sentAt }).eq("id", room.id);
  await db.from("activity").insert({
    room_id: room.id,
    type: "submit",
    actor_name: client.name,
    client_id: client.id,
    viewer_id: client.id,
  });
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
