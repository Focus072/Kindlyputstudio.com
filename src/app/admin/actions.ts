"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { brand } from "@/config/brand";
import { getTheme, isHex } from "@/config/themes";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { randomFileKey, roomSlug } from "@/lib/slug";
import { ORIGINALS_BUCKET, PREVIEWS_BUCKET } from "@/lib/storage";

type FormState = { error?: string; ok?: boolean } | undefined;

function text(formData: FormData, key: string, max = 120) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function roomFields(formData: FormData) {
  const title = text(formData, "title", 80);
  const clientName = text(formData, "client_name", 60);
  const deliveredBy = text(formData, "delivered_by", 60) || brand.deliveredBy;
  const preset = getTheme(text(formData, "theme_preset", 30)).id;
  const accentRaw = text(formData, "accent_color", 7);
  const accent = isHex(accentRaw) && accentRaw.toLowerCase() !== getTheme(preset).accent.toLowerCase() ? accentRaw : null;
  const expiresRaw = text(formData, "expires_at", 30);
  const expiresAt = expiresRaw ? new Date(`${expiresRaw}T23:59:59`).toISOString() : null;
  const status = text(formData, "status", 10);
  return {
    title,
    clientName,
    deliveredBy,
    preset,
    accent,
    expiresAt,
    status: ["draft", "live", "archived"].includes(status) ? status : "live",
    showcase: formData.get("showcase") === "on",
  };
}

// Rooms ----------------------------------------------------------------------

