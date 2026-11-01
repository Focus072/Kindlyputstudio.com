"use server";

import { isAdmin } from "@/lib/auth";
import { getRoomBySlug, isRoomOpen } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ReviewStatus } from "@/lib/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function cleanName(name: unknown): string {
  return String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
}

function cleanViewer(id: unknown): string | null {
  const v = String(id ?? "");
  return /^[a-zA-Z0-9-]{8,64}$/.test(v) ? v : null;
}

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

/** Counts one view per browser session. Your own admin visits are not counted. */
export async function recordView(slug: string, viewerId: string): Promise<Result> {
  const room = await openRoom(slug);
  if (!room) return { ok: false, error: "Room not found." };
  if (await isAdmin()) return { ok: true };
  await supabaseAdmin().from("activity").insert({
    room_id: room.id,
    type: "view",
    viewer_id: cleanViewer(viewerId),
  });
  return { ok: true };
}

export async function setReview(input: {
  slug: string;
  fileId: string;
  status: ReviewStatus;
  name: string;
  viewerId: string;
}): Promise<Result> {
  const status = input.status;
  if (!["pending", "approved", "changes"].includes(status)) {
    return { ok: false, error: "Unknown status." };
  }
  const room = await openRoom(input.slug);
  if (!room) return { ok: false, error: "This room is no longer available." };
  if (!(await fileInRoom(room.id, input.fileId))) return { ok: false, error: "File not found." };

  const name = cleanName(input.name) || "Client";
  const db = supabaseAdmin();
  const { error } = await db
    .from("files")
    .update({
      review_status: status,
      reviewed_by: status === "pending" ? null : name,
      reviewed_at: status === "pending" ? null : new Date().toISOString(),
    })
    .eq("id", input.fileId);
  if (error) return { ok: false, error: "Could not save. Please try again." };

  await db.from("activity").insert({
    room_id: room.id,
    file_id: input.fileId,
    type: status === "approved" ? "approve" : status === "changes" ? "decline" : "reset",
    actor_name: name,
    viewer_id: cleanViewer(input.viewerId),
  });
  return { ok: true };
}

export async function addComment(input: {
  slug: string;
  fileId: string;
  name: string;
  body: string;
  viewerId: string;
}): Promise<Result<{ id: string; createdAt: string }>> {
  const body = String(input.body ?? "").trim().slice(0, 2000);
  const name = cleanName(input.name);
  if (!body) return { ok: false, error: "Write a comment first." };
  if (!name) return { ok: false, error: "Add your name first." };

  const room = await openRoom(input.slug);
  if (!room) return { ok: false, error: "This room is no longer available." };
  if (!(await fileInRoom(room.id, input.fileId))) return { ok: false, error: "File not found." };

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("comments")
    .insert({ room_id: room.id, file_id: input.fileId, author_name: name, body })
    .select("id, created_at")
    .single();
  if (error || !data) return { ok: false, error: "Could not post. Please try again." };

  await db.from("activity").insert({
    room_id: room.id,
    file_id: input.fileId,
    type: "comment",
    actor_name: name,
    viewer_id: cleanViewer(input.viewerId),
  });
  return { ok: true, data: { id: data.id, createdAt: data.created_at } };
}
