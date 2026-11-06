import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** The caller's IP, hashed so raw addresses are never stored. */
export async function clientFingerprint(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`kp-rate:${ip}`).digest("hex").slice(0, 24);
}

/**
 * Allows `limit` hits per `windowSeconds` for a key. Returns false once the
 * limit is reached. Fails open if the database cannot be reached, so a
 * hiccup never locks real people out.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const db = supabaseAdmin();
    const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
    const { count, error } = await db
      .from("rate_events")
      .select("id", { count: "exact", head: true })
      .eq("key", key)
      .gte("created_at", since);
    if (error) return true;
    if ((count ?? 0) >= limit) return false;
    await db.from("rate_events").insert({ key });
    // Keep the table small: drop entries older than a day now and then.
    if (Math.random() < 0.02) {
      await db.from("rate_events").delete().lt("created_at", new Date(Date.now() - 86_400_000).toISOString());
    }
    return true;
  } catch {
    return true;
  }
}
