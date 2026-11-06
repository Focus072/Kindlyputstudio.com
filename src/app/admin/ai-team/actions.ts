"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/ai-team/adapter";
import {
  createCampaign, createConversation, createHandoff, getAssistantMessageInClient, getCampaign, getClient,
  saveGuideline, setHandoffStatus,
} from "@/lib/ai-team/store";
import { getSpecialist, PIPELINE, type SpecialistId } from "@/lib/ai-team/specialists";
import { BASE, clientPath } from "./paths";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
async function clientOrBack(id: string) {
  const c = id ? await getClient(id) : null;
  if (!c) redirect(BASE);
  return c;
}

export async function newCampaign(formData: FormData) {
  const m = await requireTeamMember();
  const c = await clientOrBack(str(formData, "client"));
  const name = str(formData, "name");
  if (name) await createCampaign(c.id, m.id, name, str(formData, "goal"));
  revalidatePath(clientPath(c.id));
}

export async function upsertGuideline(formData: FormData) {
  const m = await requireTeamMember();
  const c = await clientOrBack(str(formData, "client"));
  const s = str(formData, "status");
  const status = ["draft", "approved", "archived"].includes(s) ? s : "draft";
  const title = str(formData, "title");
  const body = str(formData, "body");
  if (title && body) await saveGuideline(c.id, m.id, { id: str(formData, "id") || undefined, title, body, status });
  redirect(`${clientPath(c.id)}/brand`);
}

export async function startConversation(formData: FormData) {
  const m = await requireTeamMember();
  const c = await clientOrBack(str(formData, "client"));
  const s = getSpecialist(str(formData, "specialist"));
  if (!s) redirect(clientPath(c.id));
  const campaignId = str(formData, "campaign");
  const campaign = campaignId ? await getCampaign(c.id, campaignId) : null;
  const id = await createConversation(c.id, s.id, m.id, campaign?.id ?? null);
  redirect(`${clientPath(c.id)}/chat/${id}`);
}

export async function saveHandoff(formData: FormData) {
  const m = await requireTeamMember();
  const c = await clientOrBack(str(formData, "client"));
  const msg = await getAssistantMessageInClient(c.id, str(formData, "message"));
  if (!msg) redirect(clientPath(c.id));
  const to = str(formData, "to");
  if (to !== "review" && !(PIPELINE as readonly string[]).includes(to)) redirect(`${clientPath(c.id)}/chat/${msg.conversation_id}`);
  await createHandoff({
    clientId: c.id, campaignId: msg.campaign_id, from: msg.specialist_id, to: to as SpecialistId | "review",
    title: str(formData, "title") || "Handoff", content: str(formData, "content") || msg.content,
    sourceMessageId: msg.id, memberId: m.id,
  });
  redirect(`${clientPath(c.id)}/handoffs?saved=1`);
}

export async function reviewHandoff(formData: FormData) {
  const m = await requireTeamMember();
  const c = await clientOrBack(str(formData, "client"));
  const status = str(formData, "status");
  if (["approved", "changes_requested", "draft", "archived"].includes(status)) {
    await setHandoffStatus(c.id, str(formData, "id"), status, m.id);
  }
  revalidatePath(`${clientPath(c.id)}/handoffs`);
}
