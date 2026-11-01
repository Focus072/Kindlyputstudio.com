import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { brand } from "@/config/brand";
import { isAdmin } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <p className="font-typewriter text-sm text-slate-500">{brand.legalName}</p>
        <h1 className="mt-2 font-display text-5xl uppercase tracking-wide text-slate-900">Studio admin</h1>
        <LoginForm />
      </div>
    </main>
  );
}
