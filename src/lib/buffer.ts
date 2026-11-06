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
  /** "notification" means Buffer only sends a phone reminder; someone has to finish posting in the app. */
  schedulingType?: string | null;
  notificationStatus?: string | null;
  assets: { type: string | null; thumbnail: string | null; mimeType: string | null; source: string | null }[];
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

const postsQuery = (extra: string) => `query Posts($input: PostsInput!, $after: String) {
  posts(first: 100, after: $after, input: $input) {
    edges { node { id text status dueAt sentAt channelId channelService externalLink ${extra} assets { type thumbnail mimeType source } } }
    pageInfo { hasNextPage endCursor }
  }
}`;
const POSTS_QUERY = postsQuery("schedulingType notificationStatus");
const POSTS_QUERY_BASIC = postsQuery("");

type PostsPage = { posts: { edges: { node: BufferPost }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } };

async function pagedPosts(key: string, input: Record<string, unknown>, maxPages = 5): Promise<BufferPost[]> {
  const out: BufferPost[] = [];
  let after: string | null = null;
  let query = POSTS_QUERY;
  for (let i = 0; i < maxPages; i++) {
    let data: PostsPage;
    try {
      data = await gql<PostsPage>(key, query, { input, after });
    } catch (e) {
      // The reminder fields are a nice-to-have; never let them break the calendar.
      if (query === POSTS_QUERY_BASIC || !(e instanceof BufferError) || !/schedulingType|notificationStatus|Cannot query field/i.test(e.message)) throw e;
      query = POSTS_QUERY_BASIC;
      data = await gql<PostsPage>(key, query, { input, after });
    }
    out.push(...(data.posts?.edges ?? []).map((e) => e.node));
    if (!data.posts?.pageInfo?.hasNextPage || !data.posts.pageInfo.endCursor) break;
    after = data.posts.pageInfo.endCursor;
  }
  return out;
}

/** Scheduled, sent and failed posts whose time falls inside the range. */
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

export type BufferAssetInput = { image: { url: string } } | { video: { url: string } };

export type CreatePostInput = {
  channelId: string;
  text: string;
  schedulingType: "automatic";
  mode: "addToQueue" | "customScheduled" | "shareNow" | "shareNext";
  dueAt?: string;
  saveToDraft?: boolean;
  assets?: BufferAssetInput[];
  metadata?: Record<string, unknown>;
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
