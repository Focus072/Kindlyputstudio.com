import Link from "next/link";
import { Plus } from "lucide-react";
import { RoomCard } from "@/components/admin/RoomCard";
import { requireAdmin } from "@/lib/auth";
import { listRoomsWithStats } from "@/lib/data";

export default async function AdminHome() {
  await requireAdmin();
  const rooms = await listRoomsWithStats();

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
