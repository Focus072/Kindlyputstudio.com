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
import { CAPTION_LIMIT, platformInfo } from "@/lib/calendar";
import { assignClients, syncBuffer } from "@/lib/calendar-sync";
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

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

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

// Shapes the composer sends ------------------------------------------------------

export type ComposerMedia = { url: string; isVideo: boolean; alt?: string; coverMs?: number | null };

export type NetworkOptions = {
  instagram?: { type: "post" | "reel" | "story"; shareToFeed: boolean; firstComment?: string; link?: string; ai?: boolean };
  facebook?: { type: "post" | "reel" | "story"; firstComment?: string };
  linkedin?: { firstComment?: string };
  google?: { type: "whats_new" | "offer" | "event"; button: string; link?: string; title?: string; start?: string; end?: string; code?: string; terms?: string };
  youtube?: { title: string; privacy: "public" | "unlisted" | "private"; categoryId: string; madeForKids: boolean; notify: boolean };
  tiktok?: { title?: string; ai?: boolean };
  pinterest?: { title?: string; link?: string };
};

export type ComposerPayload = {
  channelIds: string[];
  text: string;
  /** Caption written just for one network, by service id. */
  captions?: Record<string, string>;
  media: ComposerMedia[];
  when: "schedule" | "queue" | "now" | "draft";
  date?: string;
  time?: string;
  options: NetworkOptions;
  tagIds?: string[];
  /** Pinterest board per channel. */
  boards?: Record<string, string>;
};

export type ChannelResult = { channelId: string; name: string; ok: boolean; error?: string };

const COVER_SERVICES = new Set(["instagram", "tiktok", "pinterest"]);

/** Networks fetch media over https. Local test storage is plain http. */
function okUrl(u: string) {
  return u.startsWith("https://") || (process.env.NODE_ENV !== "production" && u.startsWith("http://127.0.0.1"));
}

function cleanMedia(list: unknown): ComposerMedia[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((m): m is ComposerMedia => !!m && typeof (m as ComposerMedia).url === "string" && okUrl((m as ComposerMedia).url))
    .slice(0, 10)
    .map((m) => ({ url: m.url, isVideo: !!m.isVideo, alt: str(m.alt, 1000) || undefined, coverMs: Number.isFinite(m.coverMs) && (m.coverMs as number) >= 0 ? Math.round(m.coverMs as number) : null }));
}

function assetsFor(media: ComposerMedia[], service: string): BufferAssetInput[] {
  return media.map((m) => {
    if (m.isVideo) {
      return m.coverMs != null && COVER_SERVICES.has(service) ? { video: { url: m.url, metadata: { thumbnailOffset: m.coverMs } } } : { video: { url: m.url } };
    }
    return m.alt ? { image: { url: m.url, metadata: { altText: m.alt } } } : { image: { url: m.url } };
  });
}

function dateIso(v: string | undefined) {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? studioToUtc(v, "00:00").toISOString() : null;
}

