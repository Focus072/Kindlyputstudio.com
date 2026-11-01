import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { brand } from "@/config/brand";
import { getClientUser } from "@/lib/client-auth";
import { supabasePublicConfig } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { NewPasswordForm } from "./NewPasswordForm";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

/** Landing page for password reset links: the link has already signed the client in. */
export default async function NewPasswordPage({ searchParams }: PageProps<"/account/password">) {
  const sp = await searchParams;
  const client = await getClientUser();
  if (!client) redirect("/account?auth_error=reset");
  const { url, key } = supabasePublicConfig();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-5 py-[calc(2rem+env(safe-area-inset-top))] text-cloud">
      <div className="w-full max-w-sm">
        <img src={brand.logo.markOnDark} alt={brand.name} className="h-10 w-auto" />
        <h1 className="mt-6 font-display text-4xl uppercase leading-none">Set a new password</h1>
        <p className="mt-2 text-sm text-mist/80">
          For <span className="font-semibold text-white">{client.email}</span>. You will stay signed in on this device.
        </p>
        <NewPasswordForm supabaseUrl={url} supabaseKey={key} next={safeNext(sp.next)} />
      </div>
    </main>
  );
}
