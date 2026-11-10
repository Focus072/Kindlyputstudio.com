import "server-only";
import { randomBytes } from "node:crypto";
import type { CalClient, CalMedia, CalPost } from "@/lib/calendar";
import { loadRange } from "@/lib/calendar-data";
import type { CalComment, Idea, IdeaStatus, Role } from "@/lib/ideas";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** What a client may see of a post: no internal notes, tags, authors or errors. */
export type ClientPost = {
  id: string;
  at: string;
  platform: string;
  caption: string;
  status: "scheduled" | "posted";
  thumb: string | null;
  isVideo: boolean;
  media: CalMedia[];
  channelName: string | null;
  channelAvatar: string | null;
  link: string | null;
  type: string | null;
};

export type SharedClient = CalClient & { shareToken: string | null; shareCreatedAt: string | null; shareViewedAt: string | null };

/** A long random token for a share link (base64url, 32 bytes). */
export function newShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isShareToken(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{40,60}$/.test(v);
}

export async function clientByToken(token: string): Promise<CalClient | null> {
  if (!isShareToken(token)) return null;
  const { data } = await supabaseAdmin().from("calendar_clients").select("id, name, color").eq("share_token", token).maybeSingle();
  return (data as CalClient | null) ?? null;
}

export async function loadSharedClients(): Promise<SharedClient[]> {
  const { data, error } = await supabaseAdmin()
    .from("calendar_clients")
    .select("id, name, color, share_token, share_created_at, share_viewed_at")
    .order("name");
  if (error) {
    // Database update not run yet: fall back to the plain list.
    const { data: plain } = await supabaseAdmin().from("calendar_clients").select("id, name, color").order("name");
    return ((plain ?? []) as CalClient[]).map((c) => ({ ...c, shareToken: null, shareCreatedAt: null, shareViewedAt: null }));
  }
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    shareToken: c.share_token ?? null,
    shareCreatedAt: c.share_created_at ?? null,
    shareViewedAt: c.share_viewed_at ?? null,
  }));
}

export function toClientPost(p: CalPost): ClientPost | null {
  if (p.status !== "scheduled" && p.status !== "posted") return null;
  return {
    id: p.id,
    at: p.at,
    platform: p.platform,
    caption: p.caption,
    status: p.status,
    thumb: p.thumb,
    isVideo: p.isVideo,
    media: p.media,
    channelName: p.channelName,
    channelAvatar: p.channelAvatar ?? null,
    link: p.status === "posted" && !p.reminder ? p.link : null,
    type: p.meta?.type ?? (p.media.length > 1 ? "carousel" : null),
  };
}

/** One client's scheduled and published posts in a range (Buffer plus hand-added plans). */
export async function loadClientPosts(clientId: string, start: Date, end: Date): Promise<{ posts: ClientPost[]; ok: boolean }> {
  const { posts, buffer } = await loadRange(start, end);
  return {
    posts: posts.filter((p) => p.clientId === clientId).flatMap((p) => toClientPost(p) ?? []),
    ok: buffer.state !== "error",
  };
}

type CommentRow = {
  id: string;
  idea_id: string | null;
  post_key: string | null;
  body: string;
  author_name: string | null;
  author_role: Role;
  created_at: string;
};

function toComment(c: CommentRow): CalComment {
  return { id: c.id, ideaId: c.idea_id, postKey: c.post_key, body: c.body, authorName: c.author_name, authorRole: c.author_role, createdAt: c.created_at };
}

/** Ideas with their comments, plus comments on posts. */
export async function loadIdeas(clientId: string): Promise<{ ideas: Idea[]; postComments: CalComment[]; ready: boolean }> {
  const db = supabaseAdmin();
  const [ideasRes, commentsRes] = await Promise.all([
    db.from("calendar_ideas").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(300),
    db.from("calendar_comments").select("id, idea_id, post_key, body, author_name, author_role, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(2000),
  ]);
  if (ideasRes.error) return { ideas: [], postComments: [], ready: false };
  // Newest first from the database (so recent comments always load), oldest first on screen.
  const comments = ((commentsRes.data ?? []) as CommentRow[]).map(toComment).reverse();
  const byIdea = new Map<string, CalComment[]>();
  for (const c of comments) if (c.ideaId) byIdea.set(c.ideaId, [...(byIdea.get(c.ideaId) ?? []), c]);
  const ideas: Idea[] = (ideasRes.data ?? []).map((r) => ({
    id: r.id,
    clientId: r.client_id,
    title: r.title,
    body: r.body ?? "",
    link: r.link ?? null,
    platform: r.platform ?? null,
    targetDate: r.target_date ?? null,
    status: r.status as IdeaStatus,
    authorName: r.author_name ?? null,
    authorRole: r.author_role as Role,
    scheduledAt: r.scheduled_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    comments: byIdea.get(r.id) ?? [],
  }));
  return { ideas, postComments: comments.filter((c) => !c.ideaId && c.postKey), ready: true };
}
