import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Buffer's GraphQL API. The calendar reads every account and post from here
// and publishes through it. Field names follow Buffer's own CLI
// (@bufferapp/cli 2.2 schema). Every rich query has a plainer fallback, so a
// field Buffer renames can't take the calendar down.

const ENDPOINT = process.env.BUFFER_API_URL || "https://api.buffer.com";
const KEY_SETTING = "buffer_api_key";

export class BufferError extends Error {}

export type BufferOrg = { id: string; name: string };
export type BufferSlot = { day: string; times: string[]; paused?: boolean };
export type BufferChannel = {
  id: string;
  organizationId: string;
  name: string;
  service: string;
  avatar: string | null;
  isDisconnected?: boolean;
  isLocked?: boolean;
  isQueuePaused?: boolean;
  timezone?: string | null;
  externalLink?: string | null;
  postingSchedule?: BufferSlot[] | null;
  boards?: { id: string; name: string }[] | null;
};
export type BufferTag = { id: string; name: string; color: string };
export type BufferAsset = {
  type: string | null;
  thumbnail: string | null;
  mimeType: string | null;
  source: string | null;
  image?: { altText?: string | null } | null;
};
export type BufferPostMeta = {
  __typename?: string;
  type?: string | null;
  firstComment?: string | null;
  shouldShareToFeed?: boolean | null;
  link?: string | null;
  title?: string | null;
  privacy?: string | null;
  url?: string | null;
  board?: { name?: string | null } | null;
  details?: { button?: string | null; link?: string | null } | null;
};
export type BufferPost = {
  id: string;
  text: string;
  status: string;
  dueAt: string | null;
  sentAt: string | null;
  channelId: string;
  channelService: string;
  externalLink: string | null;
  /** "notification" means Buffer only sends a phone reminder; someone has to finish posting in the app. */
  schedulingType?: string | null;
  notificationStatus?: string | null;
  error?: { message?: string | null } | null;
  tags?: BufferTag[] | null;
  author?: { name?: string | null } | null;
  metadata?: BufferPostMeta | null;
  assets: BufferAsset[];
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
      signal: AbortSignal.timeout(15_000),
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

/** True when Buffer rejected the query's shape (a field or type it doesn't know). */
function isSchemaError(e: unknown) {
  return e instanceof BufferError && /Cannot query field|Unknown type|Unknown argument|on type|Fragment|cannot be spread|conflict/i.test(e.message);
}

/** Runs the richest query Buffer accepts, stepping down on schema errors. */
async function tiered<T>(key: string, queries: string[], variables?: Record<string, unknown>): Promise<T> {
  let last: unknown;
  for (const q of queries) {
    try {
      return await gql<T>(key, q, variables);
    } catch (e) {
      if (!isSchemaError(e)) throw e;
      last = e;
    }
  }
  throw last;
}

// Account and channels ---------------------------------------------------------

export async function bufferAccount(key: string): Promise<{ orgs: BufferOrg[]; timezone: string | null }> {
  const data = await tiered<{ account: { timezone?: string | null; organizations: BufferOrg[] } }>(key, [
    `query { account { timezone organizations { id name } } }`,
    `query { account { organizations { id name } } }`,
  ]);
  return { orgs: data.account?.organizations ?? [], timezone: data.account?.timezone ?? null };
}

export async function bufferOrganizations(key: string): Promise<BufferOrg[]> {
  return (await bufferAccount(key)).orgs;
}

type RawChannel = {
  id: string;
  name: string;
  displayName?: string | null;
  service: string;
  avatar: string | null;
  organizationId: string;
  isDisconnected?: boolean | null;
  isLocked?: boolean | null;
  isQueuePaused?: boolean | null;
  timezone?: string | null;
  externalLink?: string | null;
  postingSchedule?: { day: string; times: string[] | null; paused?: boolean | null }[] | null;
  metadata?: { boards?: { serviceId?: string | null; id?: string | null; name?: string | null }[] | null } | null;
};

const CHANNEL_BASE = "id name displayName service avatar organizationId";
const CHANNEL_RICH = `${CHANNEL_BASE} isDisconnected isLocked isQueuePaused timezone externalLink postingSchedule { day times paused } metadata { ... on PinterestMetadata { boards { id serviceId name } } }`;
const CHANNEL_MID = `${CHANNEL_BASE} isDisconnected isLocked isQueuePaused timezone`;
const channelsQuery = (sel: string) => `query Channels($input: ChannelsInput!) { channels(input: $input) { ${sel} } }`;

export async function bufferChannels(key: string, organizationId: string): Promise<BufferChannel[]> {
  const data = await tiered<{ channels: RawChannel[] }>(key, [channelsQuery(CHANNEL_RICH), channelsQuery(CHANNEL_MID), channelsQuery(CHANNEL_BASE)], {
    input: { organizationId },
  });
  return (data.channels ?? []).map((c) => ({
    id: c.id,
    organizationId: c.organizationId || organizationId,
    name: c.displayName || c.name,
    service: c.service,
    avatar: c.avatar || null,
    isDisconnected: !!c.isDisconnected,
    isLocked: !!c.isLocked,
    isQueuePaused: !!c.isQueuePaused,
    timezone: c.timezone ?? null,
    externalLink: c.externalLink ?? null,
    postingSchedule: c.postingSchedule ? c.postingSchedule.map((s) => ({ day: s.day, times: s.times ?? [], paused: !!s.paused })) : null,
    boards: c.metadata?.boards?.length
      ? c.metadata.boards.filter((b) => b.serviceId || b.id).map((b) => ({ id: (b.serviceId || b.id) as string, name: b.name || "Board" }))
      : null,
  }));
}

/** Buffer's post tags for an organization. Missing tags never break the calendar. */
export async function bufferTags(key: string, organizationId: string): Promise<BufferTag[]> {
  try {
    const data = await gql<{ tagsV2: { edges: { node: BufferTag }[] } }>(
      key,
      `query Tags($input: TagsInput!, $first: Int) { tagsV2(first: $first, input: $input) { edges { node { id name color } } } }`,
      { input: { organizationId }, first: 100 },
    );
    return (data.tagsV2?.edges ?? []).map((e) => e.node).filter((t) => t?.id);
  } catch {
    return [];
  }
}

// Posts ------------------------------------------------------------------------

const POST_BASE = "id text status dueAt sentAt channelId channelService externalLink assets { type thumbnail mimeType source }";
const POST_MID = `${POST_BASE} schedulingType notificationStatus`;
const POST_RICH = `${POST_MID} error { message } tags { id name color } author { name }
  assets { type thumbnail mimeType source ... on ImageAsset { image { altText } } }
  metadata {
    __typename
    ... on InstagramPostMetadata { type firstComment shouldShareToFeed link }
    ... on FacebookPostMetadata { type firstComment }
    ... on LinkedInPostMetadata { firstComment }
    ... on TiktokPostMetadata { title }
    ... on YoutubePostMetadata { title privacy }
    ... on PinterestPostMetadata { title url board { name } }
    ... on GoogleBusinessPostMetadata { type title details { ... on GoogleBusinessWhatsNewMetaData { button link } } }
  }`;
const postsQuery = (sel: string) => `query Posts($input: PostsInput!, $after: String) {
  posts(first: 100, after: $after, input: $input) {
    edges { node { ${sel} } }
    pageInfo { hasNextPage endCursor }
  }
}`;
const POST_QUERIES = [postsQuery(POST_RICH), postsQuery(POST_MID), postsQuery(POST_BASE)];

type PostsPage = { posts: { edges: { node: BufferPost }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } };

async function pagedPosts(key: string, input: Record<string, unknown>, maxPages = 6): Promise<BufferPost[]> {
  const out: BufferPost[] = [];
  let after: string | null = null;
  let queries = POST_QUERIES;
  for (let i = 0; i < maxPages; i++) {
    let data: PostsPage | null = null;
    while (!data) {
      try {
        data = await gql<PostsPage>(key, queries[0], { input, after });
      } catch (e) {
        // Step down to a plainer query and remember it for the next pages.
        if (!isSchemaError(e) || queries.length === 1) throw e;
        queries = queries.slice(1);
      }
    }
    out.push(...(data.posts?.edges ?? []).map((e) => e.node));
    if (!data.posts?.pageInfo?.hasNextPage || !data.posts.pageInfo.endCursor) break;
    after = data.posts.pageInfo.endCursor;
  }
  return out;
}

/** Scheduled, sent, failed and draft posts whose time falls inside the range. */
export async function bufferPosts(key: string, organizationId: string, start: Date, end: Date): Promise<BufferPost[]> {
  const status = ["scheduled", "sending", "sent", "error", "draft", "needs_approval"];
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

// Writing to Buffer ------------------------------------------------------------

export type BufferAssetInput =
  | { image: { url: string; metadata?: { altText: string } } }
  | { video: { url: string; metadata?: { thumbnailOffset?: number; title?: string } } };

export type CreatePostInput = {
  channelId: string;
  text: string;
  schedulingType: "automatic";
  mode: "addToQueue" | "customScheduled" | "shareNow" | "shareNext";
  dueAt?: string;
  saveToDraft?: boolean;
  assets?: BufferAssetInput[];
  metadata?: Record<string, unknown>;
  tagIds?: string[];
  source?: string;
};

export type EditPostInput = {
  id: string;
  text?: string;
  mode?: "addToQueue" | "customScheduled" | "shareNow" | "shareNext";
  dueAt?: string;
  schedulingType?: "automatic";
  saveToDraft?: boolean;
  assets?: BufferAssetInput[];
  metadata?: Record<string, unknown>;
  tagIds?: string[];
};

type PostResult = { __typename: string; post?: { id: string; status: string; dueAt: string | null }; message?: string };

// Error members of the createPost/editPost unions, as listed in Buffer's own CLI.
const ERRORS = ["NotFoundError", "UnauthorizedError", "UnexpectedError", "RestProxyError", "LimitReachedError", "InvalidInputError"];
const RESULT = `__typename ... on PostActionSuccess { post { id status dueAt } } ${ERRORS.map((e) => `... on ${e} { message }`).join(" ")}`;

function unwrap(r: PostResult | null | undefined) {
  if (!r) throw new BufferError("Buffer didn't confirm the change.");
  if (r.__typename !== "PostActionSuccess" || !r.post) throw new BufferError(r.message || "Buffer turned the post down.");
  return r.post;
}

export async function createBufferPost(key: string, input: CreatePostInput) {
  const data = await gql<{ createPost: PostResult }>(key, `mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { ${RESULT} } }`, { input });
  return unwrap(data.createPost);
}

export async function editBufferPost(key: string, input: EditPostInput) {
  const data = await gql<{ editPost: PostResult }>(key, `mutation EditPost($input: EditPostInput!) { editPost(input: $input) { ${RESULT} } }`, { input });
  return unwrap(data.editPost);
}

export async function deleteBufferPost(key: string, id: string) {
  const data = await gql<{ deletePost: { __typename: string; message?: string } }>(
    key,
    `mutation DeletePost($input: DeletePostInput!) { deletePost(input: $input) { __typename ... on VoidMutationError { message } } }`,
    { input: { id } },
  );
  if (data.deletePost?.__typename !== "DeletePostSuccess") throw new BufferError(data.deletePost?.message || "Buffer couldn't delete the post.");
}
