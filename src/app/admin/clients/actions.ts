"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession, requireAdmin } from "@/lib/auth";
import { isHexColor } from "@/lib/calendar";
import type { ClientContact, ClientDate } from "@/lib/client-profile-types";
import { SOCIALS } from "@/lib/client-profile-types";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ProfileState = { error?: string; ok?: string } | undefined;

const UUID = /^[0-9a-f-]{36}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(fd: FormData, key: string, max = 200) {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}
const orNull = (s: string) => (s ? s : null);

function refresh(id?: string) {
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/clients");
  if (id) revalidatePath(`/admin/clients/${id}`);
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/calendar/settings");
}

export async function saveClientProfile(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  await requireAdmin();
  const id = text(fd, "id", 36);
  const name = text(fd, "name", 60);
  const color = text(fd, "color", 7);
  if (!name) return { error: "Add the client's name." };
  if (!isHexColor(color)) return { error: "Pick a color." };

  const contacts: ClientContact[] = [];
  const names = fd.getAll("contact_name").map(String);
  const roles = fd.getAll("contact_role").map(String);
  const emails = fd.getAll("contact_email").map(String);
  const phones = fd.getAll("contact_phone").map(String);
  names.forEach((n, i) => {
    const c = { name: n.trim().slice(0, 80), role: (roles[i] ?? "").trim().slice(0, 80), email: (emails[i] ?? "").trim().slice(0, 120), phone: (phones[i] ?? "").trim().slice(0, 40) };
    if (c.name || c.email || c.phone) contacts.push({ ...c, name: c.name || c.email || c.phone });
  });

  const dates: ClientDate[] = [];
  const labels = fd.getAll("date_label").map(String);
  const values = fd.getAll("date_value").map(String);
  labels.forEach((l, i) => {
    const d = (values[i] ?? "").trim();
    if (DATE.test(d)) dates.push({ label: l.trim().slice(0, 60) || "Date", date: d });
  });

  const socials: Record<string, string> = {};
  for (const s of SOCIALS) {
    const v = text(fd, `social_${s.key}`, 200);
    if (v) socials[s.key] = v;
  }

  const rateRaw = text(fd, "monthly_rate", 20).replace(/[$,\s]/g, "");
  const rate = rateRaw ? Number(rateRaw) : null;
  if (rate != null && (!Number.isFinite(rate) || rate < 0 || rate > 99_999_999)) return { error: "The monthly rate should be a number." };

  const status = text(fd, "status", 10);
  const since = text(fd, "client_since", 10);
  const renews = text(fd, "renews_on", 10);

  const row = {
    name,
    color,
    status: ["active", "prospect", "paused", "past"].includes(status) ? status : "active",
    industry: orNull(text(fd, "industry", 80)),
    email: orNull(text(fd, "email", 120)),
    phone: orNull(text(fd, "phone", 40)),
    website: orNull(text(fd, "website", 200)),
    address: orNull(text(fd, "address", 300)),
    socials,
    contacts: contacts.slice(0, 20),
    package: orNull(text(fd, "package", 120)),
    monthly_rate: rate,
    billing_notes: orNull(text(fd, "billing_notes", 1000)),
    client_since: DATE.test(since) ? since : null,
    renews_on: DATE.test(renews) ? renews : null,
    dates: dates.slice(0, 30),
    brand_notes: orNull(text(fd, "brand_notes", 4000)),
    drive_url: orNull(text(fd, "drive_url", 500)),
    notes: orNull(text(fd, "notes", 4000)),
    updated_at: new Date().toISOString(),
  };

  // Before the 0009 update only name + color exist; fall back to those.
  const save = async (values: Record<string, unknown>) => {
    const db = supabaseAdmin().from("calendar_clients");
    if (UUID.test(id)) {
      const { error } = await db.update(values).eq("id", id);
      return error ? null : id;
    }
    const { data, error } = await db.insert(values).select("id").single();
    return error || !data ? null : (data.id as string);
  };
  const savedId = (await save(row)) ?? (await save({ name, color }));
  if (!savedId) return { error: "Couldn't save. Try again in a moment." };
  refresh(savedId);
  redirect(`/admin/clients/${savedId}`);
}

export async function deleteClientProfile(fd: FormData) {
  await requireAdmin();
  const id = text(fd, "id", 36);
  if (!UUID.test(id)) return;
  await supabaseAdmin().from("calendar_clients").delete().eq("id", id);
  refresh();
  redirect("/admin/clients");
}

export async function addClientNote(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  await requireAdmin();
  const id = text(fd, "client_id", 36);
  const body = text(fd, "body", 4000);
  if (!UUID.test(id)) return { error: "Missing client." };
  if (!body) return { error: "Write a note first." };
  const session = await getAdminSession();
  let author: string | null = null;
  if (session) {
    const { data } = await supabaseAdmin().from("admin_users").select("display_name").eq("id", session.userId).maybeSingle();
    author = (data?.display_name as string) ?? null;
  }
  const { error } = await supabaseAdmin().from("client_notes").insert({ client_id: id, body, author });
  if (error) return { error: "Couldn't save the note. The client profile database update may not be applied yet." };
  revalidatePath(`/admin/clients/${id}`);
  return { ok: "Saved." };
}

export async function deleteClientNote(fd: FormData) {
  await requireAdmin();
  const id = text(fd, "id", 36);
  const clientId = text(fd, "client_id", 36);
  if (!UUID.test(id)) return;
  await supabaseAdmin().from("client_notes").delete().eq("id", id);
  revalidatePath(`/admin/clients/${clientId}`);
}
