import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseSecretKey } from "@/lib/env";
import { verifyPassword } from "@/lib/password";
import { supabaseAdmin } from "@/lib/supabase/admin";

const COOKIE = "kp_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Signs the login cookie. Uses SESSION_SECRET when set; otherwise a key
 * derived from the Supabase secret key, so no extra setting is required.
 */
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  return createHmac("sha256", supabaseSecretKey()).update("kp-admin-session-v1").digest("hex");
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export type AdminSession = { userId: string; expires: number };

/** Checks a username and password against the admin_users table. */
export async function checkCredentials(username: string, password: string) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("admin_users")
    .select("id, username, display_name, password_hash")
    .ilike("username", username.replace(/[%_\\]/g, "\\$&"))
    .maybeSingle();
  // Always run a hash check so wrong usernames take as long as wrong passwords.
  const ok = await verifyPassword(
    password,
    data?.password_hash ??
      "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  );
  if (!data || !ok) return null;
  await db.from("admin_users").update({ last_login_at: new Date().toISOString() }).eq("id", data.id);
  return { id: data.id as string, displayName: data.display_name as string };
}

export async function startAdminSession(userId: string) {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = `admin.${userId}.${expires}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(COOKIE);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const lastDot = raw.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = raw.slice(0, lastDot);
  const sig = raw.slice(lastDot + 1);
  let valid = false;
  try {
    valid = safeEqual(sig, sign(payload));
  } catch {
    return null;
  }
  if (!valid) return null;
  const [kind, userId, exp] = payload.split(".");
  const expires = Number(exp);
  if (kind !== "admin" || !userId || !Number.isFinite(expires) || expires < Date.now() / 1000) return null;
  return { userId, expires };
}

export async function isAdmin(): Promise<boolean> {
  return (await getAdminSession()) !== null;
}

/** Call at the top of every admin page and admin server action. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/login");
}
