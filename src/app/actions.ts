"use server";

import { clientFingerprint, rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type LeadState = { ok?: boolean; error?: string } | undefined;

const SERVICES = ["Photography", "Video", "Photo + video", "Social content", "Not sure yet"];

function field(fd: FormData, key: string, max: number) {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

/** "Start a project" form on the home page. Saves to the leads table for the admin. */
export async function submitLead(_prev: LeadState, fd: FormData): Promise<LeadState> {
  // Bots fill every field, people never see this one.
  if (field(fd, "website", 200)) return { ok: true };

  const name = field(fd, "name", 80);
  const email = field(fd, "email", 160);
  if (!name) return { error: "Please add your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please add a valid email so we can reply." };
  const service = field(fd, "service", 60);
  if (!(await rateLimit(`lead:${await clientFingerprint()}`, 5, 3600))) {
    return { error: "We already have your message. We will be in touch soon." };
  }

  const { error } = await supabaseAdmin()
    .from("leads")
    .insert({
      name,
      email,
      business: field(fd, "business", 120) || null,
      phone: field(fd, "phone", 40) || null,
      service: SERVICES.includes(service) ? service : null,
      message: field(fd, "message", 2000) || null,
    });
  if (error) return { error: "Something went wrong. Please try again in a minute." };
  return { ok: true };
}
