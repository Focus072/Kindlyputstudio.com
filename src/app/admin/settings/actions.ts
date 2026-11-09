"use server";

import { revalidatePath } from "next/cache";
import { getTheme } from "@/config/themes";
import { isEmail, normalizeEmail } from "@/lib/access";
import { requireAdmin } from "@/lib/auth";
import { randomFileKey } from "@/lib/slug";
import { PREVIEWS_BUCKET } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type SettingsState = { ok?: boolean; error?: string; revision: number } | undefined;

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg", "image/jpeg": "jpg" };

function text(fd: FormData, key: string, max: number) {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

export async function saveSettings(previous: SettingsState, fd: FormData): Promise<SettingsState> {
  await requireAdmin();
  const revision = previous?.revision ?? 0;
  const failure = (error: string) => ({ error, revision });
  const contact = normalizeEmail(text(fd, "contact_email", 160));
  if (contact && !isEmail(contact)) return failure("The contact email does not look right.");

  const patch: Record<string, string | null> = {
    agency_name: text(fd, "agency_name", 60) || "Kindly Put Studio",
    delivered_by: text(fd, "delivered_by", 60) || null,
    powered_by_label: text(fd, "powered_by_label", 60) || null,
    contact_email: contact || null,
    default_theme: getTheme(text(fd, "default_theme", 30)).id,
    updated_at: new Date().toISOString(),
  };

  const db = supabaseAdmin();
  const logo = fd.get("logo");
  if (fd.get("reset_logo") === "on") {
    patch.logo_path = null;
  } else if (logo instanceof File && logo.size > 0) {
    const ext = LOGO_TYPES[logo.type];
    if (!ext) return failure("Upload the logo as PNG, WebP, SVG, or JPG.");
    if (logo.size > 900_000) return failure("Keep the logo under 900 KB.");
    const path = `studio/logo-${randomFileKey()}.${ext}`;
    const { error } = await db.storage
      .from(PREVIEWS_BUCKET)
      .upload(path, logo, { contentType: logo.type, cacheControl: "31536000", upsert: false });
    if (error) return failure("Could not upload the logo. Please try again.");
    patch.logo_path = path;
  }
  const { error } = await db.from("settings").update(patch).eq("id", 1);
  if (error) return failure("Could not save. Please try again.");
  revalidatePath("/", "layout");
  return { ok: true, revision: revision + 1 };
}
