import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { CopyLink } from "@/components/admin/CopyLink";
import { RoomStatusBadge } from "@/components/admin/RoomStatusBadge";
import { getTheme } from "@/config/themes";
import { roomAvailability, type RoomSummary } from "@/lib/data";

export function RoomCard({ room }: { room: RoomSummary }) {
  const theme = getTheme(room.theme_preset);
  const availability = roomAvailability(room);
  const total = Math.max(room.fileCount, 1);
  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <li className="overflow-hidden rounded-[26px] bg-white shadow-sm ring-1 ring-slate-200">
      <Link
        href={`/admin/rooms/${room.id}`}
        className="group block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand active:opacity-90"
        aria-label={`Manage room: ${room.title}`}
      >
        <div className="relative aspect-video sm:aspect-[16/10]" style={{ background: theme.background }}>
          {room.coverUrl ? (
            <img src={room.coverUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span
              className="absolute -left-10 top-0 size-40 rounded-full blur-2xl"
              style={{ background: room.accent_color ?? theme.accent, opacity: 0.6 }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-x-4 bottom-4 text-white">
            <p className="font-typewriter text-[11px] opacity-80">Prepared for {room.client_name}</p>
            <h3 className="mt-1 line-clamp-2 font-display text-[1.75rem] uppercase leading-none [overflow-wrap:anywhere]">{room.title}</h3>
          </div>
          <div className="absolute right-3 top-3">
            <RoomStatusBadge status={availability} />
          </div>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-2 px-4 text-sm font-bold text-ink group-hover:bg-slate-50">
          Manage room <ArrowRight aria-hidden className="size-4" />
        </div>
      </Link>
      <div className="border-t border-slate-100 px-4 pb-4 pt-3">
        <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <span className="bg-approve" style={{ width: pct(room.stats.approved) }} />
          <span className="bg-decline" style={{ width: pct(room.stats.changes) }} />
        </div>
        <p className="mt-2 text-xs text-slate-600">
          {room.stats.approved + room.stats.changes} of {room.fileCount} reviewed
        </p>
        <dl className="mt-2 grid grid-cols-4 gap-1 text-center">
          {[
            { label: "Files", value: room.fileCount, tone: "text-ink" },
            { label: "Approved", value: room.stats.approved, tone: "text-approve" },
            { label: "Changes", value: room.stats.changes, tone: "text-decline" },
            { label: room.stats.views === 1 ? "View" : "Views", value: room.stats.views, tone: "text-ink" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col">
              <dt className="order-2 text-xs font-medium text-slate-600">{s.label}</dt>
              <dd className={`order-1 text-lg font-bold tabular-nums ${s.value ? s.tone : "text-slate-600"}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {availability === "live" && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
          <CopyLink path={`/r/${room.slug}`} label="Copy client link" context={room.title} className="min-h-11 justify-center" />
          <a
            href={`/r/${room.slug}`}
            aria-label={`Open client view for ${room.title}`}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-ink hover:bg-slate-50"
          >
            Client view <ArrowUpRight aria-hidden className="size-4 shrink-0" />
          </a>
        </div>
      )}
    </li>
  );
}
