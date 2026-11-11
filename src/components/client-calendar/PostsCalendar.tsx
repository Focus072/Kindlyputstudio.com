"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, MessageCircle, Play } from "lucide-react";
import type { Ctx } from "@/app/cal/actions";
import { ChannelAvatar, PlatformIcon } from "@/components/admin/calendar/PlatformIcon";
import { TYPE_LABEL, platformInfo } from "@/lib/calendar";
import { STUDIO_TZ_LABEL, dayKey, dayLabel, monthGrid, monthLabel, relativeLabel, timeLabel } from "@/lib/calendar-time";
import type { ClientPost } from "@/lib/client-calendar";
import type { CalComment, Role } from "@/lib/ideas";
import { Comments } from "./Comments";
import { Sheet } from "./Sheet";

const STATUS_STYLE: Record<ClientPost["status"], { label: string; cls: string }> = {
  scheduled: { label: "Scheduled", cls: "bg-[#e3e8ea] text-slate-brand" },
  posted: { label: "Posted", cls: "bg-[#e6ece4] text-[#4d6b51]" },
};

function typeLabel(p: ClientPost) {
  const t = p.type && p.type !== "post" ? TYPE_LABEL[p.type] : null;
  return `${platformInfo(p.platform).label}${t ? ` ${t}` : ""}`;
}

