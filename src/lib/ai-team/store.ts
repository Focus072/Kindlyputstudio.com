import "server-only";
import { db } from "./adapter";
import type { SpecialistId } from "./specialists";

/**
 * Data access for the AI Team, using the website's server-only Supabase
 * client. Every function takes a clientId (calendar_clients.id) and filters
 * by it, so one client's chats, guidelines and handoffs never leak into
 * another's.
 */

export interface StudioClient { id: string; name: string; color: string | null }
export interface Guideline { id: string; client_id: string; title: string; body: string; status: string; updated_at: string; updated_by_name: string | null }
export interface Campaign { id: string; client_id: string; name: string; goal: string; status: string; created_at: string }
export interface Conversation {
  id: string; client_id: string; campaign_id: string | null; specialist_id: SpecialistId; title: string;
  created_at: string; updated_at: string; created_by_name: string | null; message_count: number;
}
export interface Message {
  id: string; conversation_id: string; role: "user" | "assistant"; content: string;
  author_name: string | null; model: string | null; created_at: string;
  /** On a team member's message, "refusal" means Claude declined it and it's left out of later turns. */
  stop_reason: string | null;
}
export interface Handoff {
  id: string; client_id: string; campaign_id: string | null; campaign_name: string | null;
  from_specialist: SpecialistId; to_stage: SpecialistId | "review"; title: string; content: string; status: string;
  created_at: string; approved_at: string | null; created_by_name: string | null; approved_by_name: string | null;
  source_conversation_id: string | null;
}

/** Ids in URLs and forms are checked first, so a mistyped link shows "not found" instead of a database error. */
const isUuid = (s: string | null | undefined): s is string =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(`AI Team database error: ${r.error.message}`);
  return r.data as T;
}
type Named = { display_name: string | null } | null;
const nameOf = (n: Named | Named[]) => (Array.isArray(n) ? n[0]?.display_name : n?.display_name) ?? null;

// ---------- clients (existing calendar_clients table, read-only) ----------
export async function listClients(): Promise<StudioClient[]> {
  return check(await db().from("calendar_clients").select("id, name, color").order("name"));
}
export async function getClient(id: string): Promise<StudioClient | null> {
  if (!isUuid(id)) return null;
  return check(await db().from("calendar_clients").select("id, name, color").eq("id", id).maybeSingle());
}

// ---------- brand guidelines ----------
export async function listGuidelines(clientId: string): Promise<Guideline[]> {
  const rows = check(
    await db().from("ai_team_brand_guidelines")
      .select("id, client_id, title, body, status, updated_at, updater:admin_users!ai_team_brand_guidelines_updated_by_fkey(display_name)")
      .eq("client_id", clientId).neq("status", "archived")
      .order("updated_at", { ascending: false }),
  ) as unknown as (Omit<Guideline, "updated_by_name"> & { updater: Named | Named[] })[];
  return rows
    .map(({ updater, ...g }) => ({ ...g, updated_by_name: nameOf(updater) }))
    .sort((a, b) => Number(b.status === "approved") - Number(a.status === "approved"));
}
export async function saveGuideline(clientId: string, memberId: string, input: { id?: string; title: string; body: string; status: string }) {
  const row = { title: input.title, body: input.body, status: input.status, updated_by: memberId, updated_at: new Date().toISOString() };
  if (input.id && !isUuid(input.id)) return;
  if (input.id) check(await db().from("ai_team_brand_guidelines").update(row).eq("id", input.id).eq("client_id", clientId));
  else check(await db().from("ai_team_brand_guidelines").insert({ ...row, client_id: clientId }));
}

// ---------- campaigns ----------
export async function listCampaigns(clientId: string): Promise<Campaign[]> {
  return check(await db().from("ai_team_campaigns").select("id, client_id, name, goal, status, created_at")
    .eq("client_id", clientId).neq("status", "archived").order("created_at", { ascending: false }));
}
export async function getCampaign(clientId: string, id: string): Promise<Campaign | null> {
  if (!isUuid(id)) return null;
  return check(await db().from("ai_team_campaigns").select("id, client_id, name, goal, status, created_at")
    .eq("client_id", clientId).eq("id", id).maybeSingle());
}
export async function createCampaign(clientId: string, memberId: string, name: string, goal: string) {
  check(await db().from("ai_team_campaigns").insert({ client_id: clientId, name, goal, created_by: memberId }));
}

// ---------- conversations & messages ----------
const CONVO_SELECT =
  "id, client_id, campaign_id, specialist_id, title, created_at, updated_at, creator:admin_users!ai_team_conversations_created_by_fkey(display_name), ai_team_messages(count)";
type ConvoRow = Omit<Conversation, "created_by_name" | "message_count"> & { creator: Named | Named[]; ai_team_messages: { count: number }[] };
const toConvo = ({ creator, ai_team_messages, ...c }: ConvoRow): Conversation => ({
  ...c, created_by_name: nameOf(creator), message_count: ai_team_messages?.[0]?.count ?? 0,
});

