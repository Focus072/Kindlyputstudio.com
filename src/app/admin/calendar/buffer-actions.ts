"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  type BufferAssetInput,
  BufferError,
  type CreatePostInput,
  createBufferPost,
  deleteBufferPost,
  editBufferPost,
  getBufferKey,
} from "@/lib/buffer";
import { CAPTION_LIMIT, SWATCHES, platformInfo } from "@/lib/calendar";
import { studioToUtc, timeInput } from "@/lib/calendar-time";
import { PREVIEWS_BUCKET, previewUrl } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f-]{36}$/;

function refresh() {
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/calendar/settings");
}

async function bufferKey() {
  const key = await getBufferKey();
  if (!key) throw new BufferError("Connect Buffer in calendar settings first.");
  return key.key;
}

function message(e: unknown) {
  return e instanceof BufferError ? e.message : "Something went wrong. Try again.";
}

// Media ----------------------------------------------------------------------

/**
 * A one-time upload link for a photo or video going out to social. Files land
 * in the public previews bucket so Buffer and the networks can fetch them.
 */
export async function createSocialUpload(name: string, contentType: string): Promise<{ uploadUrl: string; publicUrl: string } | { error: string }> {
  await requireAdmin();
  if (!/^(image|video)\//.test(contentType)) return { error: "Only photos and videos can be posted." };
  const ext = (name.split(".").pop() || (contentType.startsWith("video") ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  const path = `social/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin().storage.from(PREVIEWS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "Couldn't start the upload." };
  return { uploadUrl: data.signedUrl, publicUrl: previewUrl(path)! };
}

// Creating posts -------------------------------------------------------------

export type ComposerMedia = { url: string; isVideo: boolean };

export type ComposerPayload = {
  channelIds: string[];
  text: string;
  media: ComposerMedia[];
  when: "schedule" | "queue" | "now" | "draft";
  date?: string;
  time?: string;
  instagram?: { type: "post" | "reel" | "story"; shareToFeed: boolean; firstComment?: string };
  facebook?: { type: "post" | "reel" | "story"; firstComment?: string };
  google?: { button: string; link?: string };
  youtube?: { title: string };
  tiktok?: { title?: string };
};

export type ChannelResult = { channelId: string; name: string; ok: boolean; error?: string };

function assetsFor(media: ComposerMedia[]): BufferAssetInput[] {
  return media.map((m) => (m.isVideo ? { video: { url: m.url } } : { image: { url: m.url } }));
}

function metadataFor(service: string, p: ComposerPayload): { metadata?: Record<string, unknown>; error?: string } {
  const hasMedia = p.media.length > 0;
  const hasVideo = p.media.some((m) => m.isVideo);
  switch (service) {
    case "instagram": {
      if (!hasMedia) return { error: "Instagram needs a photo or video." };
      const type = p.instagram?.type ?? (hasVideo ? "reel" : "post");
      const ig: Record<string, unknown> = { type, shouldShareToFeed: type === "story" ? false : (p.instagram?.shareToFeed ?? true) };
      if (p.instagram?.firstComment?.trim() && type !== "story") ig.firstComment = p.instagram.firstComment.trim();
      return { metadata: { instagram: ig } };
    }
    case "facebook": {
      const type = p.facebook?.type ?? "post";
      if (type !== "post" && !hasMedia) return { error: "Facebook reels and stories need a photo or video." };
      const fb: Record<string, unknown> = { type };
      if (p.facebook?.firstComment?.trim()) fb.firstComment = p.facebook.firstComment.trim();
      return { metadata: { facebook: fb } };
    }
    case "googlebusiness": {
      const button = p.google?.button ?? "none";
      const link = p.google?.link?.trim();
      if (button !== "none" && button !== "call" && !link) return { error: "Google Business buttons need a link." };
      const google: Record<string, unknown> = { type: "whats_new" };
      if (button !== "none") google.detailsWhatsNew = { button, ...(link ? { link } : {}) };
      return { metadata: { google } };
    }
    case "tiktok":
      if (!hasMedia) return { error: "TikTok needs a photo or video." };
      return p.tiktok?.title?.trim() ? { metadata: { tiktok: { title: p.tiktok.title.trim() } } } : {};
    case "youtube":
      if (!hasVideo) return { error: "YouTube needs a video." };
      if (!p.youtube?.title?.trim()) return { error: "YouTube needs a title." };
      return { metadata: { youtube: { title: p.youtube.title.trim().slice(0, 100), categoryId: "22" } } };
    case "pinterest":
      return { error: "Pinterest needs a board, which this calendar can't pick yet. Post this one in Buffer." };
    default:
      return {};
  }
}

function scheduleFields(p: Pick<ComposerPayload, "when" | "date" | "time">): { fields?: Pick<CreatePostInput, "mode" | "dueAt" | "saveToDraft">; error?: string } {
  if (p.when === "now") return { fields: { mode: "shareNow" } };
  if (p.when === "queue") return { fields: { mode: "addToQueue" } };
  if (p.when === "draft") return { fields: { mode: "addToQueue", saveToDraft: true } };
  if (!p.date || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !p.time || !/^\d{2}:\d{2}$/.test(p.time)) return { error: "Pick a date and time." };
  const at = studioToUtc(p.date, p.time);
  if (at.getTime() < Date.now() + 60_000) return { error: "That time has already passed. Pick a later time or post now." };
  return { fields: { mode: "customScheduled", dueAt: at.toISOString() } };
}

/** Sends one post to each chosen Buffer channel. */
export async function publishPosts(p: ComposerPayload): Promise<{ error?: string; results?: ChannelResult[] }> {
  await requireAdmin();
  let key: string;
  try {
    key = await bufferKey();
  } catch (e) {
    return { error: message(e) };
  }
  const ids = [...new Set((p.channelIds ?? []).filter((x) => typeof x === "string"))].slice(0, 30);
  if (!ids.length) return { error: "Pick at least one account to post to." };
  const text = String(p.text ?? "").slice(0, 63206);
  const media = (p.media ?? []).filter((m) => typeof m?.url === "string" && m.url.startsWith("https://")).slice(0, 10);
  if (!text.trim() && !media.length) return { error: "Write a caption or add a photo or video." };
  if (media.filter((m) => m.isVideo).length > 1 || (media.some((m) => m.isVideo) && media.length > 1)) return { error: "Use one video, or up to 10 photos." };
  const when = scheduleFields(p);
  if (when.error) return { error: when.error };

  const { data: rows } = await supabaseAdmin().from("buffer_channels").select("id, name, service").in("id", ids);
  const channels = (rows ?? []) as { id: string; name: string; service: string }[];
  if (!channels.length) return { error: "Those accounts weren't found. Refresh channels in settings." };

  const payload = { ...p, text, media };
  const results = await Promise.all(
    channels.map(async (ch): Promise<ChannelResult> => {
      const service = platformInfo(ch.service).id;
      const limit = CAPTION_LIMIT[service];
      if (limit && text.length > limit) return { channelId: ch.id, name: ch.name, ok: false, error: `Caption is over ${platformInfo(service).label}'s ${limit} characters.` };
      const meta = metadataFor(service, payload);
      if (meta.error) return { channelId: ch.id, name: ch.name, ok: false, error: meta.error };
      try {
        await createBufferPost(key, {
          channelId: ch.id,
          text,
          schedulingType: "automatic",
          ...when.fields!,
          ...(media.length ? { assets: assetsFor(media) } : {}),
          ...(meta.metadata ? { metadata: meta.metadata } : {}),
        });
        return { channelId: ch.id, name: ch.name, ok: true };
      } catch (e) {
        return { channelId: ch.id, name: ch.name, ok: false, error: message(e) };
      }
    }),
  );
  if (results.some((r) => r.ok)) refresh();
  return { results };
}

