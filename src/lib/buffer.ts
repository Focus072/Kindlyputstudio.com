import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Read-only Buffer connection. We never post or change anything in Buffer;
// we only read the queue so the calendar can show it.

const ENDPOINT = "https://api.buffer.com";
const KEY_SETTING = "buffer_api_key";

export class BufferError extends Error {}

export type BufferOrg = { id: string; name: string };
export type BufferChannel = { id: string; organizationId: string; name: string; service: string; avatar: string | null };
export type BufferPost = {
  id: string;
  text: string;
  status: string;
  dueAt: string | null;
  sentAt: string | null;
  channelId: string;
  channelService: string;
  externalLink: string | null;
  assets: { type: string | null; thumbnail: string | null; mimeType: string | null }[];
};

/** The saved key (admin settings) wins; BUFFER_API_KEY works as a fallback. */
export async function getBufferKey(): Promise<{ key: string; source: "settings" | "env" } | null> {
  try {
    const { data } = await supabaseAdmin().from("app_settings").select("value").eq("key", KEY_SETTING).maybeSingle();
    if (data?.value) return { key: data.value as string, source: "settings" };
  } catch {
    // table missing until the migration runs; fall through to the env var
  }
  const env = process.env.BUFFER_API_KEY?.trim();
  return env ? { key: env, source: "env" } : null;
}

export async function saveBufferKey(key: string | null) {
  const db = supabaseAdmin().from("app_settings");
  if (key) await db.upsert({ key: KEY_SETTING, value: key, updated_at: new Date().toISOString() });
  else await db.delete().eq("key", KEY_SETTING);
}

async function gql<T>(key: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new BufferError("Buffer didn't answer. Try again in a minute.");
  }
  if (res.status === 401 || res.status === 403) throw new BufferError("Buffer turned down the API key. Paste a fresh key in calendar settings.");
  if (res.status === 429) throw new BufferError("Buffer asked us to slow down. Try again in a few minutes.");
  const body = (await res.json().catch(() => null)) as { data?: T; errors?: { message?: string }[] } | null;
  if (body?.errors?.length) throw new BufferError(body.errors.map((e) => e.message).filter(Boolean).join("; ") || "Buffer returned an error.");
  if (!res.ok || !body?.data) throw new BufferError(`Buffer returned an error (${res.status}).`);
  return body.data;
}

export async function bufferOrganizations(key: string): Promise<BufferOrg[]> {
  const data = await gql<{ account: { organizations: BufferOrg[] } }>(key, `query { account { organizations { id name } } }`);
  return data.account?.organizations ?? [];
}

export async function bufferChannels(key: string, organizationId: string): Promise<BufferChannel[]> {
  const data = await gql<{ channels: { id: string; name: string; displayName: string | null; service: string; avatar: string | null; organizationId: string }[] }>(
    key,
    `query Channels($input: ChannelsInput!) { channels(input: $input) { id name displayName service avatar organizationId } }`,
    { input: { organizationId } },
  );
  return (data.channels ?? []).map((c) => ({
    id: c.id,
    organizationId: c.organizationId || organizationId,
    name: c.displayName || c.name,
    service: c.service,
    avatar: c.avatar || null,
  }));
}

const POSTS_QUERY = `query Posts($input: PostsInput!, $after: String) {
  posts(first: 100, after: $after, input: $input) {
    edges { node { id text status dueAt sentAt channelId channelService externalLink assets { type thumbnail mimeType } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

type PostsPage = { posts: { edges: { node: BufferPost }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } };

async function pagedPosts(key: string, input: Record<string, unknown>, maxPages = 5): Promise<BufferPost[]> {
  const out: BufferPost[] = [];
  let after: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const data: PostsPage = await gql<PostsPage>(key, POSTS_QUERY, { input, after });
    out.push(...(data.posts?.edges ?? []).map((e) => e.node));
    if (!data.posts?.pageInfo?.hasNextPage || !data.posts.pageInfo.endCursor) break;
    after = data.posts.pageInfo.endCursor;
  }
  return out;
}

/** Scheduled, sent and failed posts whose time falls inside the range. */
export async function bufferPosts(key: string, organizationId: string, start: Date, end: Date): Promise<BufferPost[]> {
  const status = ["scheduled", "sent", "error"];
  let posts: BufferPost[];
  try {
    posts = await pagedPosts(key, {
      organizationId,
      filter: { status, dueAt: { start: start.toISOString(), end: end.toISOString() } },
    });
  } catch (e) {
    // If the date filter is ever rejected, read the queue without it and filter here.
    if (!(e instanceof BufferError) || !/dueAt|start|end|filter/i.test(e.message)) throw e;
    posts = await pagedPosts(key, { organizationId, filter: { status } }, 10);
  }
  const s = start.getTime();
  const t = end.getTime();
  return posts.filter((p) => {
    const at = Date.parse(p.dueAt || p.sentAt || "");
    return Number.isFinite(at) && at >= s && at < t;
  });
}
