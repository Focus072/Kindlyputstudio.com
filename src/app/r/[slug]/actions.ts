"use server";

import { isAdmin } from "@/lib/auth";
import { getClientUser, type ClientUser } from "@/lib/client-auth";
import { getRoomBySlug, isRoomOpen } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ReviewStatus } from "@/lib/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const SIGN_IN = "Please sign in to your account first.";

async function openRoom(slug: string) {
  const room = await getRoomBySlug(slug);
  if (!room || !isRoomOpen(room)) return null;
  return room;
}

async function fileInRoom(roomId: string, fileId: string) {
  const { data } = await supabaseAdmin()
    .from("files")
    .select("id")
    .eq("id", fileId)
    .eq("room_id", roomId)
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
  const room = await openRoom(slug);
  if (!room) return { ok: false, error: "Room not found." };
  const client = await getClientUser();
  if (!client) return { ok: true };
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
  const room = await openRoom(input.slug);
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

export async function addComment(input: {
  slug: string;
  fileId: string;
  body: string;
}): Promise<Result<{ id: string; createdAt: string; author: string; fromAgency: boolean }>> {
  const body = String(input.body ?? "").trim().slice(0, 2000);
  if (!body) return { ok: false, error: "Write a comment first." };
  const who = await actor();
  if (!who) return { ok: false, error: SIGN_IN };

  const room = await openRoom(input.slug);
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
    data: { id: data.id, createdAt: data.created_at, author: data.author_name, fromAgency },
  };
}
