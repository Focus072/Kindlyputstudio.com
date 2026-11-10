"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { brand } from "@/config/brand";
import { getTheme, isHex } from "@/config/themes";
import { isEmail, normalizeEmail } from "@/lib/access";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { randomFileKey, roomSlug } from "@/lib/slug";
import { newShareToken } from "@/lib/share-links";
import { supabasePublicConfig } from "@/lib/env";
import { ORIGINALS_BUCKET, PREVIEWS_BUCKET } from "@/lib/storage";

type FormState = { error?: string; ok?: boolean; warning?: string } | undefined;

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
  const layout = text(formData, "layout", 10);
  const downloads = text(formData, "downloads", 10);
  const paymentStatus = text(formData, "payment_status", 10);
  const paymentRaw = text(formData, "payment_url", 500);
  let paymentUrl: string | null = null;
  try {
    if (paymentRaw) {
      const u = new URL(/^https?:\/\//i.test(paymentRaw) ? paymentRaw : `https://${paymentRaw}`);
      if (u.protocol === "https:" || u.protocol === "http:") paymentUrl = u.toString();
    }
  } catch {
    paymentUrl = null;
  }
  return {
    layout: layout === "natural" ? "natural" : "grid",
    downloads: ["on", "approved", "off"].includes(downloads) ? downloads : "on",
    watermark: formData.get("watermark") === "on",
    paymentUrl,
    paymentStatus: ["none", "due", "paid"].includes(paymentStatus) ? paymentStatus : "none",
    intro: text(formData, "intro", 600) || null,
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
      intro: f.intro,
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
      layout: f.layout,
      downloads: f.downloads,
      watermark: f.watermark,
      payment_url: f.paymentUrl,
      payment_status: f.paymentStatus,
      intro: f.intro,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath("/admin");
  revalidatePath("/");
  if (f.paymentStatus === "due" && !f.paymentUrl) {
    return { ok: true, warning: "Saved. Add a payment link so the client has a way to pay." };
  }
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
  original: { path: string; url: string; token: string; bucket: string };
  /** Resumable (TUS) upload endpoint and the public key it needs. */
  resumable: { endpoint: string; apiKey: string };
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
    return { path, url: data.signedUrl, token: data.token, bucket };
  }

  const isVideo = file.kind === "video";
  const [original, preview, thumb, poster] = await Promise.all([
    sign(ORIGINALS_BUCKET, p.original),
    file.withPreviews && !isVideo ? sign(PREVIEWS_BUCKET, p.preview) : null,
    file.withPreviews ? sign(PREVIEWS_BUCKET, p.thumb) : null,
    file.withPreviews && isVideo ? sign(PREVIEWS_BUCKET, p.poster) : null,
  ]);
  const { url, key: apiKey } = supabasePublicConfig();
  // Large uploads go faster on the direct storage host (project.storage.supabase.co).
  const direct = url.replace(/^https:\/\/([a-z0-9]+)\.supabase\.co$/, "https://$1.storage.supabase.co");
  return { key, original, preview, thumb, poster, resumable: { endpoint: `${direct}/storage/v1/upload/resumable`, apiKey } };
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
    /** Upload this as a new version of an existing file. */
    replaceOf?: string | null;
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

  const { data: previous } = input.replaceOf
    ? await db
        .from("files")
        .select("id, sort_order, version, category, caption")
        .eq("id", input.replaceOf)
        .eq("room_id", roomId)
        .is("replaced_by", null)
        .maybeSingle()
    : { data: null };

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
      sort_order: previous ? previous.sort_order : (last?.sort_order ?? -1) + 1,
      version: previous ? (previous.version ?? 1) + 1 : 1,
      category: previous?.category ?? null,
      caption: previous?.caption ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (previous) {
    await db.from("files").update({ replaced_by: data.id }).eq("id", previous.id);
    // A new version starts a fresh review round.
    await db.from("rooms").update({ hero_file_id: data.id }).eq("id", roomId).eq("hero_file_id", previous.id);
    return { id: data.id as string };
  }

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
    .is("replaced_by", null)
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

export async function updateFileDetails(roomId: string, fileId: string, input: { caption?: string | null; category?: string | null }) {
  await requireAdmin();
  const patch: Record<string, string | null> = {};
  if (input.caption !== undefined) patch.caption = String(input.caption ?? "").trim().slice(0, 500) || null;
  if (input.category !== undefined) patch.category = String(input.category ?? "").trim().slice(0, 40) || null;
  await supabaseAdmin().from("files").update(patch).eq("id", fileId).eq("room_id", roomId);
  revalidatePath(`/admin/rooms/${roomId}`);
}

/** Saves a new order for the room's files (drag and drop). */
export async function reorderFiles(roomId: string, orderedIds: string[]) {
  await requireAdmin();
  const db = supabaseAdmin();
  const { data: files } = await db.from("files").select("id, sort_order").eq("room_id", roomId).is("replaced_by", null);
  if (!files) return;
  const known = new Set(files.map((f) => f.id));
  const ids = orderedIds.filter((id) => known.has(id));
  for (const f of files) if (!ids.includes(f.id)) ids.push(f.id);
  const current = new Map(files.map((f) => [f.id, f.sort_order]));
  await Promise.all(
    ids.map((id, index) => (current.get(id) === index ? null : db.from("files").update({ sort_order: index }).eq("id", id))),
  );
  revalidatePath(`/admin/rooms/${roomId}`);
}

/** Bulk actions on selected files. */
export async function bulkFiles(
  roomId: string,
  ids: string[],
  action: { type: "delete" } | { type: "reset" } | { type: "set"; category: string | null },
) {
  await requireAdmin();
  const list = ids.filter((id) => /^[0-9a-f-]{36}$/.test(id)).slice(0, 500);
  if (list.length === 0) return;
  const db = supabaseAdmin();
  if (action.type === "delete") {
    const { data: files } = await db
      .from("files")
      .select("id, original_path, preview_path, thumb_path, poster_path")
      .eq("room_id", roomId)
      .in("id", list);
    const originals = (files ?? []).map((f) => f.original_path);
    const previews = (files ?? []).flatMap((f) => [f.preview_path, f.thumb_path, f.poster_path]).filter(Boolean) as string[];
    if (originals.length) await db.storage.from(ORIGINALS_BUCKET).remove(originals);
    if (previews.length) await db.storage.from(PREVIEWS_BUCKET).remove(previews);
    await db.from("files").delete().eq("room_id", roomId).in("id", list);
  } else if (action.type === "reset") {
    await db
      .from("files")
      .update({ review_status: "pending", reviewed_by: null, reviewed_at: null, reviewed_by_client: null })
      .eq("room_id", roomId)
      .in("id", list);
  } else {
    const category = String(action.category ?? "").trim().slice(0, 40) || null;
    await db.from("files").update({ category }).eq("room_id", roomId).in("id", list);
  }
  revalidatePath(`/admin/rooms/${roomId}`);
}

// Guest list -------------------------------------------------------------------

export async function setAccessMode(roomId: string, mode: "link" | "invited") {
  await requireAdmin();
  const db = supabaseAdmin();
  if (mode === "invited") {
    // Nobody who already opened the room gets locked out by the switch.
    const { data: opened } = await db.from("room_clients").select("clients(email)").eq("room_id", roomId);
    const emails = [
      ...new Set(
        (opened ?? [])
          .flatMap((r) => (Array.isArray(r.clients) ? r.clients : [r.clients]))
          .map((c) => normalizeEmail((c as { email?: string | null } | null)?.email))
          .filter(isEmail),
      ),
    ];
    if (emails.length) {
      await db
        .from("room_invites")
        .upsert(emails.map((email) => ({ room_id: roomId, email })), { onConflict: "room_id,email", ignoreDuplicates: true });
    }
  }
  await db
    .from("rooms")
    .update({ access_mode: mode === "invited" ? "invited" : "link" })
    .eq("id", roomId);
  revalidatePath(`/admin/rooms/${roomId}`);
}

/** Adds one or more emails (comma, space, or line separated) to the guest list. */
export async function addInvites(roomId: string, raw: string): Promise<{ added: number; invalid: string[] }> {
  await requireAdmin();
  const parts = String(raw ?? "")
    .split(/[\s,;]+/)
    .map(normalizeEmail)
    .filter(Boolean)
    .slice(0, 200);
  const valid = [...new Set(parts.filter(isEmail))];
  const invalid = parts.filter((p) => !isEmail(p));
  if (valid.length) {
    await supabaseAdmin()
      .from("room_invites")
      .upsert(valid.map((email) => ({ room_id: roomId, email })), { onConflict: "room_id,email", ignoreDuplicates: true });
  }
  revalidatePath(`/admin/rooms/${roomId}`);
  return { added: valid.length, invalid };
}

export async function removeInvite(roomId: string, email: string) {
  await requireAdmin();
  await supabaseAdmin().from("room_invites").delete().eq("room_id", roomId).eq("email", normalizeEmail(email));
  revalidatePath(`/admin/rooms/${roomId}`);
}

export async function resolveAccessRequest(roomId: string, requestId: string, approve: boolean) {
  await requireAdmin();
  const db = supabaseAdmin();
  const { data: req } = await db
    .from("access_requests")
    .select("id, email")
    .eq("id", requestId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (!req) return;
  await db.from("access_requests").update({ status: approve ? "approved" : "denied" }).eq("id", req.id);
  const email = normalizeEmail(req.email);
  if (approve && email) {
    await db.from("room_invites").upsert({ room_id: roomId, email }, { onConflict: "room_id,email", ignoreDuplicates: true });
  }
  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath("/admin");
}

/* Share links: open the room without an account ----------------------------- */

const SHARE_EXPIRY_DAYS = [0, 1, 7, 30, 90] as const;

/** Makes a new no-account link for the room. Returns the path to hand out. */
export async function createShareLink(
  roomId: string,
  input: { label?: string; canReview?: boolean; expiresInDays?: number },
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  await requireAdmin();
  const { data: room } = await supabaseAdmin().from("rooms").select("id, slug").eq("id", roomId).maybeSingle();
  if (!room) return { ok: false, error: "Room not found." };
  const days = SHARE_EXPIRY_DAYS.includes(Number(input.expiresInDays) as (typeof SHARE_EXPIRY_DAYS)[number])
    ? Number(input.expiresInDays)
    : 0;
  const label = String(input.label ?? "").trim().slice(0, 80) || null;
  const token = newShareToken();
  const { error } = await supabaseAdmin()
    .from("room_share_links")
    .insert({
      room_id: roomId,
      token,
      label,
      can_review: input.canReview !== false,
      expires_at: days ? new Date(Date.now() + days * 86400_000).toISOString() : null,
    });
  if (error) return { ok: false, error: "Could not make the link. Please try again." };
  revalidatePath(`/admin/rooms/${roomId}`);
  return { ok: true, path: `/r/${room.slug}?key=${token}` };
}

/** Turns a share link off for good. Anyone holding it lands on the sign-up screen. */
export async function revokeShareLink(roomId: string, linkId: string) {
  await requireAdmin();
  await supabaseAdmin()
    .from("room_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("room_id", roomId);
  revalidatePath(`/admin/rooms/${roomId}`);
}
