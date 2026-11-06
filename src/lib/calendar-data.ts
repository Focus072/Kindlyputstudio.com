import "server-only";
import { BufferError, bufferChannels, bufferOrganizations, bufferPosts, getBufferKey, type BufferChannel } from "@/lib/buffer";
import type { CalChannel, CalClient, CalPost, CalStatus } from "@/lib/calendar";
import { gridRange } from "@/lib/calendar-time";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type BufferState =
  | { state: "off" }
  | { state: "ok"; posts: number }
  | { state: "error"; message: string };

type ChannelRow = { id: string; organization_id: string; name: string; service: string; avatar: string | null; client_id: string | null };

export async function loadClients(): Promise<{ clients: CalClient[]; ready: boolean }> {
  const { data, error } = await supabaseAdmin().from("calendar_clients").select("id, name, color").order("name");
  return { clients: (data ?? []) as CalClient[], ready: !error };
}

/** Channels in the shape the composer uses. */
export async function loadComposerChannels(): Promise<CalChannel[]> {
  return (await loadChannels()).map((c) => ({ id: c.id, name: c.name, service: c.service, avatar: c.avatar, clientId: c.client_id }));
}

export async function loadChannels(): Promise<ChannelRow[]> {
  const { data } = await supabaseAdmin().from("buffer_channels").select("id, organization_id, name, service, avatar, client_id").order("name");
  return (data ?? []) as ChannelRow[];
}

/** Saves channels Buffer reports, keeping each channel's client. */
export async function storeChannels(channels: BufferChannel[]) {
  if (!channels.length) return;
  await supabaseAdmin()
    .from("buffer_channels")
    .upsert(
      channels.map((c) => ({
        id: c.id,
        organization_id: c.organizationId,
        name: c.name,
        service: c.service,
        avatar: c.avatar,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "id" },
    );
}

/** Reads every organization's channels from Buffer and saves them. */
export async function syncChannels(key: string) {
  const orgs = await bufferOrganizations(key);
  const lists = await Promise.all(orgs.map((o) => bufferChannels(key, o.id)));
  const all = lists.flat();
  await storeChannels(all);
  return { orgs, channels: all };
}

function bufferStatus(s: string): CalStatus {
  const v = s.toLowerCase();
  if (v === "sent") return "posted";
  if (v === "error") return "error";
  if (v === "draft" || v === "needs_approval") return "draft";
  return "scheduled";
}

/** Everything the month view needs: hand-added posts plus Buffer's queue. */
export async function loadMonth(month: string): Promise<{ posts: CalPost[]; buffer: BufferState }> {
  const { start, end } = gridRange(month);
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
        .map((a) => ({ url: a.source as string, thumb: a.thumbnail || null, isVideo: /video/i.test(`${a.mimeType} ${a.type}`) }));
      posts.push({
        id: `buffer-${p.id}`,
        source: "buffer",
        clientId: ch?.client_id ?? null,
        at: (p.status === "sent" && p.sentAt) || p.dueAt || p.sentAt || new Date().toISOString(),
        platform: p.channelService || ch?.service || "other",
        caption: p.text ?? "",
        status: bufferStatus(p.status),
        notes: null,
        thumb: asset?.thumbnail || null,
        isVideo: !!asset && (/video/i.test(asset.mimeType ?? "") || /video/i.test(asset.type ?? "")),
        channelName: ch?.name ?? null,
        link: p.externalLink,
        bufferId: p.id,
        channelId: p.channelId,
        media,
        reminder: (p.schedulingType ?? "").toLowerCase() === "notification",
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
