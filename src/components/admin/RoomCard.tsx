import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CopyLink } from "@/components/admin/CopyLink";
import { getTheme } from "@/config/themes";
import type { RoomSummary } from "@/lib/data";
import { formatReviewBy, studioToday } from "@/lib/review-date";

/** "Nov 14" chip while files still wait on the client and the room has a review-by date. */
function dueChip(day: string | null | undefined, pending: number) {
  const label = pending > 0 ? formatReviewBy(day, { month: "short", day: "numeric" }) : null;
  return label ? { label, late: day! < studioToday() } : null;
}

export function RoomCard({ room }: { room: RoomSummary }) {
  const theme = getTheme(room.theme_preset);
  const total = Math.max(room.fileCount, 1);
  const pct = (n: number) => `${(n / total) * 100}%`;
  const due = dueChip(room.review_by, room.stats.pending);

  return (
    <li className="overflow-hidden rounded-[26px] bg-white shadow-sm ring-1 ring-slate-200">
      <Link href={`/admin/rooms/${room.id}`} className="block active:opacity-90">
        <div className="relative aspect-[16/10]" style={{ background: theme.background }}>
          {room.coverUrl ? (
            <img src={room.coverUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span
              className="absolute -left-10 top-0 size-40 rounded-full blur-2xl"
              style={{ background: room.accent_color ?? theme.accent, opacity: 0.6 }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-x-4 bottom-3.5 text-white sm:bottom-4">
            <p className="font-typewriter text-[11px] opacity-80">Prepared for {room.client_name}</p>
            <p className="mt-1 line-clamp-2 font-display text-[1.625rem] uppercase leading-[0.95] sm:text-[1.75rem]">{room.title}</p>
          </div>
          {due && (
            <span
              className={`absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold ${due.late ? "text-decline" : "text-slate-700"}`}
            >
              {due.late ? "Overdue · " : "Due "}
              {due.label}
            </span>
          )}
          {room.status !== "live" && (
            <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase text-slate-700">
              {room.status}
            </span>
          )}
        </div>

        <div className="px-4 pt-3.5 sm:pt-4">
          {/* Review progress at a glance */}
          <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <span className="bg-[#7fa38a]" style={{ width: pct(room.stats.approved) }} />
            <span className="bg-[#c48b78]" style={{ width: pct(room.stats.changes) }} />
          </div>
          <dl className="mt-3 grid grid-cols-4 gap-1 text-center">
            {[
              { label: "Files", value: room.fileCount, tone: "text-ink" },
              { label: "Approved", value: room.stats.approved, tone: "text-sage" },
              { label: "Changes", value: room.stats.changes, tone: "text-clay" },
              { label: "Views", value: room.stats.views, tone: "text-ink" },
            ].map((s) => (
              <div key={s.label}>
                <dd className={`text-[17px] font-bold sm:text-lg tabular-nums ${s.value ? s.tone : "text-ink/30"}`}>{s.value}</dd>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-2 p-3 sm:p-4">
        <CopyLink path={`/r/${room.slug}`} className="h-11 justify-center sm:h-auto sm:py-2.5" />
        <a
          href={`/r/${room.slug}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-3.5 text-sm font-semibold text-white max-sm:h-11 sm:py-2.5"
        >
          Open <ArrowUpRight className="size-4" />
        </a>
      </div>
    </li>
  );
}
