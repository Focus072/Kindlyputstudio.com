import "server-only";
import { cache } from "react";
import { brand } from "@/config/brand";
import { getTheme } from "@/config/themes";
import { previewUrl } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type StudioSettings = {
  /** Studio name shown in rooms and the admin. */
  name: string;
  /** Default "Delivered by" for new rooms. */
  deliveredBy: string;
  /** Small tag in the top corner of every room. */
  poweredByLabel: string;
  /** Shown on the privacy and terms pages and closed rooms. */
  contactEmail: string | null;
  defaultTheme: string;
  /** Logo mark for dark backgrounds (rooms, admin header). */
  markOnDark: string;
  /** Path in the previews bucket when a custom logo was uploaded. */
  logoPath: string | null;
};

export const DEFAULT_SETTINGS: StudioSettings = {
  name: brand.name,
  deliveredBy: brand.deliveredBy,
  poweredByLabel: brand.poweredByLabel,
  contactEmail: null,
  defaultTheme: "studio",
  markOnDark: brand.logo.markOnDark,
  logoPath: null,
};

/**
 * Studio branding saved from Admin > Settings, with the brand kit in
 * src/config/brand.ts as the fallback for anything left blank.
 */
export const getStudioSettings = cache(async (): Promise<StudioSettings> => {
  try {
    const { data, error } = await supabaseAdmin().from("settings").select("*").eq("id", 1).maybeSingle();
    if (error || !data) return DEFAULT_SETTINGS;
    const row = data as Record<string, string | null>;
    return {
      name: row.agency_name?.trim() || DEFAULT_SETTINGS.name,
      deliveredBy: row.delivered_by?.trim() || DEFAULT_SETTINGS.deliveredBy,
      poweredByLabel: row.powered_by_label?.trim() || DEFAULT_SETTINGS.poweredByLabel,
      contactEmail: row.contact_email?.trim() || null,
      defaultTheme: getTheme(row.default_theme).id,
      markOnDark: previewUrl(row.logo_path) ?? DEFAULT_SETTINGS.markOnDark,
      logoPath: row.logo_path ?? null,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
});
