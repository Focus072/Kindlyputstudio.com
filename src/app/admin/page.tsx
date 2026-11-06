import Link from "next/link";
import { Plus } from "lucide-react";
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
      tone: "text-approve",
    },
    { label: "Changes asked", hint: "rooms with notes to fix", value: live.filter((r) => r.stats.changes > 0).length, tone: "text-decline" },
    {
      label: "Waiting on client",
      hint: "files not reviewed",
      value: live.filter((r) => r.stats.pending > 0 && !r.feedback_sent_at).length,
      tone: "text-ink",
    },
    {
      label: "Expiring soon",
      hint: "next 7 days",
      value: live.filter((r) => r.expires_at && new Date(r.expires_at).getTime() - now < 7 * DAY).length,
      tone: "text-amber-600",
    },
    { label: "Access requests", hint: "guest-list rooms", value: accessCount ?? 0, tone: "text-amber-600" },
  ];

  return (
    <main>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-typewriter text-sm text-slate-500">Delivery rooms</p>
          <h1 className="font-display text-5xl uppercase leading-none text-ink">Your rooms</h1>
        </div>
        {/* On phones, New room lives in the bottom tab bar. */}
        <Link
          href="/admin/rooms/new"
          className="hidden items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white sm:inline-flex"
        >
          <Plus className="size-4" /> New room
        </Link>
      </div>

      {rooms.length > 0 && (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-6 lg:grid-cols-5">
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
          <section className="mt-6">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-bold text-ink">Latest activity</h2>
              <Link href="/admin/activity" className="text-sm font-semibold text-brand hover:underline max-sm:-my-2.5 max-sm:py-2.5">
                See all
              </Link>
            </div>
            <ActivityList items={recent} />
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
        <ul className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </ul>
      )}
    </main>
  );
}