export async function listConversations(clientId: string, specialistId?: SpecialistId): Promise<Conversation[]> {
  let q = db().from("ai_team_conversations").select(CONVO_SELECT).eq("client_id", clientId);
  if (specialistId) q = q.eq("specialist_id", specialistId);
  const rows = check(await q.order("updated_at", { ascending: false }).limit(100)) as unknown as ConvoRow[];
  return rows.map(toConvo);
}
export async function getConversation(clientId: string, id: string): Promise<Conversation | null> {
  if (!isUuid(id)) return null;
  const row = check(await db().from("ai_team_conversations").select(CONVO_SELECT)
    .eq("client_id", clientId).eq("id", id).maybeSingle()) as unknown as ConvoRow | null;
  return row ? toConvo(row) : null;
}
export async function createConversation(clientId: string, specialistId: SpecialistId, memberId: string, campaignId: string | null) {
  const r = check(await db().from("ai_team_conversations")
    .insert({ client_id: clientId, specialist_id: specialistId, created_by: memberId, campaign_id: campaignId })
    .select("id").single()) as { id: string };
  return r.id;
}
export async function listMessages(conversationId: string): Promise<Message[]> {
  const rows = check(await db().from("ai_team_messages")
    .select("id, conversation_id, role, content, model, stop_reason, created_at, author:admin_users!ai_team_messages_author_id_fkey(display_name)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true }).order("id", { ascending: true })) as unknown as (Omit<Message, "author_name"> & { author: Named | Named[] })[];
  return rows.map(({ author, ...m }) => ({ ...m, author_name: nameOf(author) }));
}
export async function addMessage(input: {
  conversationId: string; role: "user" | "assistant"; content: string; authorId?: string | null;
  model?: string | null; inputTokens?: number | null; outputTokens?: number | null; stopReason?: string | null;
}) {
  const r = check(await db().from("ai_team_messages").insert({
    conversation_id: input.conversationId, role: input.role, content: input.content, author_id: input.authorId ?? null,
    model: input.model ?? null, input_tokens: input.inputTokens ?? null, output_tokens: input.outputTokens ?? null,
    stop_reason: input.stopReason ?? null,
  }).select("id").single()) as { id: string };
  check(await db().from("ai_team_conversations").update({ updated_at: new Date().toISOString() }).eq("id", input.conversationId));
  return r.id;
}
/** Claude declined this message: keep it on screen, but stop sending it with later turns. */
export async function markDeclined(conversationId: string, messageId: string) {
  check(await db().from("ai_team_messages").update({ stop_reason: "refusal" })
    .eq("id", messageId).eq("conversation_id", conversationId).eq("role", "user"));
}
export async function setConversationTitleIfDefault(id: string, title: string) {
  check(await db().from("ai_team_conversations").update({ title }).eq("id", id).eq("title", "New conversation"));
}

// ---------- handoffs (approved briefs) ----------
const HANDOFF_SELECT = `id, client_id, campaign_id, from_specialist, to_stage, title, content, status, created_at, approved_at,
  campaign:ai_team_campaigns(name),
  creator:admin_users!ai_team_handoffs_created_by_fkey(display_name),
  approver:admin_users!ai_team_handoffs_approved_by_fkey(display_name),
  source:ai_team_messages(conversation_id)`;
type HandoffRow = Omit<Handoff, "campaign_name" | "created_by_name" | "approved_by_name" | "source_conversation_id"> & {
  campaign: { name: string } | null; creator: Named | Named[]; approver: Named | Named[]; source: { conversation_id: string } | null;
};
const toHandoff = ({ campaign, creator, approver, source, ...h }: HandoffRow): Handoff => ({
  ...h, campaign_name: campaign?.name ?? null, created_by_name: nameOf(creator), approved_by_name: nameOf(approver),
  source_conversation_id: source?.conversation_id ?? null,
});

export async function listHandoffs(clientId: string): Promise<Handoff[]> {
  const rows = check(await db().from("ai_team_handoffs").select(HANDOFF_SELECT)
    .eq("client_id", clientId).neq("status", "archived").order("created_at", { ascending: false })) as unknown as HandoffRow[];
  return rows.map(toHandoff);
}

/** Approved handoffs for the same client and the same campaign (or no campaign). */
export async function approvedHandoffsFor(clientId: string, campaignId: string | null): Promise<Handoff[]> {
  let q = db().from("ai_team_handoffs").select(HANDOFF_SELECT).eq("client_id", clientId).eq("status", "approved");
  q = campaignId ? q.eq("campaign_id", campaignId) : q.is("campaign_id", null);
  const rows = check(await q.order("approved_at", { ascending: true })) as unknown as HandoffRow[];
  return rows.map(toHandoff);
}

export async function createHandoff(input: {
  clientId: string; campaignId: string | null; from: SpecialistId; to: SpecialistId | "review";
  title: string; content: string; sourceMessageId: string | null; memberId: string;
}) {
  check(await db().from("ai_team_handoffs").insert({
    client_id: input.clientId, campaign_id: input.campaignId, from_specialist: input.from, to_stage: input.to,
    title: input.title, content: input.content, source_message_id: input.sourceMessageId, created_by: input.memberId,
  }));
}

export async function setHandoffStatus(clientId: string, id: string, status: string, memberId: string) {
  if (!isUuid(id)) return;
  const approved = status === "approved";
  check(await db().from("ai_team_handoffs").update({
    status, approved_by: approved ? memberId : null, approved_at: approved ? new Date().toISOString() : null,
  }).eq("id", id).eq("client_id", clientId));
}

/** An assistant message, but only if its conversation belongs to this client. */
export async function getAssistantMessageInClient(clientId: string, messageId: string) {
  if (!isUuid(messageId)) return null;
  const row = check(await db().from("ai_team_messages")
    .select("id, conversation_id, role, content, convo:ai_team_conversations!inner(client_id, specialist_id, campaign_id)")
    .eq("id", messageId).eq("convo.client_id", clientId).maybeSingle()) as unknown as
    | { id: string; conversation_id: string; role: string; content: string; convo: { client_id: string; specialist_id: SpecialistId; campaign_id: string | null } }
    | null;
  if (!row || row.role !== "assistant") return null;
  return { id: row.id, conversation_id: row.conversation_id, content: row.content, specialist_id: row.convo.specialist_id, campaign_id: row.convo.campaign_id };
}