function Thumb({ post, className }: { post: ClientPost; className: string }) {
  const m = post.media[0];
  const src = post.thumb ?? (m && !m.isVideo ? m.url : null);
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-xl bg-slate-100 ${className}`}>
      {src ? (
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : m?.isVideo ? (
        <video src={m.url} muted playsInline preload="metadata" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-slate-400">
          <PlatformIcon service={post.platform} className="size-5" />
        </span>
      )}
      {post.isVideo && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/15">
          <Play className="size-4 fill-white text-white" />
        </span>
      )}
    </span>
  );
}

export function PostsCalendar({
  ctx,
  role,
  posts,
  month,
  today,
  color,
  comments,
  studioName,
  basePath,
  ok,
}: {
  ctx: Ctx;
  role: Role;
  posts: ClientPost[];
  month: string;
  today: string;
  color: string;
  comments: CalComment[];
  studioName: string;
  /** Page link without the month, e.g. "/cal/abc" or "/admin/calendar/ideas?c=id". */
  basePath: string;
  ok: boolean;
}) {
  const hrefFor = (m: string) => `${basePath}${basePath.includes("?") ? "&" : "?"}m=${m}`;
  const [open, setOpen] = useState<ClientPost | null>(null);
  const [now] = useState(() => Date.now());
  const weeks = useMemo(() => monthGrid(month), [month]);
  const byDay = useMemo(() => {
    const m = new Map<string, ClientPost[]>();
    for (const p of posts) {
      const k = dayKey(p.at);
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  }, [posts]);
  const commentCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of comments) if (c.postKey) m.set(c.postKey, (m.get(c.postKey) ?? 0) + 1);
    return m;
  }, [comments]);

  const inMonth = posts.filter((p) => dayKey(p.at).startsWith(month));
  const days = [...new Set(inMonth.map((p) => dayKey(p.at)))].sort();
  const next = posts.filter((p) => p.status === "scheduled" && Date.parse(p.at) > now).sort((a, b) => a.at.localeCompare(b.at))[0];
  const [y, m] = month.split("-").map(Number);
  const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  const nextMonth = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
  const scheduled = inMonth.filter((p) => p.status === "scheduled").length;
  const posted = inMonth.filter((p) => p.status === "posted").length;

  function jump(day: string) {
    document.getElementById(`day-${day}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      {/* Month switcher */}
      <div className="flex items-center gap-1 rounded-full bg-white p-1.5 shadow-sm ring-1 ring-slate-200 sm:rounded-3xl sm:p-2">
        <Link href={hrefFor(prev)} scroll={false} aria-label="Previous month" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100">
          <ChevronLeft className="size-5" />
        </Link>
        <p className="min-w-0 flex-1 truncate px-1 text-center font-display text-2xl uppercase leading-none text-ink sm:text-left sm:text-3xl">{monthLabel(month)}</p>
        {!today.startsWith(month) && (
          <Link href={hrefFor(today.slice(0, 7))} scroll={false} className="inline-flex h-9 shrink-0 items-center rounded-full border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:border-ink hover:text-ink">
            Today
          </Link>
        )}
        <Link href={hrefFor(nextMonth)} scroll={false} aria-label="Next month" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100">
          <ChevronRight className="size-5" />
        </Link>
      </div>

      {/* Phone: one summary card and a swipeable strip of days */}
      <div className="mt-3 sm:hidden">
        <div className="grid grid-cols-[1fr_1fr_1.6fr] divide-x divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="px-3 py-2.5">
            <span className="font-display text-[28px] leading-none text-ink">{scheduled}</span>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Scheduled</span>
          </div>
          <div className="px-3 py-2.5">
            <span className="font-display text-[28px] leading-none text-ink">{posted}</span>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Posted</span>
          </div>
          <button onClick={() => next && setOpen(next)} disabled={!next} className="flex min-w-0 items-center gap-2 px-3 py-2.5 text-left">
            {next && <Thumb post={next} className="size-9 rounded-lg" />}
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Next up</span>
              <span className="block truncate text-sm font-bold text-ink">{next ? relativeLabel(next.at, now) : "Nothing yet"}</span>
            </span>
          </button>
        </div>
        <DayStrip month={month} today={today} byDay={byDay} onPick={jump} />
      </div>

      <div className="mt-3 hidden grid-cols-3 gap-3 sm:grid">
        <Stat label="Scheduled" value={scheduled} />
        <Stat label="Posted" value={posted} />
        {next ? (
          <button onClick={() => setOpen(next)} className="flex min-w-0 items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 hover:ring-slate-brand">
            <Thumb post={next} className="size-11" />
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Clock className="size-3.5" /> Next up
              </span>
              <span className="block truncate text-sm font-bold text-ink">{relativeLabel(next.at, now)}</span>
              <span className="block truncate text-xs text-slate-500">{typeLabel(next)}</span>
            </span>
          </button>
        ) : (
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <Clock className="size-3.5" /> Next up
            </span>
            <span className="block text-sm font-bold text-ink">Nothing scheduled yet</span>
          </div>
        )}
      </div>

      {!ok && <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">Some posts couldn&rsquo;t load just now. Refresh in a minute to see everything.</p>}

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
        {/* Month grid (tablet and up) */}
        <section aria-label="Month" className="hidden overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 md:block lg:sticky lg:top-4">
          <div className="grid grid-cols-7 border-b border-slate-100 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <span key={d} className="py-2">
                {d}
              </span>
            ))}
          </div>
          {weeks.map((w) => (
            <div key={w[0]} className="grid grid-cols-7 border-b border-slate-100 last:border-0">
              {w.map((d) => {
                const list = byDay.get(d) ?? [];
                const out = !d.startsWith(month);
                return (
                  <button
                    key={d}
                    onClick={() => (list.length === 1 ? setOpen(list[0]) : list.length ? jump(d) : undefined)}
                    disabled={!list.length}
                    className={`flex min-h-24 flex-col items-stretch gap-1 border-r border-slate-100 p-1.5 text-left last:border-0 ${out ? "bg-slate-50/70" : ""} ${list.length ? "hover:bg-slate-50" : "cursor-default"}`}
                  >
                    <span
                      className={`inline-flex size-6 items-center justify-center self-start rounded-full text-xs font-semibold ${d === today ? "bg-ink text-white" : out ? "text-slate-300" : "text-slate-600"}`}
                    >
                      {Number(d.slice(8))}
                    </span>
                    {list.slice(0, 2).map((p) => (
                      <span key={p.id} className={`flex items-center gap-1 rounded-lg px-1 py-0.5 text-[11px] font-semibold ${out ? "opacity-50" : ""}`} style={{ background: `${color}1f`, color: "#1d2b32" }}>
                        <PlatformIcon service={p.platform} className="size-3 shrink-0" />
                        <span className="truncate">{timeLabel(p.at).replace(":00", "")}</span>
                        {p.status === "posted" && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-[#6e8f72]" />}
                      </span>
                    ))}
                    {list.length > 2 && <span className="px-1 text-[11px] font-semibold text-slate-400">+{list.length - 2} more</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </section>

        {/* Day by day */}
        <section aria-label="Posts this month" className="mt-4 space-y-5 md:mt-5 lg:mt-0">
          {days.length === 0 && (
            <div className="rounded-3xl bg-white px-5 py-10 text-center shadow-sm ring-1 ring-slate-200">
              <CalendarDays className="mx-auto size-7 text-slate-300" />
              <p className="mt-2 font-semibold text-ink">Nothing on the calendar for {monthLabel(month).split(" ")[0]} yet</p>
              <p className="mt-1 text-sm text-slate-500">Posts show up here as soon as they&rsquo;re scheduled.</p>
            </div>
          )}
          {days.map((d) => (
            <div key={d} id={`day-${d}`} className="scroll-mt-20 sm:scroll-mt-4">
              <h3 className={`mb-2 flex items-center gap-2 text-sm font-bold ${d === today ? "text-ink" : "text-slate-500"}`}>
                {dayLabel(d)}
                {d === today && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] uppercase text-white">Today</span>}
              </h3>
              <div className="space-y-2">
                {(byDay.get(d) ?? []).map((p) => (
                  <button key={p.id} onClick={() => setOpen(p)} className="flex w-full gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-brand" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
                    <Thumb post={p} className="size-[72px] sm:size-16" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-500">
                          <PlatformIcon service={p.platform} className="size-3.5 shrink-0" />
                          <span className="truncate">
                            <span className="font-bold text-ink sm:font-semibold sm:text-slate-500">{timeLabel(p.at)}</span>
                            <span className="hidden min-[400px]:inline"> · {typeLabel(p)}</span>
                          </span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[p.status].cls}`}>{STATUS_STYLE[p.status].label}</span>
                      </span>
                      <span className="mt-1 line-clamp-2 break-words text-sm text-slate-700">{p.caption || <em className="text-slate-400">No caption</em>}</span>
                      {(commentCount.get(p.id) ?? 0) > 0 && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                          <MessageCircle className="size-3" /> {commentCount.get(p.id)}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-400">Times are {STUDIO_TZ_LABEL}.</p>
        </section>
      </div>

      {open && (
        <Sheet title={typeLabel(open)} onClose={() => setOpen(null)}>
          <div className="flex items-center gap-2.5">
            <ChannelAvatar avatar={open.channelAvatar} service={open.platform} name={open.channelName} size="size-10" badge="size-4" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-ink">{open.channelName ?? platformInfo(open.platform).label}</span>
              <span className="block text-xs text-slate-500">
                {dayLabel(dayKey(open.at), { weekday: "short", month: "short", day: "numeric" })} · {timeLabel(open.at)}
              </span>
            </span>
            <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[open.status].cls}`}>{STATUS_STYLE[open.status].label}</span>
          </div>
          {open.media.length > 0 && <MediaCarousel media={open.media} />}
          {open.caption && <p className="mt-4 whitespace-pre-wrap break-words text-sm text-slate-700">{open.caption}</p>}
          {open.link && (
            <a href={open.link} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-ink hover:text-ink">
              <ExternalLink className="size-3.5" /> View on {platformInfo(open.platform).label}
            </a>
          )}
          <Comments ctx={ctx} role={role} target={{ postKey: open.id }} comments={comments.filter((c) => c.postKey === open.id)} studioName={studioName} />
        </Sheet>
      )}
    </div>
  );
}

/** A swipeable row of the month's days with a dot per post (phones). */
function DayStrip({ month, today, byDay, onPick }: { month: string; today: string; byDay: Map<string, ClientPost[]>; onPick: (d: string) => void }) {
  const days = monthGrid(month).flat().filter((d) => d.startsWith(month));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-today="1"]') ?? ref.current?.querySelector<HTMLElement>('[data-has="1"]');
    const box = ref.current;
    if (el && box) box.scrollLeft += el.getBoundingClientRect().left - box.getBoundingClientRect().left - 16 - 2 * 52;
  }, [month]);
  return (
    <div ref={ref} className="-mx-4 mt-3 flex snap-x gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" aria-label="Days">
      {days.map((d) => {
        const list = byDay.get(d) ?? [];
        const isToday = d === today;
        return (
          <button
            key={d}
            data-today={isToday ? "1" : undefined}
            data-has={list.length ? "1" : undefined}
            onClick={() => list.length && onPick(d)}
            aria-label={`${dayLabel(d)}${list.length ? `, ${list.length} post${list.length === 1 ? "" : "s"}` : ""}`}
            className={`flex h-[64px] w-[46px] shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-2xl ${
              isToday ? "bg-ink text-white" : list.length ? "bg-white text-ink shadow-sm ring-1 ring-slate-200" : "text-slate-400"
            }`}
          >
            <span className={`text-[10px] font-semibold uppercase ${isToday ? "text-mist" : ""}`}>{dayLabel(d, { weekday: "narrow" })}</span>
            <span className="text-base font-bold leading-none">{Number(d.slice(8))}</span>
            <span className="flex h-1.5 gap-0.5">
              {list.slice(0, 3).map((p) => (
                <span key={p.id} className={`size-1.5 rounded-full ${p.status === "posted" ? "bg-[#6e8f72]" : isToday ? "bg-steel" : "bg-slate-brand"}`} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Swipeable photos with dots, like the post will look. */
function MediaCarousel({ media }: { media: ClientPost["media"] }) {
  const [i, setI] = useState(0);
  return (
    <div className="-mx-5 mt-4 sm:mx-0">
      <div
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] sm:rounded-2xl"
        onScroll={(e) => {
          const el = e.currentTarget;
          setI(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {media.map((m, k) => (
          <div key={k} className="w-full shrink-0 snap-center bg-slate-100">
            {m.isVideo ? (
              <video src={m.url} poster={m.thumb ?? undefined} controls playsInline preload="metadata" className="aspect-[4/5] max-h-[62dvh] w-full bg-black object-contain" />
            ) : (
              <img src={m.url} alt={m.alt ?? ""} className="aspect-[4/5] max-h-[62dvh] w-full object-cover" />
            )}
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {media.map((_, k) => (
            <span key={k} className={`size-1.5 rounded-full transition ${k === i ? "bg-ink" : "bg-slate-300"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="font-display text-3xl leading-none text-ink">{value}</span>
      <span className="ml-1 text-xs text-slate-500">this month</span>
    </div>
  );
}
