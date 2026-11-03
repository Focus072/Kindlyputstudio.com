"use server";

import { redirect } from "next/navigation";
import { checkCredentials, endAdminSession, startAdminSession } from "@/lib/auth";
import { clientFingerprint, rateLimit } from "@/lib/rate-limit";

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim().slice(0, 60);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!username || !password) return { error: "Enter your username and password." };

  // 10 tries per 15 minutes from one address, and 20 per account, stops password guessing.
  const ip = await clientFingerprint();
  const [ipOk, userOk] = await Promise.all([
    rateLimit(`login:ip:${ip}`, 10, 900),
    rateLimit(`login:user:${username.toLowerCase()}`, 20, 900),
  ]);
  if (!ipOk || !userOk) return { error: "Too many tries. Wait 15 minutes and try again." };

  // Small delay slows down password guessing.
  await new Promise((r) => setTimeout(r, 400));
  const user = await checkCredentials(username, password);
  if (!user) return { error: "That username or password is not right." };

  await startAdminSession(user.id);
  redirect("/admin");
}

export async function logout() {
  await endAdminSession();
  redirect("/login");
}
