"use server";

import { redirect } from "next/navigation";
import { endAdminSession, passwordMatches, startAdminSession } from "@/lib/auth";

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  // Small delay slows down password guessing.
  await new Promise((r) => setTimeout(r, 400));
  if (!password || !passwordMatches(password)) {
    return { error: "That password is not right." };
  }
  await startAdminSession();
  redirect("/admin");
}

export async function logout() {
  await endAdminSession();
  redirect("/login");
}
