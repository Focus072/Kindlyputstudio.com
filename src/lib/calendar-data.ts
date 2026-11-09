import "server-only";
import { BufferError, type BufferPost, bufferChannels, bufferOrganizations, bufferPosts, getBufferKey } from "@/lib/buffer";
import type { CalChannel, CalClient, CalPost, CalPostMeta, CalStatus } from "@/lib/calendar";
import { storeChannels } from "@/lib/calendar-sync";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type BufferState =
  | { state: "off" }
  | { state: "ok"; posts: number }
  | { state: "error"; message: string };

export type ChannelRow = {
  id: string;
  organization_id: string;
  name: string;
  service: string;
  avatar: string | null;
  client_id: string | null;
  is_disconnected?: boolean | null;
  is_paused?: boolean | null;
  external_link?: string | null;
  posting_schedule?: { day: string; times: string[]; paused?: boolean }[] | null;
  boards?: { id: string; name: string }[] | null;
  removed_at?: string | null;
};

export async function loadClients(): Promise<{ clients: CalClient[]; ready: boolean }> {
  const { data, error } = await supabaseAdmin().from("calendar_clients").select("id, name, color").order("name");
  return { clients: (data ?? []) as CalClient[], ready: !error };
}

/** Every channel we know, including ones Buffer dropped (so old posts keep their client). */
export async function loadChannels(): Promise<ChannelRow[]> {
  const { data } = await supabaseAdmin().from("buffer_channels").select("*").order("name");
  return (data ?? []) as ChannelRow[];
}

export function toCalChannel(c: ChannelRow): CalChannel {
  return {
    id: c.id,
    name: c.name,
    service: c.service,
    avatar: c.avatar,
    clientId: c.client_id,
    needsReconnect: !!c.is_disconnected,
    paused: !!c.is_paused,
    link: c.external_link ?? null,
    schedule: c.posting_schedule ?? null,
    boards: c.boards ?? null,
  };
}

/** Live channels in the shape the calendar and composer use. */
export async function loadComposerChannels(): Promise<CalChannel[]> {
  return (await loadChannels()).filter((c) => !c.removed_at).map(toCalChannel);
}

function bufferStatus(s: string): CalStatus {
  const v = s.toLowerCase();
  if (v === "sent") return "posted";
  if (v === "error") return "error";
  if (v === "draft" || v === "needs_approval") return "draft";
  return "scheduled";
}

function metaOf(p: BufferPost): CalPostMeta | undefined {
  const m = p.metadata;
  if (!m) return undefined;
  return {
    type: m.type ?? null,
    firstComment: m.firstComment ?? null,
    shareToFeed: m.shouldShareToFeed ?? null,
    link: m.link ?? m.url ?? m.details?.link ?? null,
    title: m.title ?? null,
    privacy: m.privacy ?? null,
    button: m.details?.button ?? null,
    boardName: m.board?.name ?? null,
  };
}

/** Everything a date range needs: hand-added plans plus every Buffer post. */
export async function loadRange(start: Date, end: Date): Promise<{ posts: CalPost[]; buffer: BufferState }> {
  const db = supabaseAdmin();

  const { data: manual } = await db
    .from("calendar_posts")
    .select("id, client_id, scheduled_at, platform, caption, notes, status")
    .gte("scheduled_at", start.toISOString())
    .lt("scheduled_at", end.toISOString())
    .order("scheduled_at");

  const posts: CalPost[] = (manual ?? []).map((p) => ({
    id: p.id,
    source: "manual",
    clientId: p.client_id,
    at: p.scheduled_at,
    platform: p.platform,
    caption: p.caption ?? "",
    status: p.status as CalStatus,
    notes: p.notes,
    thumb: null,
    isVideo: false,
    channelName: null,
    link: null,
    bufferId: null,
    channelId: null,
    media: [],
  }));

  const key = await getBufferKey();
  if (!key) return { posts, buffer: { state: "off" } };

  try {
    const orgs = await bufferOrganizations(key.key);
    const fromBuffer = (await Promise.all(orgs.map((o) => bufferPosts(key.key, o.id, start, end).then((ps) => ({ org: o.id, ps }))))).flatMap(
      ({ org, ps }) => ps.map((p) => ({ ...p, org })),
    );

    let channels = await loadChannels();
    const known = new Set(channels.map((c) => c.id));
    const missingOrgs = [...new Set(fromBuffer.filter((p) => !known.has(p.channelId)).map((p) => p.org))];
    if (missingOrgs.length) {
      await storeChannels((await Promise.all(missingOrgs.map((o) => bufferChannels(key.key, o)))).flat());
      channels = await loadChannels();
    }
    const byId = new Map(channels.map((c) => [c.id, c]));

    for (const p of fromBuffer) {
      const ch = byId.get(p.channelId);
      const asset = p.assets?.[0];
      const media = (p.assets ?? [])
        .filter((a) => a.source)
        .map((a) => ({ url: a.source as string, thumb: a.thumbnail || null, isVideo: /video/i.test(`${a.mimeType} ${a.type}`), alt: a.image?.altText ?? null }));
      posts.push({
        id: `buffer-${p.id}`,
        source: "buffer",
        clientId: ch?.client_id ?? null,
        at: (p.status === "sent" && p.sentAt) || p.dueAt || p.sentAt || new Date().toISOString(),
        platform: p.channelService || ch?.service || "other",
        caption: p.text ?? "",
        status: bufferStatus(p.status),
        notes: null,
        thumb: asset?.thumbnail || (asset && !/video/i.test(`${asset.mimeType} ${asset.type}`) ? asset.source : null) || null,
        isVideo: !!asset && (/video/i.test(asset.mimeType ?? "") || /video/i.test(asset.type ?? "")),
        channelName: ch?.name ?? null,
        channelAvatar: ch?.avatar ?? null,
        link: p.externalLink,
        bufferId: p.id,
        channelId: p.channelId,
        media,
        reminder: (p.schedulingType ?? "").toLowerCase() === "notification",
        errorMessage: p.error?.message ?? null,
        tags: (p.tags ?? []).filter((t) => t?.id),
        author: p.author?.name ?? null,
        meta: metaOf(p),
      });
    }
    posts.sort((a, b) => a.at.localeCompare(b.at));
    return { posts, buffer: { state: "ok", posts: fromBuffer.length } };
  } catch (e) {
    posts.sort((a, b) => a.at.localeCompare(b.at));
    const message = e instanceof BufferError ? e.message : "Couldn't load posts from Buffer.";
    return { posts, buffer: { state: "error", message } };
  }
}
