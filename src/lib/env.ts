import "server-only";

// Accepts both the names in .env.example and the names the Vercel + Supabase
// integration adds automatically, so either setup works without renaming.

export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!v) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL. See .env.example.");
  return v.replace(/\/$/, "");
}

export function supabaseSecretKey(): string {
  const v = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!v) throw new Error("Missing SUPABASE_SECRET_KEY. See .env.example.");
  return v;
}
