"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession, requireAdmin } from "@/lib/auth";
import { PLATFORMS } from "@/lib/calendar";
import { clientByToken, newShareToken } from "@/lib/client-calendar";
import { type IdeaStatus, type Role, isIdeaStatus } from "@/lib/ideas";
import { clientFingerprint, rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Result = { ok: true; id?: string } | { ok: false; error: string };

/** Who is acting: a client holding the share link, or a signed-in admin. */
export type Ctx = { token?: string; clientId?: string; name?: string };

const UUID = /^[0-9a-f-]{36}$/;
const GONE = "This link was turned off. Ask the studio for a new one.";

function clean(v: unknown, max: number) {
  return String(v ?? "")
    .replace(/\s+$/g, "")
    .trim()
    .slice(0, max);
}

async function studioName(): Promise<string> {
  const s = await getAdminSession();
  if (!s) return "Kindly Put Studio";
  const { data } = await supabaseAdmin().from("admin_users").select("display_name").eq("id", s.userId).maybeSingle();
  return (data?.display_name as string | undefined)?.trim() || "Kindly Put Studio";
}

async function who(ctx: Ctx): Promise<{ clientId: string; role: Role; name: string; token?: string } | { error: string }> {
  if (ctx.token) {
    const client = await clientByToken(ctx.token);
    if (!client) return { error: GONE };
    if (!(await rateLimit(`cal:${await clientFingerprint()}`, 60, 600))) return { error: "Too many changes at once. Try again in a few minutes." };
    return { clientId: client.id, role: "client", name: clean(ctx.name, 60) || client.name, token: ctx.token };
  }
  const s = await getAdminSession();
  if (!s) return { error: "Please sign in again." };
  if (!ctx.clientId || !UUID.test(ctx.clientId)) return { error: "Pick a client first." };
  return { clientId: ctx.clientId, role: "studio", name: await studioName() };
}

function refresh(token?: string) {
  if (token) revalidatePath(`/cal/${token}`);
  revalidatePath("/admin/calendar/ideas");
}

function validLink(v: string) {
  if (!v) return "";
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export type IdeaInput = {
  id?: string;
  title: string;
  body?: string;
  link?: string;
  platform?: string;
  targetDate?: string;
  status?: IdeaStatus;
};

export async function saveIdea(ctx: Ctx, input: IdeaInput): Promise<Result> {
  const w = await who(ctx);
  if ("error" in w) return { ok: false, error: w.error };
  const title = clean(input.title, 140);
  if (!title) return { ok: false, error: "Give the idea a short title." };
  const link = validLink(clean(input.link, 600));
  if (link === null) return { ok: false, error: "That link doesn't look right." };
  const platform = clean(input.platform, 30);
  const date = clean(input.targetDate, 10);
  const row: Record<string, unknown> = {
    title,
    body: clean(input.body, 4000) || null,
    link: link || null,
    platform: PLATFORMS.some((p) => p.id === platform) ? platform : null,
    target_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    updated_at: new Date().toISOString(),
  };
  if (w.role === "studio" && input.status && isIdeaStatus(input.status)) row.status = input.status;

  const db = supabaseAdmin().from("calendar_ideas");
  if (input.id) {
    if (!UUID.test(input.id)) return { ok: false, error: "Idea not found." };
    const { error } = await db.update(row).eq("id", input.id).eq("client_id", w.clientId);
    if (error) return { ok: false, error: "Couldn't save. Try again." };
    refresh(w.token);
    return { ok: true, id: input.id };
  }
  const { data, error } = await db
    .insert({ ...row, client_id: w.clientId, author_name: w.name, author_role: w.role })
    .select("id")
    .single();
  if (error) return { ok: false, error: "Couldn't save. Try again." };
  refresh(w.token);
  return { ok: true, id: data.id as string };
}

export async function moveIdea(ctx: Ctx, id: string, status: IdeaStatus): Promise<Result> {
  const w = await who(ctx);
  if ("error" in w) return { ok: false, error: w.error };
  if (w.role !== "studio") return { ok: false, error: "The studio moves ideas along." };
  if (!UUID.test(id) || !isIdeaStatus(status)) return { ok: false, error: "Idea not found." };
  const { error } = await supabaseAdmin()
    .from("calendar_ideas")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("client_id", w.clientId);
  if (error) return { ok: false, error: "Couldn't move it. Try again." };
  refresh(w.token);
  return { ok: true };
}

/** Studio only: an idea went into the calendar through the composer. */
export async function markIdeaScheduled(clientId: string, id: string, at: string | null): Promise<Result> {
  await requireAdmin();
  if (!UUID.test(id) || !UUID.test(clientId)) return { ok: false, error: "Idea not found." };
  const { error } = await supabaseAdmin()
    .from("calendar_ideas")
    .update({ status: "scheduled", scheduled_at: at, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return { ok: false, error: "Scheduled, but couldn't update the idea." };
  refresh();
  return { ok: true };
}

export async function deleteIdea(ctx: Ctx, id: string): Promise<Result> {
  const w = await who(ctx);
  if ("error" in w) return { ok: false, error: w.error };
  if (!UUID.test(id)) return { ok: false, error: "Idea not found." };
  const q = supabaseAdmin().from("calendar_ideas").delete().eq("id", id).eq("client_id", w.clientId);
  // Clients can only delete ideas they added themselves.
  const { error } = w.role === "client" ? await q.eq("author_role", "client") : await q;
  if (error) return { ok: false, error: "Couldn't delete it." };
  refresh(w.token);
  return { ok: true };
}

export async function addComment(ctx: Ctx, target: { ideaId?: string; postKey?: string }, text: string): Promise<Result> {
  const w = await who(ctx);
  if ("error" in w) return { ok: false, error: w.error };
  const body = clean(text, 2000);
  if (!body) return { ok: false, error: "Write a comment first." };
  const ideaId = target.ideaId && UUID.test(target.ideaId) ? target.ideaId : null;
  const postKey = !ideaId && target.postKey && /^[\w-]{1,120}$/.test(target.postKey) ? target.postKey : null;
  if (!ideaId && !postKey) return { ok: false, error: "Nothing to comment on." };
  if (ideaId) {
    const { data } = await supabaseAdmin().from("calendar_ideas").select("id").eq("id", ideaId).eq("client_id", w.clientId).maybeSingle();
    if (!data) return { ok: false, error: "Idea not found." };
  }
  const { data, error } = await supabaseAdmin()
    .from("calendar_comments")
    .insert({ client_id: w.clientId, idea_id: ideaId, post_key: postKey, body, author_name: w.name, author_role: w.role })
    .select("id")
    .single();
  if (error) return { ok: false, error: "Couldn't post the comment." };
  refresh(w.token);
  return { ok: true, id: data.id as string };
}

/** Counts a visit to the shared calendar (the admin sees "last opened"). */
export async function recordCalendarView(token: string): Promise<void> {
  const client = await clientByToken(token);
  if (!client) return;
  await supabaseAdmin().from("calendar_clients").update({ share_viewed_at: new Date().toISOString() }).eq("id", client.id);
}

// Share link (studio only) -----------------------------------------------------

export async function createShareLink(clientId: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  await requireAdmin();
  if (!UUID.test(clientId)) return { ok: false, error: "Pick a client." };
  const token = newShareToken();
  const { error } = await supabaseAdmin()
    .from("calendar_clients")
    .update({ share_token: token, share_created_at: new Date().toISOString(), share_viewed_at: null })
    .eq("id", clientId);
  if (error) return { ok: false, error: "Couldn't make the link. Try again." };
  refresh();
  return { ok: true, token };
}

export async function turnOffShareLink(clientId: string): Promise<Result> {
  await requireAdmin();
  if (!UUID.test(clientId)) return { ok: false, error: "Pick a client." };
  const { data } = await supabaseAdmin().from("calendar_clients").select("share_token").eq("id", clientId).maybeSingle();
  const { error } = await supabaseAdmin().from("calendar_clients").update({ share_token: null, share_created_at: null }).eq("id", clientId);
  if (error) return { ok: false, error: "Couldn't turn it off." };
  refresh(data?.share_token ?? undefined);
  return { ok: true };
}
