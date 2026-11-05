import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BufferConnect, ChannelList } from "@/components/admin/calendar/BufferSettings";
import { ClientColors } from "@/components/admin/calendar/ClientColors";
import { requireAdmin } from "@/lib/auth";
import { getBufferKey } from "@/lib/buffer";
import { loadChannels, loadClients } from "@/lib/calendar-data";
import { STUDIO_TZ_LABEL } from "@/lib/calendar-time";

export const metadata: Metadata = { title: "Calendar settings" };

export default async function CalendarSettingsPage() {
  await requireAdmin();
  const [{ clients, ready }, channels, key] = await Promise.all([loadClients(), loadChannels(), getBufferKey()]);

  return (
    <main className="max-w-3xl">
      <Link href="/admin/calendar" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink">
        <ChevronLeft className="size-4" /> Calendar
      </Link>
      <h1 className="mt-1 font-display text-5xl uppercase leading-none text-ink">Calendar settings</h1>

      {!ready && (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          The calendar&rsquo;s database tables aren&rsquo;t set up yet, so nothing here can save until that update runs.
        </p>
      )}

      <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-display text-3xl uppercase leading-none text-ink">Clients &amp; colors</h2>
        <p className="mt-1 text-sm text-slate-500">Each client gets one color, used for every post of theirs on the calendar.</p>
        <ClientColors clients={clients} />
      </section>

      <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-display text-3xl uppercase leading-none text-ink">Buffer</h2>
        <p className="mt-1 text-sm text-slate-500">
          Buffer does the publishing. You write, schedule, edit and delete posts from this calendar. Open Buffer only to connect a new account, then press Refresh channels here.
        </p>
        <BufferConnect connected={key ? key.source : null} />
        {key && <ChannelList channels={channels} clients={clients} />}
        <p className="mt-4 text-xs text-slate-400">Times on the calendar are {STUDIO_TZ_LABEL}.</p>
      </section>
    </main>
  );
}
