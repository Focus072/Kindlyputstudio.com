"use server";

import { redirect } from "next/navigation";
import { checkCredentials, endAdminSession, startAdminSession } from "@/lib/auth";

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim().slice(0, 60);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!username || !password) return { error: "Enter your username and password." };

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
