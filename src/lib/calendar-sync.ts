import "server-only";
import { type BufferChannel, type BufferTag, bufferAccount, bufferChannels, bufferTags } from "@/lib/buffer";
import { SWATCHES } from "@/lib/calendar";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Keeps the site's list of Buffer accounts in step with Buffer. Runs when the
// calendar opens (at most every few minutes) and whenever someone presses
// Refresh. A new Buffer account shows up here on its own, with a client.

const SYNCED_AT = "buffer_synced_at";
const META = "buffer_meta";
const EVERY_MS = 5 * 60_000;

export type BufferMeta = { tags: BufferTag[]; timezone: string | null; orgs: { id: string; name: string }[] };

export type SyncResult = { added: string[]; removed: string[]; total: number };

type Row = { id: string; name: string; client_id: string | null; organization_id: string; removed_at?: string | null };

async function getSetting(key: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin().from("app_settings").select("value").eq("key", key).maybeSingle();
    return (data?.value as string) ?? null;
  } catch {
    return null;
  }
}

async function setSetting(key: string, value: string) {
  await supabaseAdmin().from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() });
}

export async function loadBufferMeta(): Promise<BufferMeta> {
  const raw = await getSetting(META);
  try {
    const m = raw ? (JSON.parse(raw) as Partial<BufferMeta>) : {};
    return { tags: m.tags ?? [], timezone: m.timezone ?? null, orgs: m.orgs ?? [] };
  } catch {
    return { tags: [], timezone: null, orgs: [] };
  }
}

/** When the accounts were last read from Buffer. */
export async function lastSynced(): Promise<string | null> {
  return getSetting(SYNCED_AT);
}

/**
 * Reads every organization, channel and tag from Buffer and saves them.
 * Skips the round trip if it ran in the last few minutes, unless forced.
 */
export async function syncBuffer(key: string, opts: { force?: boolean } = {}): Promise<SyncResult | null> {
  if (!opts.force) {
    const last = Date.parse((await getSetting(SYNCED_AT)) ?? "");
    if (Number.isFinite(last) && Date.now() - last < EVERY_MS) return null;
  }
  // Claim the slot first so two tabs opening at once don't both sync.
  await setSetting(SYNCED_AT, new Date().toISOString()).catch(() => {});

  const { orgs, timezone } = await bufferAccount(key);
  const perOrg = await Promise.all(orgs.map(async (o) => ({ org: o, channels: await bufferChannels(key, o.id), tags: await bufferTags(key, o.id) })));
  const channels = perOrg.flatMap((x) => x.channels);
  const tags = perOrg.flatMap((x) => x.tags);

  const db = supabaseAdmin();
  const { data: before } = await db.from("buffer_channels").select("*");
  const known = new Map(((before ?? []) as Row[]).map((r) => [r.id, r]));

  await storeChannels(channels);

  // Channels Buffer no longer returns for an organization we can still read.
  const seen = new Set(channels.map((c) => c.id));
  const orgIds = new Set(orgs.map((o) => o.id));
  const gone = [...known.values()].filter((r) => !seen.has(r.id) && orgIds.has(r.organization_id) && !r.removed_at);
  if (gone.length) {
    await db
      .from("buffer_channels")
      .update({ removed_at: new Date().toISOString() })
      .in("id", gone.map((r) => r.id))
      .then(() => {}, () => {});
  }

  // Brand new accounts get a client right away (matched by name, or a new one).
  const fresh = channels.filter((c) => !known.has(c.id));
  if (fresh.length) await assignClients(fresh.map((c) => c.id));

  await setSetting(META, JSON.stringify({ tags, timezone, orgs } satisfies BufferMeta)).catch(() => {});
  return { added: fresh.map((c) => c.name), removed: gone.map((r) => r.name), total: channels.length };
}

/** Saves channels Buffer reports, keeping each channel's client. */
export async function storeChannels(channels: BufferChannel[]) {
  if (!channels.length) return;
  const now = new Date().toISOString();
  const db = supabaseAdmin().from("buffer_channels");
  const basic = channels.map((c) => ({ id: c.id, organization_id: c.organizationId, name: c.name, service: c.service, avatar: c.avatar, updated_at: now }));
  const { error } = await db.upsert(
    channels.map((c, i) => ({
      ...basic[i],
      is_disconnected: !!(c.isDisconnected || c.isLocked),
      is_locked: !!c.isLocked,
      is_paused: !!c.isQueuePaused,
      external_link: c.externalLink ?? null,
      timezone: c.timezone ?? null,
      posting_schedule: c.postingSchedule ?? null,
      boards: c.boards ?? null,
      removed_at: null,
    })),
    { onConflict: "id" },
  );
  // Before the calendar v2 columns exist, save what the table can hold.
  if (error) await db.upsert(basic, { onConflict: "id" });
}

function normalize(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function displayName(name: string) {
  const clean = name.replace(/[._]+/g, " ").trim();
  return clean.length > 1 && clean === clean.toLowerCase() ? clean.replace(/\b\w/g, (c) => c.toUpperCase()) : clean;
}

/**
 * Gives each listed channel (or every channel without one) a client. Channels
 * whose names start the same way (furnitureland + "Furniture Land") share one.
 */
export async function assignClients(onlyIds?: string[]): Promise<{ made: number; matched: number }> {
  const db = supabaseAdmin();
  const [{ data: chans }, { data: existing }] = await Promise.all([
    db.from("buffer_channels").select("id, name, client_id").order("name"),
    db.from("calendar_clients").select("id, name, color"),
  ]);
  const only = onlyIds ? new Set(onlyIds) : null;
  const open = ((chans ?? []) as { id: string; name: string; client_id: string | null }[]).filter((c) => !c.client_id && (!only || only.has(c.id)));
  if (!open.length) return { made: 0, matched: 0 };

  const clients = (existing ?? []) as { id: string; name: string; color: string }[];
  const used = new Set(clients.map((c) => c.color.toLowerCase()));
  const groups: { name: string; key: string; channelIds: string[]; clientId?: string }[] = clients.map((c) => ({ name: c.name, key: normalize(c.name), channelIds: [], clientId: c.id }));

  // Shorter names first so "Furniture Land" claims "furniturelandbakersfield".
  for (const ch of [...open].sort((a, b) => normalize(a.name).length - normalize(b.name).length)) {
    const k = normalize(ch.name);
    const match = groups.find((g) => g.key.length >= 5 && k.length >= 5 && (k.startsWith(g.key) || g.key.startsWith(k)));
    if (match) match.channelIds.push(ch.id);
    else groups.push({ name: displayName(ch.name), key: k, channelIds: [ch.id] });
  }

  let made = 0;
  let matched = 0;
  for (const g of groups) {
    if (!g.channelIds.length) continue;
    if (!g.clientId) {
      const color = SWATCHES.find((s) => !used.has(s)) ?? SWATCHES[(clients.length + made) % SWATCHES.length];
      used.add(color);
      const { data, error } = await db.from("calendar_clients").insert({ name: g.name.slice(0, 60), color }).select("id").single();
      if (error || !data) continue;
      g.clientId = data.id;
      made++;
    } else matched += g.channelIds.length;
    await db.from("buffer_channels").update({ client_id: g.clientId }).in("id", g.channelIds);
  }
  return { made, matched };
}
