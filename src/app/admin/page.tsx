import Link from "next/link";
import { Plus } from "lucide-react";
import { CopyLink } from "@/components/admin/CopyLink";
import { getTheme } from "@/config/themes";
import { requireAdmin } from "@/lib/auth";
import { listRoomsWithStats } from "@/lib/data";

export default async function AdminHome() {
  await requireAdmin();
  const rooms = await listRoomsWithStats();

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-typewriter text-sm text-slate-500">Delivery rooms</p>
          <h1 className="font-display text-4xl uppercase tracking-wide text-slate-900 sm:text-5xl">Your rooms</h1>
        </div>
        <Link
          href="/admin/rooms/new"
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white"
        >
          <Plus className="size-4" /> New room
        </Link>
      </div>

      {rooms.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-bold text-slate-900">No rooms yet</p>
          <p className="mt-1 text-sm text-slate-500">Create your first room, upload the shoot, and send the link.</p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const theme = getTheme(room.theme_preset);
            return (
              <li key={room.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                <Link href={`/admin/rooms/${room.id}`} className="block">
                  <div className="relative aspect-[16/9]" style={{ background: theme.background }}>
                    {room.coverUrl ? (
                      <img src={room.coverUrl} alt="" className="absolute inset-0 size-full object-cover opacity-90" />
                    ) : (
                      <span
                        className="absolute -left-10 top-0 size-40 rounded-full blur-2xl"
                        style={{ background: room.accent_color ?? theme.accent, opacity: 0.6 }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <p className="font-typewriter text-[11px] opacity-80">Prepared for {room.client_name}</p>
                      <p className="truncate font-display text-2xl uppercase">{room.title}</p>
                    </div>
                    {room.status !== "live" && (
                      <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase text-slate-700">
                        {room.status}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pt-3 text-xs text-slate-500">
                    <span>{room.fileCount} files</span>
                    <span>{room.stats.views} views</span>
                    <span className="text-approve">{room.stats.approved} approved</span>
                    <span className="text-decline">{room.stats.changes} changes</span>
                    <span>{room.stats.pending} pending</span>
                  </div>
                </Link>
                <div className="flex items-center gap-2 p-4 pt-3">
                  <CopyLink path={`/r/${room.slug}`} />
                  <a
                    href={`/r/${room.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
                  >
                    Open
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
