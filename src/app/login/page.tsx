import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { brand } from "@/config/brand";
import { isAdmin } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-5 py-[env(safe-area-inset-top)]">
      <div className="w-full max-w-sm">
        <img src={brand.logo.fullOnDark} alt={brand.name} className="mx-auto h-28 w-auto" />
        <h1 className="mt-8 text-center font-display text-5xl uppercase text-white">Studio admin</h1>
        <LoginForm />
        <p className="mt-8 text-center text-sm">
          <Link href="/" className="text-white/60 underline-offset-4 hover:text-white hover:underline">
            Back to {brand.name}
          </Link>
          <span className="px-2 text-white/30">·</span>
          <Link href="/account" className="text-white/60 underline-offset-4 hover:text-white hover:underline">
            Client login
          </Link>
        </p>
      </div>
    </main>
  );
}
