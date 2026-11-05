"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Plus, RefreshCw, Settings } from "lucide-react";
import type { BufferState } from "@/lib/calendar-data";
import { type CalClient, type CalPost, UNASSIGNED_COLOR, platformInfo } from "@/lib/calendar";
import { addMonths, dayKey, dayLabel, monthGrid, monthLabel, timeLabel } from "@/lib/calendar-time";
import { PostCard } from "./PostCard";
import { PostEditor } from "./PostEditor";

type Props = {
  month: string;
  today: string;
  clients: CalClient[];
  posts: CalPost[];
  buffer: BufferState;
  dbReady: boolean;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const UNASSIGNED = "__none";

export function ContentCalendar(props: Props) {
  // Remount per month so the selected day resets cleanly.
  return <Calendar key={props.month} {...props} />;
}

function Calendar({ month, today, clients, posts, buffer, dbReady }: Props) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState(today.startsWith(month) ? today : `${month}-01`);
  const [editing, setEditing] = useState<CalPost | "new" | null>(null);

  const colorOf = useMemo(() => {
    const m = new Map(clients.map((c) => [c.id, c.color]));
    return (id: string | null) => (id && m.get(id)) || UNASSIGNED_COLOR;
  }, [clients]);
  const nameOf = useMemo(() => {
    const m = new Map(clients.map((c) => [c.id, c.name]));
    return (id: string | null) => (id && m.get(id)) || "Unassigned";
  }, [clients]);

  const visible = posts.filter((p) => !hidden.has(p.clientId && clients.some((c) => c.id === p.clientId) ? p.clientId : UNASSIGNED));
  const byDay = useMemo(() => {
    const m = new Map<string, CalPost[]>();
    for (const p of visible) {
      const k = dayKey(p.at);
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  }, [visible]);

  const inMonth = visible.filter((p) => dayKey(p.at).startsWith(month));
  const hasUnassigned = posts.some((p) => !p.clientId || !clients.some((c) => c.id === p.clientId));
  const weeks = monthGrid(month);
  const dayPosts = byDay.get(selected) ?? [];

  function toggle(id: string) {
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const chips = [...clients.map((c) => ({ id: c.id, name: c.name, color: c.color })), ...(hasUnassigned ? [{ id: UNASSIGNED, name: "Unassigned", color: UNASSIGNED_COLOR }] : [])];

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-typewriter text-sm text-slate-500">What&rsquo;s going out</p>
          <h1 className="font-display text-5xl uppercase leading-none text-ink">Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/calendar/settings"
            aria-label="Calendar settings"
            className="inline-flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-ink hover:text-ink"
          >
            <Settings className="size-5" />
          </Link>
          <button
            onClick={() => setEditing("new")}
            disabled={!dbReady}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-brand disabled:opacity-40"
          >
            <Plus className="size-4" strokeWidth={2.5} /> Add post
          </button>
        </div>
      </div>

      {!dbReady && (
        <Notice tone="warn">
          The calendar&rsquo;s database tables aren&rsquo;t set up yet. Once the update runs, clients, colors and posts will save here.
        </Notice>
      )}
      {buffer.state === "off" && dbReady && (
        <Notice>
          Buffer isn&rsquo;t connected yet, so only posts you add here show up.{" "}
          <Link href="/admin/calendar/settings" className="font-semibold text-ink underline underline-offset-2">
            Connect Buffer
          </Link>
        </Notice>
      )}
      {buffer.state === "error" && (
        <Notice tone="warn">
          {buffer.message}{" "}
          <Link href="/admin/calendar/settings" className="font-semibold text-ink underline underline-offset-2">
            Settings
          </Link>
        </Notice>
      )}

      {/* Month switcher */}
      <div className="mt-5 flex items-center justify-between gap-2 rounded-3xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
        <Link href={`/admin/calendar?m=${addMonths(month, -1)}`} aria-label="Previous month" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-slate-100">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="flex min-w-0 flex-col items-center">
          <p className="font-display text-2xl uppercase leading-none text-ink sm:text-3xl">{monthLabel(month)}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {inMonth.length} post{inMonth.length === 1 ? "" : "s"}
            {buffer.state === "ok" ? " · synced with Buffer" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {!today.startsWith(month) && (
            <Link href="/admin/calendar" className="hidden rounded-full px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:inline-flex">
              Today
            </Link>
          )}
          {buffer.state !== "off" && (
            <button
              onClick={() => startRefresh(() => router.refresh())}
              aria-label="Refresh from Buffer"
              className="hidden size-10 items-center justify-center rounded-full hover:bg-slate-100 sm:inline-flex"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          )}
          <Link href={`/admin/calendar?m=${addMonths(month, 1)}`} aria-label="Next month" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-slate-100">
            <ChevronRight className="size-5" />
          </Link>
        </div>
      </div>

      {/* Client colors, tap to show or hide */}
      {chips.length > 0 ? (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {chips.map((c) => {
            const off = hidden.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                aria-pressed={!off}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  off ? "border-slate-200 bg-transparent text-slate-400" : "border-transparent bg-white text-ink shadow-sm ring-1 ring-slate-200"
                }`}
              >
                <span className="size-3 rounded-full" style={{ background: off ? "transparent" : c.color, boxShadow: `inset 0 0 0 2px ${c.color}` }} />
                {c.name}
              </button>
            );
          })}
        </div>
      ) : (
        dbReady && (
          <p className="mt-3 text-sm text-slate-500">
            <Link href="/admin/calendar/settings" className="font-semibold text-ink underline underline-offset-2">
              Add your clients
            </Link>{" "}
            and give each one a color.
          </p>
        )
      )}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* Month grid */}
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {weeks.flat().map((k, i) => {
              const items = byDay.get(k) ?? [];
              const outside = !k.startsWith(month);
              const isToday = k === today;
              const isSel = k === selected;
              return (
                <button
                  key={k}
                  onClick={() => setSelected(k)}
                  aria-label={`${dayLabel(k)}, ${items.length} post${items.length === 1 ? "" : "s"}`}
                  aria-pressed={isSel}
                  className={`relative flex min-h-16 flex-col items-stretch gap-1 border-slate-100 p-1 text-left transition-colors sm:min-h-28 sm:p-1.5 ${
                    i % 7 ? "border-l" : ""
                  } ${i >= 7 ? "border-t" : ""} ${outside ? "bg-slate-50/70" : "bg-white"} ${isSel ? "z-[1] ring-2 ring-inset ring-ink" : "hover:bg-slate-50"}`}
                >
                  <span
                    className={`flex size-6 items-center justify-center self-center rounded-full text-xs font-bold sm:self-start ${
                      isToday ? "bg-ink text-white" : outside ? "text-slate-300" : "text-slate-600"
                    }`}
                  >
                    {Number(k.slice(8))}
                  </span>

                  {/* Phones: colored dots */}
                  {items.length > 0 && (
                    <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                      {items.slice(0, 4).map((p) => (
                        <span key={p.id} className="size-1.5 rounded-full" style={{ background: colorOf(p.clientId), opacity: outside ? 0.5 : 1 }} />
                      ))}
                      {items.length > 4 && <span className="text-[9px] font-bold leading-none text-slate-400">+</span>}
                    </span>
                  )}

                  {/* Tablet and up: labeled chips */}
                  <span className={`hidden flex-col gap-1 sm:flex ${outside ? "opacity-50" : ""}`}>
                    {items.slice(0, 3).map((p) => (
                      <span
                        key={p.id}
                        className={`flex min-w-0 items-center gap-1 rounded-md border-l-[3px] px-1.5 py-0.5 text-[11px] leading-tight text-ink ${p.status === "idea" || p.status === "draft" ? "border-dashed" : ""}`}
                        style={{ borderLeftColor: colorOf(p.clientId), background: `${colorOf(p.clientId)}1f` }}
                        title={`${nameOf(p.clientId)} · ${platformInfo(p.platform).label} · ${timeLabel(p.at)}`}
                      >
                        {p.status === "error" && <CircleAlert className="size-3 shrink-0 text-decline" />}
                        <span className="shrink-0 font-bold">{platformInfo(p.platform).short}</span>
                        <span className="truncate text-slate-600">{timeLabel(p.at).replace(":00", "").replace(" ", "").toLowerCase()}</span>
                      </span>
                    ))}
                    {items.length > 3 && <span className="px-1 text-[11px] font-semibold text-slate-500">+{items.length - 3} more</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day */}
        <section aria-live="polite" className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-24">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-2xl uppercase leading-none text-ink">{dayLabel(selected)}</h2>
            <button
              onClick={() => setEditing("new")}
              disabled={!dbReady}
              aria-label="Add a post on this day"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-ink hover:text-ink disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
          {dayPosts.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              <CalendarDays className="size-6 text-slate-300" />
              Nothing scheduled.
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {dayPosts.map((p) => (
                <li key={p.id}>
                  <PostCard post={p} color={colorOf(p.clientId)} clientName={nameOf(p.clientId)} onEdit={p.source === "manual" ? () => setEditing(p) : undefined} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {editing && (
        <PostEditor
          post={editing === "new" ? null : editing}
          defaultDate={selected}
          clients={clients}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}

function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  return (
    <p className={`mt-4 rounded-2xl px-4 py-3 text-sm ${tone === "warn" ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
      {children}
    </p>
  );
}