export async function createRoom(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const f = roomFields(formData);
  if (!f.title) return { error: "Give the room a project title." };
  if (!f.clientName) return { error: "Add the client's name." };

  const slug = roomSlug(f.title);

  const { data, error } = await supabaseAdmin()
    .from("rooms")
    .insert({
      slug,
      title: f.title,
      client_name: f.clientName,
      delivered_by: f.deliveredBy,
      theme_preset: f.preset,
      accent_color: f.accent,
      expires_at: f.expiresAt,
      status: "live",
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Link clash, please press Create again." };
    return { error: error.message };
  }
  revalidatePath("/admin");
  redirect(`/admin/rooms/${data.id}`);
}

export async function updateRoom(roomId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const f = roomFields(formData);
  if (!f.title || !f.clientName) return { error: "Title and client name are required." };
  const { error } = await supabaseAdmin()
    .from("rooms")
    .update({
      title: f.title,
      client_name: f.clientName,
      delivered_by: f.deliveredBy,
      theme_preset: f.preset,
      accent_color: f.accent,
      expires_at: f.expiresAt,
      status: f.status,
      showcase: f.showcase,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

async function removeRoomStorage(roomId: string) {
  const db = supabaseAdmin();
  for (const bucket of [ORIGINALS_BUCKET, PREVIEWS_BUCKET]) {
    const { data: folders } = await db.storage.from(bucket).list(roomId, { limit: 1000 });
    for (const folder of folders ?? []) {
      const prefix = `${roomId}/${folder.name}`;
      const { data: objects } = await db.storage.from(bucket).list(prefix, { limit: 100 });
      const paths = (objects ?? []).map((o) => `${prefix}/${o.name}`);
      if (paths.length) await db.storage.from(bucket).remove(paths);
    }
  }
}

export async function deleteRoom(roomId: string) {
  await requireAdmin();
  await removeRoomStorage(roomId);
  await supabaseAdmin().from("rooms").delete().eq("id", roomId);
  revalidatePath("/admin");
  redirect("/admin");
}

// Uploads --------------------------------------------------------------------

export type UploadTarget = {
  key: string;
  original: { path: string; url: string };
  preview: { path: string; url: string } | null;
  thumb: { path: string; url: string } | null;
  poster: { path: string; url: string } | null;
};

function extension(name: string) {
  const m = /\.([a-zA-Z0-9]{1,8})$/.exec(name);
  return m ? m[1].toLowerCase() : "bin";
}

function pathsFor(roomId: string, key: string, ext: string) {
  const dir = `${roomId}/${key}`;
  return {
    original: `${dir}/original.${ext}`,
    preview: `${dir}/preview.webp`,
    thumb: `${dir}/thumb.webp`,
    poster: `${dir}/poster.webp`,
  };
}

/** One-time upload links so the browser sends files straight to Supabase Storage. */
export async function createUploadTarget(
  roomId: string,
  file: { name: string; kind: "image" | "video"; withPreviews: boolean },
): Promise<UploadTarget> {
  await requireAdmin();
  const key = randomFileKey();
  const p = pathsFor(roomId, key, extension(file.name));
  const db = supabaseAdmin();

  async function sign(bucket: string, path: string) {
    const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "Could not create upload link.");
    return { path, url: data.signedUrl };
  }

  const isVideo = file.kind === "video";
  const [original, preview, thumb, poster] = await Promise.all([
    sign(ORIGINALS_BUCKET, p.original),
    file.withPreviews && !isVideo ? sign(PREVIEWS_BUCKET, p.preview) : null,
    file.withPreviews ? sign(PREVIEWS_BUCKET, p.thumb) : null,
    file.withPreviews && isVideo ? sign(PREVIEWS_BUCKET, p.poster) : null,
  ]);
  return { key, original, preview, thumb, poster };
}

/** Saves the file record once its upload has finished. */
export async function registerFile(
  roomId: string,
  input: {
    key: string;
    name: string;
    mimeType: string;
    kind: "image" | "video";
    size: number;
    width: number | null;
    height: number | null;
    duration: number | null;
    hasPreview: boolean;
    hasThumb: boolean;
    hasPoster: boolean;
  },
) {
  await requireAdmin();
  if (!/^[a-z0-9]{16}$/.test(input.key)) throw new Error("Bad upload key.");
  const p = pathsFor(roomId, input.key, extension(input.name));
  const db = supabaseAdmin();

  const { data: last } = await db
    .from("files")
    .select("sort_order")
    .eq("room_id", roomId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await db
    .from("files")
    .insert({
      room_id: roomId,
      kind: input.kind,
      file_name: input.name.slice(0, 200),
      mime_type: input.mimeType.slice(0, 100) || "application/octet-stream",
      original_path: p.original,
      preview_path: input.hasPreview ? p.preview : null,
      thumb_path: input.hasThumb ? p.thumb : null,
      poster_path: input.hasPoster ? p.poster : null,
      width: input.width,
      height: input.height,
      duration: input.duration,
      size_bytes: input.size,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // The first photo becomes the hero until you pick another.
  const { data: room } = await db.from("rooms").select("hero_file_id").eq("id", roomId).single();
  if (room && !room.hero_file_id && input.kind === "image") {
    await db.from("rooms").update({ hero_file_id: data.id }).eq("id", roomId);
  }
  return { id: data.id as string };
}

export async function refreshRoom(roomId: string) {
  await requireAdmin();
  revalidatePath(`/admin/rooms/${roomId}`);
}

// Files ----------------------------------------------------------------------

export async function setHero(roomId: string, fileId: string) {
  await requireAdmin();
  await supabaseAdmin().from("rooms").update({ hero_file_id: fileId }).eq("id", roomId);
  revalidatePath(`/admin/rooms/${roomId}`);
}

export async function deleteFile(roomId: string, fileId: string) {
  await requireAdmin();
  const db = supabaseAdmin();
  const { data: file } = await db
    .from("files")
    .select("original_path, preview_path, thumb_path, poster_path")
    .eq("id", fileId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (!file) return;
  await db.storage.from(ORIGINALS_BUCKET).remove([file.original_path]);
  const previews = [file.preview_path, file.thumb_path, file.poster_path].filter(Boolean) as string[];
  if (previews.length) await db.storage.from(PREVIEWS_BUCKET).remove(previews);
  await db.from("files").delete().eq("id", fileId);
  revalidatePath(`/admin/rooms/${roomId}`);
}

export async function moveFile(roomId: string, fileId: string, direction: -1 | 1) {
  await requireAdmin();
  const db = supabaseAdmin();
  const { data: files } = await db
    .from("files")
    .select("id, sort_order")
    .eq("room_id", roomId)
    .order("sort_order")
    .order("created_at");
  if (!files) return;
  const i = files.findIndex((f) => f.id === fileId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= files.length) return;
  [files[i], files[j]] = [files[j], files[i]];
  await Promise.all(
    files.map((f, index) =>
      f.sort_order === index ? null : db.from("files").update({ sort_order: index }).eq("id", f.id),
    ),
  );
  revalidatePath(`/admin/rooms/${roomId}`);
}

export async function resetReview(roomId: string, fileId: string) {
  await requireAdmin();
  await supabaseAdmin()
    .from("files")
    .update({ review_status: "pending", reviewed_by: null, reviewed_at: null })
    .eq("id", fileId)
    .eq("room_id", roomId);
  revalidatePath(`/admin/rooms/${roomId}`);
}

export async function replyToComment(roomId: string, fileId: string, body: string) {
  await requireAdmin();
  const clean = body.trim().slice(0, 2000);
  if (!clean) return;
  const { data: room } = await supabaseAdmin().from("rooms").select("delivered_by").eq("id", roomId).single();
  await supabaseAdmin().from("comments").insert({
    room_id: roomId,
    file_id: fileId,
    author_name: room?.delivered_by ?? brand.deliveredBy,
    body: clean,
    from_agency: true,
  });
  revalidatePath(`/admin/rooms/${roomId}`);
}
