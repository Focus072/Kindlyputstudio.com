import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ClientProfileForm } from "@/components/admin/clients/ClientProfileForm";
import { requireAdmin } from "@/lib/auth";
import { SWATCHES } from "@/lib/calendar";
import { listClientProfiles } from "@/lib/client-profiles";

export default async function NewClientPage() {
  await requireAdmin();
  const used = new Set((await listClientProfiles()).map((c) => c.color.toLowerCase()));
  const suggested = SWATCHES.find((c) => !used.has(c.toLowerCase())) ?? SWATCHES[0];
  return (
    <main className="max-w-5xl">
      <Link href="/admin/clients" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink max-sm:-my-2.5 max-sm:py-2.5">
        <ChevronLeft className="size-4" /> All clients
      </Link>
      <h1 className="mt-1 font-display text-[2.375rem] uppercase leading-none text-ink sm:mt-2 sm:text-5xl">New client</h1>
      <p className="mt-1 text-sm text-slate-500">Only the name is required. Fill in the rest whenever.</p>
      <div className="mt-6">
        <ClientProfileForm suggestedColor={suggested} />
      </div>
    </main>
  );
}
