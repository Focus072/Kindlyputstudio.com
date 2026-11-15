import Link from "next/link";
import { Plus } from "lucide-react";
import { ClientDirectory, type DirectoryClient } from "@/components/admin/clients/ClientDirectory";
import { ClientsTabs } from "@/components/admin/clients/ClientsTabs";
import { requireAdmin } from "@/lib/auth";
import { channelsByClient, listClientProfiles, sameName } from "@/lib/client-profiles";
import { nextOccurrence } from "@/lib/client-profile-types";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function ClientsPage() {
  await requireAdmin();
  const db = supabaseAdmin();
  const [profiles, channels, { data: rooms }, { count: logins }] = await Promise.all([
    listClientProfiles(),
    channelsByClient(),
    db.from("rooms").select("client_name, status"),
    db.from("clients").select("id", { count: "exact", head: true }),
  ]);

  const list: DirectoryClient[] = profiles.map((p) => {
    const mine = (rooms ?? []).filter((r) => sameName(r.client_name as string, p.name));
    const upcoming = [
      ...(p.renews_on ? [{ label: "Renews", date: p.renews_on, yearly: false }] : []),
      ...p.dates.map((d) => ({ ...d, yearly: true })),
    ]
      .map((d) => ({ label: d.label, at: d.yearly ? nextOccurrence(d.date) : new Date(`${d.date}T12:00:00`) }))
      .filter((d): d is { label: string; at: Date } => !!d.at && d.at.getTime() >= Date.now() - 864e5)
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      status: p.status,
      industry: p.industry,
      contact: p.contacts[0] ?? null,
      email: p.email,
      phone: p.phone,
      package: p.package,
      rate: p.monthly_rate,
      rooms: mine.length,
      liveRooms: mine.filter((r) => r.status === "live").length,
      accounts: (channels.get(p.id) ?? []).map((c) => c.service),
      next: upcoming ? { label: upcoming.label, at: upcoming.at.toISOString() } : null,
    };
  });

  return (
    <main>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-typewriter text-sm text-slate-500 max-sm:hidden">Client book</p>
          <h1 className="font-display text-[2.375rem] uppercase leading-none text-ink sm:text-5xl">Clients</h1>
        </div>
        <Link
          href="/admin/clients/new"
          aria-label="New client"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white active:bg-slate-brand sm:hidden"
        >
          <Plus className="size-5" strokeWidth={2.4} />
        </Link>
        <Link href="/admin/clients/new" className="hidden items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white hover:bg-slate-brand sm:inline-flex">
          <Plus className="size-4" /> New client
        </Link>
      </div>
      <div className="mt-5">
        <ClientsTabs active="clients" clients={profiles.length} logins={logins ?? undefined} />
      </div>
      <ClientDirectory clients={list} />
    </main>
  );
}
