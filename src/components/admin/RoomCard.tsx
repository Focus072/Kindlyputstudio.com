import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CopyLink } from "@/components/admin/CopyLink";
import { getTheme } from "@/config/themes";
import type { RoomSummary } from "@/lib/data";

export function RoomCard({ room }: { room: RoomSummary }) {
  const theme = getTheme(room.theme_preset);
  const total = Math.max(room.fileCount, 1);
  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <li className="overflow-hidden rounded-[26px] bg-white shadow-sm ring-1 ring-slate-200">
      <Link href={`/admin/rooms/${room.id}`} className="block active:opacity-90">
        <div className="relative aspect-[4/3] sm:aspect-[16/10]" style={{ background: theme.background }}>
          {room.coverUrl ? (
            <img src={room.coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span
              className="absolute -left-10 top-0 size-40 rounded-full blur-2xl"
              style={{ background: room.accent_color ?? theme.accent, opacity: 0.6 }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-x-4 bottom-4 text-white">
            <p className="font-typewriter text-[11px] opacity-80">Prepared for {room.client_name}</p>
            <p className="mt-1 line-clamp-2 font-display text-[1.75rem] uppercase leading-[0.95]">{room.title}</p>
          </div>
          {room.status !== "live" && (
            <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase text-slate-700">
              {room.status}
            </span>
          )}
        </div>

        <div className="px-4 pt-4">
          {/* Review progress at a glance */}
          <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <span className="bg-approve" style={{ width: pct(room.stats.approved) }} />
            <span className="bg-decline" style={{ width: pct(room.stats.changes) }} />
          </div>
          <dl className="mt-3 grid grid-cols-4 gap-1 text-center">
            {[
              { label: "Files", value: room.fileCount, tone: "text-ink" },
              { label: "Approved", value: room.stats.approved, tone: "text-approve" },
              { label: "Changes", value: room.stats.changes, tone: "text-decline" },
              { label: "Views", value: room.stats.views, tone: "text-ink" },
            ].map((s) => (
              <div key={s.label}>
                <dd className={`text-lg font-bold tabular-nums ${s.tone}`}>{s.value}</dd>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-2 p-4">
        <CopyLink path={`/r/${room.slug}`} className="justify-center py-2.5" />
        <a
          href={`/r/${room.slug}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-3.5 py-2.5 text-sm font-semibold text-white"
        >
          Open <ArrowUpRight className="size-4" />
        </a>
      </div>
    </li>
  );
}
