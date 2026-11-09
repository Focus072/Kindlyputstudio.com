import Link from "next/link";
import { Plus } from "lucide-react";
import { ActivityList } from "@/components/admin/ActivityList";
import { RoomCard } from "@/components/admin/RoomCard";
import { listActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth";
import { listRoomsWithStats, roomAvailability } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DAY = 86_400_000;

export const metadata = { title: "Rooms" };

const roomStates = [
  { value: "live", label: "Live" },
  { value: "draft", label: "Draft" },
  { value: "expired", label: "Expired" },
  { value: "archived", label: "Archived" },
];

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const { q, status } = await searchParams;
  const search = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const searchTerm = search.toLowerCase();
  const statusFilter = roomStates.find((state) => state.value === status)?.value ?? "";
  const [rooms, recent, { count: accessCount }] = await Promise.all([
    listRoomsWithStats(),
    listActivity(6),
    supabaseAdmin().from("access_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const now = new Date().getTime();
  const live = rooms.filter((r) => roomAvailability(r) === "live");
  const matchingRooms = rooms.filter((room) => {
    const matchesSearch = !searchTerm || [room.title, room.client_name].some((value) => value.toLowerCase().includes(searchTerm));
    return matchesSearch && (!statusFilter || roomAvailability(room) === statusFilter);
  });
  const overview = [
    {
      label: "Feedback sent",
      hint: "live rooms, last 14 days",
      value: live.filter((r) => r.feedback_sent_at && now - new Date(r.feedback_sent_at).getTime() < 14 * DAY).length,
      tone: "text-approve",
    },
    { label: "Changes requested", hint: "live rooms with open requests", value: live.filter((r) => r.stats.changes > 0).length, tone: "text-decline" },
    {
      label: "Waiting on client",
      hint: "live rooms with pending files and no feedback sent",
      value: live.filter((r) => r.stats.pending > 0 && !r.feedback_sent_at).length,
      tone: "text-ink",
    },
    {
      label: "Expiring soon",
      hint: "live rooms, next 7 days",
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
          <h1 className="font-display text-4xl uppercase leading-none text-ink sm:text-5xl">Your rooms</h1>
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
        <details className="mt-4 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <summary className="cursor-pointer rounded-2xl px-4 py-3 text-sm font-bold text-ink">
            Room overview <span className="ml-2 font-medium text-slate-600">{live.length} live</span>
          </summary>
          <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 p-3 sm:grid-cols-3 lg:grid-cols-5">
            {overview.map((o) => (
              <div
                key={o.label}
                className="flex flex-col rounded-xl bg-slate-50 p-3 max-sm:last:odd:col-span-2"
              >
                <dt className="order-2 mt-1 text-sm font-semibold text-ink">{o.label}</dt>
                <dd className={`order-1 text-2xl font-bold tabular-nums ${o.value ? o.tone : "text-slate-600"}`}>{o.value}</dd>
                <dd className="order-3 text-xs text-slate-600">{o.hint}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      {rooms.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-bold text-ink">No rooms yet</p>
          <p className="mt-1 text-sm text-slate-600">Create a draft, upload the shoot, then publish and share the room.</p>
          <Link
            href="/admin/rooms/new"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white"
          >
            <Plus className="size-4" /> New room
          </Link>
        </div>
      ) : (
        <section aria-labelledby="rooms-heading" className="mt-4">
          <form action="/admin" method="get" role="search" aria-label="Find rooms" className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)_auto]">
            <label className="col-span-2 block min-w-0 sm:col-span-1">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Search rooms</span>
              <input
                type="search"
                name="q"
                maxLength={100}
                defaultValue={search}
                placeholder="Project or client"
                className="min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-base sm:text-sm"
              />
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Status</span>
              <select name="status" defaultValue={statusFilter} className="min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-base sm:text-sm">
                <option value="">All statuses</option>
                {roomStates.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <button type="submit" className="min-h-11 rounded-xl bg-ink px-4 text-sm font-bold text-white">Apply filters</button>
          </form>
          <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="rooms-heading" className="text-base font-bold text-ink">
              {matchingRooms.length} {matchingRooms.length === 1 ? "room" : "rooms"}
            </h2>
            {(search || statusFilter) && (
              <Link href="/admin" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-brand hover:bg-white">
                Clear filters
              </Link>
            )}
          </div>
          {matchingRooms.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {matchingRooms.map((room) => <RoomCard key={room.id} room={room} />)}
            </ul>
          ) : (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-600 ring-1 ring-slate-200">
              No rooms match these filters. Try a different search or clear the filters.
            </p>
          )}
        </section>
      )}

      {rooms.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-ink">Latest activity</h2>
            <Link href="/admin/activity" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline">
              See all activity
            </Link>
          </div>
          <ActivityList items={recent} />
        </section>
      )}
    </main>
  );
}
