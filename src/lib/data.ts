import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORIGINALS_BUCKET, previewUrl } from "@/lib/storage";
import type {
  CommentRow,
  RoomComment,
  FileRow,
  RoomFile,
  RoomRow,
  RoomStats,
} from "@/lib/types";

const VIDEO_URL_TTL_SECONDS = 60 * 60 * 6;

export function isRoomExpired(room: Pick<RoomRow, "expires_at">): boolean {
  return !!room.expires_at && new Date(room.expires_at).getTime() < Date.now();
}

export function isRoomOpen(room: RoomRow): boolean {
  return roomAvailability(room) === "live";
}

/** The effective client-link state. A live room may already have expired. */
export function roomAvailability(room: Pick<RoomRow, "status" | "expires_at">) {
  if (room.status !== "live") return room.status;
  return isRoomExpired(room) ? "expired" : "live";
}

// Wrapped in cache() so the page and its share-preview metadata share one query per request.
export const getRoomBySlug = cache(async (slug: string): Promise<RoomRow | null> => {
  const { data, error } = await supabaseAdmin()
    .from("rooms")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as RoomRow | null;
});

export async function getRoomById(id: string): Promise<RoomRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("rooms")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as RoomRow | null;
}

export const getFiles = cache(async (roomId: string): Promise<FileRow[]> => {
  const { data, error } = await supabaseAdmin()
    .from("files")
    .select("*")
    .eq("room_id", roomId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FileRow[];
});

export async function getComments(roomId: string): Promise<CommentRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("comments")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CommentRow[];
}

export async function countViews(roomId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("activity")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("type", "view");
  if (error) throw error;
  return count ?? 0;
}

export function computeStats(
  files: Pick<FileRow, "review_status">[],
  commentCount: number,
  views: number,
): RoomStats {
  const stats: RoomStats = { views, comments: commentCount, approved: 0, changes: 0, pending: 0 };
  for (const f of files) {
    if (f.review_status === "approved") stats.approved++;
    else if (f.review_status === "changes") stats.changes++;
    else stats.pending++;
  }
  return stats;
}

async function signedVideoUrls(files: FileRow[]): Promise<Map<string, string>> {
  const videos = files.filter((f) => f.kind === "video");
  const map = new Map<string, string>();
  if (videos.length === 0) return map;
  const { data, error } = await supabaseAdmin()
    .storage.from(ORIGINALS_BUCKET)
    .createSignedUrls(
      videos.map((v) => v.original_path),
      VIDEO_URL_TTL_SECONDS,
    );
  if (error) throw error;
  data?.forEach((d, i) => {
    if (d.signedUrl) map.set(videos[i].id, d.signedUrl);
  });
  return map;
}

/** Files the client sees: the newest version of each. */
export function currentFiles(files: FileRow[]): FileRow[] {
  return files.filter((f) => !f.replaced_by);
}

/** Whether the room's download and payment settings let the client save this file. */
export function canDownload(
  room: Pick<RoomRow, "downloads" | "payment_status">,
  file: Pick<FileRow, "review_status">,
): boolean {
  if (room.payment_status === "due") return false;
  if (room.downloads === "off") return false;
  if (room.downloads === "approved") return file.review_status === "approved";
  return true;
}

export function toRoomFiles(
  room: Pick<RoomRow, "downloads" | "payment_status">,
  files: FileRow[],
  comments: CommentRow[],
  videoUrls: Map<string, string>,
): RoomFile[] {
  const byFile = new Map<string, RoomComment[]>();
  for (const c of comments) {
    const list = byFile.get(c.file_id) ?? [];
    list.push({
      id: c.id,
      author: c.author_name,
      body: c.body,
      fromAgency: c.from_agency,
      createdAt: c.created_at,
      timecode: c.timecode ?? null,
    });
    byFile.set(c.file_id, list);
  }
  const replacedBy = new Map<string, FileRow>();
  for (const f of files) if (f.replaced_by) replacedBy.set(f.replaced_by, f);

  return currentFiles(files).map((f) => {
    const versions = [];
    let prev = replacedBy.get(f.id);
    const seen = new Set<string>([f.id]);
    while (prev && !seen.has(prev.id)) {
      seen.add(prev.id);
      versions.push({
        id: prev.id,
        version: prev.version ?? 1,
        thumbUrl: previewUrl(prev.thumb_path),
        previewUrl: previewUrl(prev.preview_path),
        posterUrl: previewUrl(prev.poster_path),
        videoUrl: videoUrls.get(prev.id) ?? null,
        status: prev.review_status,
        createdAt: prev.created_at,
        comments: byFile.get(prev.id) ?? [],
      });
      prev = replacedBy.get(prev.id);
    }
    return {
      id: f.id,
      kind: f.kind,
      fileName: f.file_name,
      caption: f.caption ?? null,
      category: f.category?.trim() || null,
      version: f.version ?? 1,
      versions,
      canDownload: canDownload(room, f),
      width: f.width,
      height: f.height,
      thumbUrl: previewUrl(f.thumb_path),
      previewUrl: previewUrl(f.preview_path),
      posterUrl: previewUrl(f.poster_path),
      videoUrl: videoUrls.get(f.id) ?? null,
      status: f.review_status,
      reviewedBy: f.reviewed_by,
      comments: byFile.get(f.id) ?? [],
    };
  });
}

/** Everything the delivery room or the admin room page needs, in one call. */
export async function loadRoomBundle(room: RoomRow) {
  const [files, comments, views] = await Promise.all([
    getFiles(room.id),
    getComments(room.id),
    countViews(room.id),
  ]);
  const videoUrls = await signedVideoUrls(files);
  const roomFiles = toRoomFiles(room, files, comments, videoUrls);
  const current = currentFiles(files);
  const currentIds = new Set(current.map((f) => f.id));
  const stats = computeStats(current, comments.filter((c) => currentIds.has(c.file_id)).length, views);
  const hero =
    roomFiles.find((f) => f.id === room.hero_file_id) ??
    roomFiles.find((f) => f.kind === "image") ??
    roomFiles[0] ??
    null;
  return { files: roomFiles, rawFiles: files, stats, hero };
}

export type RoomSummary = RoomRow & { stats: RoomStats; fileCount: number; coverUrl: string | null };

export async function listRoomsWithStats(): Promise<RoomSummary[]> {
  const db = supabaseAdmin();
  const [{ data: rooms, error }, { data: files, error: fErr }, { data: comments, error: cErr }, { data: views, error: vErr }] =
    await Promise.all([
      db.from("rooms").select("*").order("created_at", { ascending: false }),
      db.from("files").select("id, room_id, review_status, thumb_path, poster_path, kind, sort_order").is("replaced_by", null).order("sort_order"),
      db.from("comments").select("room_id"),
      db.from("activity").select("room_id").eq("type", "view"),
    ]);
  if (error) throw error;
  if (fErr) throw fErr;
  if (cErr) throw cErr;
  if (vErr) throw vErr;

  return ((rooms ?? []) as RoomRow[]).map((room) => {
    const roomFiles = (files ?? []).filter((f) => f.room_id === room.id);
    const commentCount = (comments ?? []).filter((c) => c.room_id === room.id).length;
    const viewCount = (views ?? []).filter((v) => v.room_id === room.id).length;
    const cover =
      roomFiles.find((f) => f.id === room.hero_file_id) ?? roomFiles[0] ?? null;
    return {
      ...room,
      fileCount: roomFiles.length,
      stats: computeStats(roomFiles, commentCount, viewCount),
      coverUrl: previewUrl(cover?.thumb_path ?? cover?.poster_path ?? null),
    };
  });
}