/** Buffer's per-network options for one channel, or the reason it can't go. */
function metadataFor(service: string, o: NetworkOptions, media: ComposerMedia[], boardId?: string): { metadata?: Record<string, unknown>; error?: string } {
  const hasMedia = media.length > 0;
  const hasVideo = media.some((m) => m.isVideo);
  switch (service) {
    case "instagram": {
      if (!hasMedia) return { error: "Instagram needs a photo or video." };
      const type = o.instagram?.type ?? (hasVideo ? "reel" : "post");
      if (type === "reel" && !hasVideo) return { error: "An Instagram reel needs a video." };
      const ig: Record<string, unknown> = { type, shouldShareToFeed: type === "story" ? false : (o.instagram?.shareToFeed ?? true) };
      if (type !== "story" && str(o.instagram?.firstComment, 2200)) ig.firstComment = str(o.instagram?.firstComment, 2200);
      if (type === "post" && /^https?:\/\//.test(str(o.instagram?.link))) ig.link = str(o.instagram?.link);
      if (o.instagram?.ai) ig.isAiGenerated = true;
      return { metadata: { instagram: ig } };
    }
    case "facebook": {
      const type = o.facebook?.type ?? "post";
      if (type !== "post" && !hasMedia) return { error: "Facebook reels and stories need a photo or video." };
      if (type === "reel" && !hasVideo) return { error: "A Facebook reel needs a video." };
      const fb: Record<string, unknown> = { type };
      if (str(o.facebook?.firstComment, 8000)) fb.firstComment = str(o.facebook?.firstComment, 8000);
      return { metadata: { facebook: fb } };
    }
    case "linkedin":
      return str(o.linkedin?.firstComment) ? { metadata: { linkedin: { firstComment: str(o.linkedin?.firstComment, 1250) } } } : {};
    case "googlebusiness": {
      const g = o.google ?? { type: "whats_new", button: "none" };
      const link = str(g.link);
      const button = ["book", "call", "learn_more", "none", "order", "shop", "signup"].includes(g.button) ? g.button : "none";
      if (g.type === "offer") {
        const title = str(g.title, 58);
        const start = dateIso(g.start);
        const end = dateIso(g.end);
        if (!title || !start || !end) return { error: "Google offers need a title, a start date and an end date." };
        const d: Record<string, unknown> = { title, startDate: start, endDate: end };
        if (str(g.code)) d.code = str(g.code, 58);
        if (str(g.terms)) d.terms = str(g.terms, 5000);
        if (link) d.link = link;
        return { metadata: { google: { type: "offer", title, detailsOffer: d } } };
      }
      if (g.type === "event") {
        const title = str(g.title, 58);
        const start = dateIso(g.start);
        const end = dateIso(g.end);
        if (!title || !start || !end) return { error: "Google events need a title, a start date and an end date." };
        if (button !== "none" && button !== "call" && !link) return { error: "Google Business buttons need a link." };
        const d: Record<string, unknown> = { title, startDate: start, endDate: end, isFullDayEvent: true, button };
        if (link) d.link = link;
        return { metadata: { google: { type: "event", title, detailsEvent: d } } };
      }
      if (button !== "none" && button !== "call" && !link) return { error: "Google Business buttons need a link." };
      const google: Record<string, unknown> = { type: "whats_new" };
      if (button !== "none") google.detailsWhatsNew = { button, ...(link ? { link } : {}) };
      return { metadata: { google } };
    }
    case "tiktok": {
      if (!hasMedia) return { error: "TikTok needs a photo or video." };
      const tt: Record<string, unknown> = {};
      if (!hasVideo && str(o.tiktok?.title)) tt.title = str(o.tiktok?.title, 90);
      if (hasVideo && o.tiktok?.ai) tt.isAiGenerated = true;
      return Object.keys(tt).length ? { metadata: { tiktok: tt } } : {};
    }
    case "youtube": {
      if (!hasVideo) return { error: "YouTube needs a video." };
      const y = o.youtube;
      if (!str(y?.title)) return { error: "YouTube needs a title." };
      return {
        metadata: {
          youtube: {
            title: str(y?.title, 100),
            categoryId: /^\d{1,2}$/.test(y?.categoryId ?? "") ? y!.categoryId : "22",
            privacy: ["public", "unlisted", "private"].includes(y?.privacy ?? "") ? y!.privacy : "public",
            madeForKids: !!y?.madeForKids,
            notifySubscribers: y?.notify ?? true,
          },
        },
      };
    }
    case "pinterest": {
      if (!hasMedia) return { error: "Pinterest needs a photo or video." };
      if (!boardId) return { error: "Pick a Pinterest board." };
      const pin: Record<string, unknown> = { boardServiceId: boardId };
      if (str(o.pinterest?.title)) pin.title = str(o.pinterest?.title, 100);
      if (/^https?:\/\//.test(str(o.pinterest?.link))) pin.url = str(o.pinterest?.link);
      return { metadata: { pinterest: pin } };
    }
    default:
      return {};
  }
}

function scheduleFields(p: Pick<ComposerPayload, "when" | "date" | "time">): { fields?: Pick<CreatePostInput, "mode" | "dueAt" | "saveToDraft">; error?: string } {
  if (p.when === "now") return { fields: { mode: "shareNow" } };
  if (p.when === "queue") return { fields: { mode: "addToQueue" } };
  if (p.when === "draft") {
    // A draft can still carry a planned time, so it sits on the right day.
    if (p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.time && /^\d{2}:\d{2}$/.test(p.time)) {
      const at = studioToUtc(p.date, p.time);
      if (at.getTime() > Date.now() + 60_000) return { fields: { mode: "customScheduled", dueAt: at.toISOString(), saveToDraft: true } };
    }
    return { fields: { mode: "addToQueue", saveToDraft: true } };
  }
  if (!p.date || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !p.time || !/^\d{2}:\d{2}$/.test(p.time)) return { error: "Pick a date and time." };
  const at = studioToUtc(p.date, p.time);
  if (at.getTime() < Date.now() + 60_000) return { error: "That time has already passed. Pick a later time or post now." };
  return { fields: { mode: "customScheduled", dueAt: at.toISOString() } };
}

function cleanTags(v: unknown) {
  return Array.isArray(v) ? [...new Set(v.filter((t): t is string => typeof t === "string" && t.length < 80))].slice(0, 20) : [];
}

// Creating posts -------------------------------------------------------------

/** Sends one post to each chosen Buffer channel. */
export async function publishPosts(p: ComposerPayload): Promise<{ error?: string; results?: ChannelResult[] }> {
  await requireAdmin();
  let key: string;
  try {
    key = await bufferKey();
  } catch (e) {
    return { error: message(e) };
  }
  const ids = [...new Set((p.channelIds ?? []).filter((x) => typeof x === "string"))].slice(0, 40);
  if (!ids.length) return { error: "Pick at least one account to post to." };
  const text = String(p.text ?? "").slice(0, 63206);
  const captions = Object.fromEntries(Object.entries(p.captions ?? {}).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, v.slice(0, 63206)]));
  const media = cleanMedia(p.media);
  if (!text.trim() && !Object.values(captions).some((c) => c.trim()) && !media.length) return { error: "Write a caption or add a photo or video." };
  if (media.some((m) => m.isVideo) && media.length > 1) return { error: "Use one video, or up to 10 photos." };
  const when = scheduleFields(p);
  if (when.error) return { error: when.error };
  const tagIds = cleanTags(p.tagIds);
  const options = p.options ?? {};

  const { data: rows } = await supabaseAdmin().from("buffer_channels").select("id, name, service").in("id", ids);
  const channels = (rows ?? []) as { id: string; name: string; service: string }[];
  if (!channels.length) return { error: "Those accounts weren't found. Press Refresh on the calendar." };

  const results = await Promise.all(
    channels.map(async (ch): Promise<ChannelResult> => {
      const service = platformInfo(ch.service).id;
      const body = captions[service] ?? text;
      const limit = CAPTION_LIMIT[service];
      if (limit && body.length > limit) return { channelId: ch.id, name: ch.name, ok: false, error: `Caption is over ${platformInfo(service).label}'s ${limit} characters.` };
      if (!body.trim() && !media.length) return { channelId: ch.id, name: ch.name, ok: false, error: "This one has no caption or media." };
      const meta = metadataFor(service, options, media, p.boards?.[ch.id]);
      if (meta.error) return { channelId: ch.id, name: ch.name, ok: false, error: meta.error };
      try {
        await createBufferPost(key, {
          channelId: ch.id,
          text: body,
          schedulingType: "automatic",
          ...when.fields!,
          ...(media.length ? { assets: assetsFor(media, service) } : {}),
          ...(meta.metadata ? { metadata: meta.metadata } : {}),
          ...(tagIds.length ? { tagIds } : {}),
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
  channelId: string | null;
  text: string;
  /** null keeps the post's current media. */
  media: ComposerMedia[] | null;
  when: "schedule" | "now" | "queue" | "draft";
  date?: string;
  time?: string;
  /** null leaves the post's network options alone. */
  options: NetworkOptions | null;
  tagIds?: string[] | null;
  boardId?: string;
};

export async function updateBufferPost(p: EditPayload): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  try {
    const key = await bufferKey();
    if (typeof p.id !== "string" || !p.id) return { error: "Missing post." };
    const when = scheduleFields(p);
    if (when.error) return { error: when.error };
    let service = "";
    if (typeof p.channelId === "string" && p.channelId) {
      const { data } = await supabaseAdmin().from("buffer_channels").select("service").eq("id", p.channelId).maybeSingle();
      service = platformInfo((data?.service as string) ?? "").id;
    }
    const media = p.media ? cleanMedia(p.media) : null;
    let metadata: Record<string, unknown> | undefined;
    if (p.options && service) {
      // Media isn't re-sent when untouched, so check options against "has media" loosely.
      const check = media ?? [{ url: "https://x", isVideo: p.options.instagram?.type === "reel" || p.options.facebook?.type === "reel" }];
      const meta = metadataFor(service, p.options, check, p.boardId);
      if (meta.error) return { error: meta.error };
      metadata = meta.metadata;
    }
    const limit = CAPTION_LIMIT[service];
    if (limit && p.text.length > limit) return { error: `Caption is over ${platformInfo(service).label}'s ${limit} characters.` };
    await editBufferPost(key, {
      id: p.id,
      text: String(p.text ?? "").slice(0, 63206),
      mode: when.fields!.mode,
      ...(when.fields!.dueAt ? { dueAt: when.fields!.dueAt } : {}),
      ...(p.when === "draft" ? { saveToDraft: true } : { saveToDraft: false }),
      ...(media ? { assets: assetsFor(media, service) } : {}),
      ...(metadata ? { metadata } : {}),
      ...(p.tagIds ? { tagIds: cleanTags(p.tagIds) } : {}),
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

// Sync -----------------------------------------------------------------------

/** Refresh button: re-read accounts from Buffer right now. */
export async function syncNow(): Promise<{ error?: string; ok?: string }> {
  await requireAdmin();
  try {
    const r = await syncBuffer(await bufferKey(), { force: true });
    refresh();
    if (!r) return { ok: "Up to date." };
    const parts = [`${r.total} account${r.total === 1 ? "" : "s"} in Buffer`];
    if (r.added.length) parts.push(`added ${r.added.join(", ")}`);
    if (r.removed.length) parts.push(`removed ${r.removed.join(", ")}`);
    return { ok: `${parts.join(" · ")}.` };
  } catch (e) {
    return { error: message(e) };
  }
}

/** One tap setup: makes a client for every channel without one. */
export async function clientsFromChannels(): Promise<{ error?: string; ok?: string }> {
  await requireAdmin();
  const { made, matched } = await assignClients();
  refresh();
  if (!made && !matched) return { ok: "Every account already has a client." };
  return { ok: made ? `Created ${made} client${made === 1 ? "" : "s"}. Rename or recolor them any time.` : "Matched accounts to your clients." };
}