// Changing posts -------------------------------------------------------------

export type EditPayload = {
  id: string;
  text: string;
  /** null keeps the post's current media. */
  media: ComposerMedia[] | null;
  when: "schedule" | "now" | "queue";
  date?: string;
  time?: string;
};

export async function updateBufferPost(p: EditPayload): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  try {
    const key = await bufferKey();
    if (typeof p.id !== "string" || !p.id) return { error: "Missing post." };
    const when = scheduleFields(p);
    if (when.error) return { error: when.error };
    await editBufferPost(key, {
      id: p.id,
      text: String(p.text ?? "").slice(0, 63206),
      mode: when.fields!.mode,
      ...(when.fields!.dueAt ? { dueAt: when.fields!.dueAt } : {}),
      ...(p.media ? { assets: assetsFor(p.media.filter((m) => m.url.startsWith("https://")).slice(0, 10)) } : {}),
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function removeBufferPost(id: string): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  try {
    if (typeof id !== "string" || !id) return { error: "Missing post." };
    await deleteBufferPost(await bufferKey(), id);
    refresh();
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

/** Drag and drop: move a post to another day, keeping its time of day. */
export async function movePost(p: { source: "buffer" | "manual"; id: string; at: string; toDay: string }): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.toDay) || Number.isNaN(Date.parse(p.at))) return { error: "Pick a day." };
  const next = studioToUtc(p.toDay, timeInput(p.at));
  try {
    // Edits leave schedulingType out so Buffer keeps the post's publishing method.
    if (p.source === "manual") {
      if (!UUID.test(p.id)) return { error: "Missing post." };
      await supabaseAdmin().from("calendar_posts").update({ scheduled_at: next.toISOString(), updated_at: new Date().toISOString() }).eq("id", p.id);
    } else {
      if (next.getTime() < Date.now() + 60_000) return { error: "That day has already passed." };
      await editBufferPost(await bufferKey(), { id: p.id, mode: "customScheduled", dueAt: next.toISOString() });
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return { error: message(e) };
  }
}

// Setup ----------------------------------------------------------------------

function normalize(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function displayName(name: string) {
  const clean = name.replace(/[._]+/g, " ").trim();
  return clean.length > 1 && clean === clean.toLowerCase() ? clean.replace(/\b\w/g, (c) => c.toUpperCase()) : clean;
}

/**
 * One tap setup: makes a client for every channel without one. Channels whose
 * names start the same way (furnitureland + "Furniture Land") share a client.
 */
export async function clientsFromChannels(): Promise<{ error?: string; ok?: string }> {
  await requireAdmin();
  const db = supabaseAdmin();
  const [{ data: chans }, { data: existing }] = await Promise.all([
    db.from("buffer_channels").select("id, name, client_id").order("name"),
    db.from("calendar_clients").select("id, name, color"),
  ]);
  const open = (chans ?? []).filter((c) => !c.client_id) as { id: string; name: string }[];
  if (!open.length) return { ok: "Every channel already has a client." };

  const clients = (existing ?? []) as { id: string; name: string; color: string }[];
  const used = new Set(clients.map((c) => c.color.toLowerCase()));
  const groups: { name: string; key: string; channelIds: string[]; clientId?: string }[] = clients.map((c) => ({ name: c.name, key: normalize(c.name), channelIds: [], clientId: c.id }));

  // Shorter names first so "Furniture Land" claims "furniturelandbakersfield".
  for (const ch of [...open].sort((a, b) => normalize(a.name).length - normalize(b.name).length)) {
    const k = normalize(ch.name);
    const match = groups.find((g) => g.key.length >= 5 && (k.startsWith(g.key) || g.key.startsWith(k)));
    if (match) match.channelIds.push(ch.id);
    else groups.push({ name: displayName(ch.name), key: k, channelIds: [ch.id] });
  }

  let made = 0;
  for (const g of groups) {
    if (!g.channelIds.length) continue;
    if (!g.clientId) {
      const color = SWATCHES.find((s) => !used.has(s)) ?? SWATCHES[made % SWATCHES.length];
      used.add(color);
      const { data, error } = await db.from("calendar_clients").insert({ name: g.name.slice(0, 60), color }).select("id").single();
      if (error || !data) return { error: "Couldn't create clients." };
      g.clientId = data.id;
      made++;
    }
    await db.from("buffer_channels").update({ client_id: g.clientId }).in("id", g.channelIds);
  }
  refresh();
  return { ok: made ? `Created ${made} client${made === 1 ? "" : "s"}. Rename or recolor them any time.` : "Matched channels to your clients." };
}
