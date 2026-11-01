import "server-only";
import { SUPABASE_PUBLIC_FALLBACK } from "@/config/supabase-public";

// Accepts both the names in .env.example and the names the Vercel + Supabase
// integration adds automatically, so either setup works without renaming.

export function supabaseUrl(): string {
  const v =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || SUPABASE_PUBLIC_FALLBACK.url;
  return v.replace(/\/$/, "");
}

export function supabaseSecretKey(): string {
  const v = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!v) throw new Error("Missing SUPABASE_SECRET_KEY. See .env.example.");
  return v;
}

/** URL + publishable key for browser sign-in. Safe to send to the client. */
export function supabasePublicConfig(): { url: string; key: string } {
  const url = supabaseUrl();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    (url === SUPABASE_PUBLIC_FALLBACK.url ? SUPABASE_PUBLIC_FALLBACK.publishableKey : "");
  if (!key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. See .env.example.");
  return { url, key };
}
