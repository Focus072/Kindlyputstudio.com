"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { BufferError, getBufferKey, saveBufferKey } from "@/lib/buffer";
import { isHexColor, PLATFORMS } from "@/lib/calendar";
import { syncChannels } from "@/lib/calendar-data";
import { studioToUtc } from "@/lib/calendar-time";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ActionState = { error?: string; ok?: string } | undefined;

const UUID = /^[0-9a-f-]{36}$/;

function text(fd: FormData, key: string, max = 120) {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

function refresh() {
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/calendar/settings");
}

// Clients --------------------------------------------------------------------

export async function saveClient(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = text(fd, "id", 36);
  const name = text(fd, "name", 60);
  const color = text(fd, "color", 7);
  if (!name) return { error: "Add the client's name." };
  if (!isHexColor(color)) return { error: "Pick a color." };
  const db = supabaseAdmin().from("calendar_clients");
  const { error } = UUID.test(id) ? await db.update({ name, color }).eq("id", id) : await db.insert({ name, color });
  if (error) return { error: "Couldn't save. Has the calendar database update been run?" };
  refresh();
  return { ok: UUID.test(id) ? "Saved." : `${name} added.` };
}

export async function deleteClient(fd: FormData) {
  await requireAdmin();
  const id = text(fd, "id", 36);
  if (!UUID.test(id)) return;
  await supabaseAdmin().from("calendar_clients").delete().eq("id", id);
  refresh();
}

// Posts added by hand ----------------------------------------------------------

export async function savePost(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = text(fd, "id", 36);
  const clientId = text(fd, "client_id", 36);
  const date = text(fd, "date", 10);
  const time = text(fd, "time", 5) || "09:00";
  const platformRaw = text(fd, "platform", 30);
  const platform = PLATFORMS.some((p) => p.id === platformRaw) ? platformRaw : "other";
  const status = text(fd, "status", 12);
  const caption = text(fd, "caption", 5000);
  const notes = text(fd, "notes", 2000);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a date." };
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: "Pick a time." };
  const row = {
    client_id: UUID.test(clientId) ? clientId : null,
    scheduled_at: studioToUtc(date, time).toISOString(),
    platform,
    status: ["idea", "draft", "scheduled", "posted"].includes(status) ? status : "scheduled",
    caption: caption || null,
    notes: notes || null,
    updated_at: new Date().toISOString(),
  };
  const db = supabaseAdmin().from("calendar_posts");
  const { error } = UUID.test(id) ? await db.update(row).eq("id", id) : await db.insert(row);
  if (error) return { error: "Couldn't save the post. Has the calendar database update been run?" };
  refresh();
  return { ok: "Saved." };
}

export async function deletePost(fd: FormData) {
  await requireAdmin();
  const id = text(fd, "id", 36);
  if (!UUID.test(id)) return;
  await supabaseAdmin().from("calendar_posts").delete().eq("id", id);
  refresh();
}

// Buffer ---------------------------------------------------------------------

export async function connectBuffer(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const key = text(fd, "api_key", 400);
  if (key.length < 10) return { error: "Paste the API key from Buffer." };
  try {
    const { channels } = await syncChannels(key);
    await saveBufferKey(key);
    refresh();
    return { ok: `Connected. Found ${channels.length} channel${channels.length === 1 ? "" : "s"}.` };
  } catch (e) {
    return { error: e instanceof BufferError ? e.message : "Couldn't save the key. Has the calendar database update been run?" };
  }
}

export async function disconnectBuffer() {
  await requireAdmin();
  await saveBufferKey(null);
  refresh();
}

export async function refreshChannels(): Promise<ActionState> {
  await requireAdmin();
  const key = await getBufferKey();
  if (!key) return { error: "Connect Buffer first." };
  try {
    const { channels } = await syncChannels(key.key);
    refresh();
    return { ok: `Found ${channels.length} channel${channels.length === 1 ? "" : "s"}.` };
  } catch (e) {
    return { error: e instanceof BufferError ? e.message : "Couldn't reach Buffer." };
  }
}

export async function assignChannel(fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();
  const channelId = text(fd, "channel_id", 80);
  const clientId = text(fd, "client_id", 36);
  if (!channelId) return { error: "Missing channel." };
  const { error } = await supabaseAdmin()
    .from("buffer_channels")
    .update({ client_id: UUID.test(clientId) ? clientId : null })
    .eq("id", channelId);
  refresh();
  return error ? { error: "Couldn't save. Refresh the page and try again." } : { ok: true };
}
