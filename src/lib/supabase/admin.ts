import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "@/lib/env";

let client: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the secret key. It bypasses row level
 * security, so every caller must check the room slug or the admin session first.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl(), supabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
