import Link from "next/link";
import { CalendarClock, KeyRound, MessageSquareWarning, Plus, Send, Hourglass } from "lucide-react";
import { ActivityList } from "@/components/admin/ActivityList";
import { RoomCard } from "@/components/admin/RoomCard";
import { listActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth";
import { listRoomsWithStats } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DAY = 86_400_000;

export default async function AdminHome() {
  await requireAdmin();
  const [rooms, recent, { count: accessCount }] = await Promise.all([
    listRoomsWithStats(),
    listActivity(6),
    supabaseAdmin().from("access_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const now = new Date().getTime();
  const live = rooms.filter((r) => r.status === "live");
  const overview = [
    {
      label: "Feedback sent",
      hint: "last 14 days",
      value: live.filter((r) => r.feedback_sent_at && now - new Date(r.feedback_sent_at).getTime() < 14 * DAY).length,
      tone: "text-sage",
      icon: Send,
      soft: "bg-sage-soft text-sage",
    },
    {
      label: "Changes asked",
      hint: "rooms with notes to fix",
      value: live.filter((r) => r.stats.changes > 0).length,
      tone: "text-clay",
      icon: MessageSquareWarning,
      soft: "bg-clay-soft text-clay",
    },
    {
      label: "Waiting on client",
      hint: "files not reviewed",
      value: live.filter((r) => r.stats.pending > 0 && !r.feedback_sent_at).length,
      tone: "text-ink",
      icon: Hourglass,
      soft: "bg-steel/45 text-ink",
    },
    {
      label: "Expiring soon",
      hint: "next 7 days",
      value: live.filter((r) => r.expires_at && new Date(r.expires_at).getTime() - now < 7 * DAY).length,
      tone: "text-ochre",
      icon: CalendarClock,
      soft: "bg-ochre-soft text-ochre",
    },
    { label: "Access requests", hint: "guest-list rooms", value: accessCount ?? 0, tone: "text-ochre", icon: KeyRound, soft: "bg-ochre-soft text-ochre" },
  ];

  const needs = overview.filter((o) => o.value > 0);

  return (
    <main>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-typewriter text-sm text-slate-500 max-sm:hidden">Delivery rooms</p>
          <h1 className="font-display text-[2.375rem] uppercase leading-none text-ink sm:text-5xl">Your rooms</h1>
        </div>
        {/* On phones, New room is a round + beside the large title, like iOS. */}
        <Link
          href="/admin/rooms/new"
          aria-label="New room"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white active:bg-slate-brand sm:hidden"
        >
          <Plus className="size-5" strokeWidth={2.4} />
        </Link>
        <Link
          href="/admin/rooms/new"
          className="hidden items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white sm:inline-flex"
        >
          <Plus className="size-4" /> New room
        </Link>
      </div>

      {rooms.length > 0 && (
        <>
          {/* Phones: only what needs you, as compact tiles (zeros stay out of the way). */}
          {needs.length > 0 ? (
            <dl className="mt-5 grid grid-cols-2 gap-2.5 sm:hidden">
              {needs.map((o) => (
                <div key={o.label} className="flex min-w-0 flex-col gap-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 last:odd:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className={`flex size-8 items-center justify-center rounded-full ${o.soft}`}>
                      <o.icon className="size-4" strokeWidth={2} />
                    </span>
                    <dd className={`text-[1.625rem] font-bold leading-none tabular-nums ${o.tone}`}>{o.value}</dd>
                  </div>
                  <dt className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold leading-tight text-ink">{o.label}</span>
                    <span className="block truncate text-xs text-slate-500">{o.hint}</span>
                  </dt>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-5 rounded-2xl bg-white px-4 py-3 text-[15px] text-slate-500 ring-1 ring-slate-200/80 sm:hidden">
              <span className="font-semibold text-ink">All caught up.</span> Nothing is waiting on you.
            </p>
          )}
          <dl className="mt-6 grid grid-cols-2 gap-3 max-sm:hidden sm:grid-cols-6 lg:grid-cols-5">
            {overview.map((o) => (
              <div
                key={o.label}
                className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 max-sm:last:odd:col-span-2 sm:col-span-2 sm:nth-[n+4]:col-span-3 lg:col-span-1 lg:nth-[n+4]:col-span-1"
              >
                <dd className={`text-3xl font-bold tabular-nums ${o.value ? o.tone : "text-ink/25"}`}>{o.value}</dd>
                <dt className="mt-1 text-sm font-semibold text-ink">{o.label}</dt>
                <p className="text-xs text-slate-400">{o.hint}</p>
              </div>
            ))}
          </dl>
          <section className="mt-7 sm:mt-6">
            <div className="mb-2 flex items-baseline justify-between px-1 sm:mb-3 sm:px-0">
              <h2 className="text-xl font-bold tracking-tight text-ink sm:text-lg">Latest activity</h2>
              <Link href="/admin/activity" className="text-sm font-semibold text-brand hover:underline max-sm:-my-2.5 max-sm:py-2.5">
                See all
              </Link>
            </div>
            <ActivityList items={recent} phoneLimit={3} />
          </section>
        </>
      )}

      {rooms.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-bold text-ink">No rooms yet</p>
          <p className="mt-1 text-sm text-slate-500">Create your first room, upload the shoot, and send the link.</p>
          <Link
            href="/admin/rooms/new"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white"
          >
            <Plus className="size-4" /> New room
          </Link>
        </div>
      ) : (
        <>
        <h2 className="mb-2 mt-7 px-1 text-xl font-bold tracking-tight text-ink sm:hidden">Rooms</h2>
        <ul className="grid gap-3 sm:mt-8 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </ul>
        </>
      )}
    </main>
  );
}
