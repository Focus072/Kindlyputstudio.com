import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { TEAM_CHARTER, SPECIALISTS, getSpecialist, type SpecialistId } from "./specialists";
import type { Campaign, Guideline, Handoff, Message, StudioClient } from "./store";

export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
// "medium" balances quality and cost for chat; "low" is cheaper and faster, "high" thinks harder.
const EFFORT = (process.env.CLAUDE_EFFORT || "medium") as "low" | "medium" | "high" | "xhigh" | "max";

let client: Anthropic | null = null;
export function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set in the server environment.");
  client ??= new Anthropic();
  return client;
}
export const claudeConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

function stageName(stage: string) {
  if (stage === "review") return "Human review";
  const s = getSpecialist(stage);
  return s ? `${s.name} (${s.role})` : stage;
}
const attr = (s: string) => s.replace(/"/g, "'");

/**
 * Per-client context for a specialist, rebuilt from storage on every turn:
 * approved brand guidelines, campaign details, approved handoffs. Specialists
 * share nothing else; separate chats do not share memory.
 */
export function buildWorkspaceContext(args: {
  client: StudioClient; campaign: Campaign | null; guidelines: Guideline[]; handoffs: Handoff[]; specialistId: SpecialistId;
}) {
  const { client, campaign, guidelines, handoffs, specialistId } = args;
  const approved = guidelines.filter((g) => g.status === "approved");
  const lines = [`# Current workspace`, `Client: ${client.name}`];
  lines.push(campaign
    ? `Campaign: ${campaign.name}${campaign.goal ? `\nCampaign goal: ${campaign.goal}` : ""}`
    : `Campaign: none selected. This is a general conversation for this client.`);
  lines.push(`\n## Approved brand guidelines`);
  if (!approved.length) lines.push(`None have been approved for this client yet. Say so if brand rules matter for the request, and flag anything that needs confirming.`);
  for (const g of approved) lines.push(`<guideline title="${attr(g.title)}">\n${g.body}\n</guideline>`);
  lines.push(`\n## Approved handoffs${campaign ? " for this campaign" : " (no campaign)"}`);
  if (!handoffs.length) lines.push(`None yet. You have no approved work from other specialists for this ${campaign ? "campaign" : "client"}.`);
  for (const h of handoffs) {
    const from = SPECIALISTS[h.from_specialist];
    const forYou = h.to_stage === specialistId ? " (addressed to you)" : "";
    lines.push(`<handoff from="${from.name} (${from.role})" to="${stageName(h.to_stage)}"${forYou} title="${attr(h.title)}">\n${h.content}\n</handoff>`);
  }
  return lines.join("\n");
}

export function systemBlocks(specialistId: SpecialistId, workspaceContext: string): Anthropic.TextBlockParam[] {
  const s = SPECIALISTS[specialistId];
  return [
    // Stable prefix (team rules + role) is cached across turns and chats.
    { type: "text", text: `${TEAM_CHARTER}\n\n${s.instructions}`, cache_control: { type: "ephemeral" } },
    { type: "text", text: workspaceContext },
  ];
}

/** Stored history → API turns. Sender names are kept so specialists know who said what. */
export function toApiMessages(history: Pick<Message, "role" | "content" | "author_name" | "stop_reason">[]): Anthropic.MessageParam[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of history) {
    // A message Claude declined stays on screen but isn't sent again, so it
    // can't keep tripping the same refusal on every later turn.
    if (m.role === "user" && m.stop_reason === "refusal") continue;
    const content = m.role === "user" && m.author_name ? `[${m.author_name}] ${m.content}` : m.content;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${content}`; // e.g. a turn whose reply failed
    else out.push({ role: m.role, content });
  }
  return out;
}

export function streamReply(specialistId: SpecialistId, workspaceContext: string, messages: Anthropic.MessageParam[]) {
  return anthropic().beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: systemBlocks(specialistId, workspaceContext),
    messages,
  });
}
