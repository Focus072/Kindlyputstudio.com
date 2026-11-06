"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, LayoutGrid, List, NotebookPen, Plus, RefreshCw, Settings } from "lucide-react";
import { movePost } from "@/app/admin/calendar/buffer-actions";
import type { BufferState } from "@/lib/calendar-data";
import { type CalChannel, type CalClient, type CalPost, UNASSIGNED_COLOR, platformInfo } from "@/lib/calendar";
import { addMonths, dayKey, dayLabel, monthGrid, monthLabel, timeLabel } from "@/lib/calendar-time";
import { Composer, type ComposerMode, duplicateMode } from "./Composer";
import { PostCard } from "./PostCard";
import { PostEditor } from "./PostEditor";

type Props = {
  month: string;
  today: string;
  clients: CalClient[];
  channels: CalChannel[];
  posts: CalPost[];
  buffer: BufferState;
  dbReady: boolean;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const UNASSIGNED = "__none";
const VIEW_KEY = "kp-calendar-view";

export function ContentCalendar(props: Props) {
  // Remount per month so the selected day resets cleanly.
  return <Calendar key={props.month} {...props} />;
}

/** Posts that can still be moved: not published yet. */
function movable(p: CalPost) {
  if (p.source === "manual") return p.status !== "posted";
  return !!p.bufferId && (p.status === "scheduled" || p.status === "draft");
}

function Calendar({ month, today, clients, channels, posts, buffer, dbReady }: Props) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState(today.startsWith(month) ? today : `${month}-01`);
  const [editing, setEditing] = useState<CalPost | "new" | null>(null);
  const [composer, setComposer] = useState<ComposerMode | null>(null);
  const [view, setView] = useState<"month" | "list">("month");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved view after hydration
      if (localStorage.getItem(VIEW_KEY) === "list") setView("list");
    } catch {
      /* ignore */
    }
  }, []);
  // Optimistic drag moves: only applied while the server still reports the old time.
  const [moved, setMoved] = useState<Record<string, { from: string; to: string }>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const canPost = buffer.state !== "off" && channels.length > 0;

  const colorOf = useMemo(() => {
    const m = new Map(clients.map((c) => [c.id, c.color]));
    return (id: string | null) => (id && m.get(id)) || UNASSIGNED_COLOR;
  }, [clients]);
  const nameOf = useMemo(() => {
    const m = new Map(clients.map((c) => [c.id, c.name]));
    return (id: string | null) => (id && m.get(id)) || "Unassigned";
  }, [clients]);

  const shown = useMemo(
    () =>
      posts
        .map((p) => (moved[p.id]?.from === p.at ? { ...p, at: moved[p.id].to } : p))
        .filter((p) => !hidden.has(p.clientId && clients.some((c) => c.id === p.clientId) ? p.clientId : UNASSIGNED)),
    [posts, moved, hidden, clients],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, CalPost[]>();
    for (const p of shown) {
      const k = dayKey(p.at);
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    for (const list of m.values()) list.sort((a, b) => a.at.localeCompare(b.at));
    return m;
  }, [shown]);

  const inMonth = shown.filter((p) => dayKey(p.at).startsWith(month));
  const scheduledCount = inMonth.filter((p) => p.status === "scheduled").length;
  const hasUnassigned = posts.some((p) => !p.clientId || !clients.some((c) => c.id === p.clientId));
  const weeks = monthGrid(month);
  const dayPosts = byDay.get(selected) ?? [];
  const listDays = [...byDay.keys()].filter((k) => k.startsWith(month)).sort();

  function pickView(v: "month" | "list") {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  }

  function toggle(id: string) {
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function newPost(date = selected) {
    if (canPost) setComposer({ kind: "new", date });
    else setEditing("new");
  }

  function editPost(p: CalPost) {
    if (p.source === "manual") setEditing(p);
    else setComposer({ kind: "edit", post: p });
  }

  async function drop(day: string) {
    const p = shown.find((x) => x.id === dragId);
    setDragId(null);
    setDropDay(null);
    if (!p || dayKey(p.at) === day) return;
    if (p.source === "buffer" && day < today) return setToast("Posts can only move to today or later.");
    const keep = p.at;
    const target = new Date(new Date(p.at).getTime() + (Date.parse(`${day}T12:00:00Z`) - Date.parse(`${dayKey(p.at)}T12:00:00Z`))).toISOString();
    setMoved((m) => ({ ...m, [p.id]: { from: posts.find((x) => x.id === p.id)?.at ?? keep, to: target } }));
    const r = await movePost({ source: p.source, id: p.source === "buffer" ? p.bufferId! : p.id, at: keep, toDay: day });
    if (r.error) {
      setMoved((m) => {
        const n = { ...m };
        delete n[p.id];
        return n;
      });
      setToast(r.error);
    } else {
      setToast(`Moved to ${dayLabel(day, { weekday: "short", month: "short", day: "numeric" })}.`);
      router.refresh();
    }
    setTimeout(() => setToast(null), 3500);
  }

  const chips = [...clients.map((c) => ({ id: c.id, name: c.name, color: c.color })), ...(hasUnassigned ? [{ id: UNASSIGNED, name: "Unassigned", color: UNASSIGNED_COLOR }] : [])];

  const card = (p: CalPost) => (
    <PostCard
      post={p}
      color={colorOf(p.clientId)}
      clientName={nameOf(p.clientId)}
      onEdit={p.source === "manual" || (p.bufferId && p.status !== "posted") ? () => editPost(p) : undefined}
      onDuplicate={canPost && (p.caption || p.media.length) ? () => setComposer(duplicateMode(p, today)) : undefined}
    />
  );

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
            onClick={() => newPost(selected >= today ? selected : today)}
            disabled={!dbReady}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-brand disabled:opacity-40"
          >
            <Plus className="size-4" strokeWidth={2.5} /> {canPost ? "New post" : "Add a plan"}
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
          Connect Buffer to schedule posts from here.{" "}
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
      {buffer.state !== "off" && channels.length > 0 && channels.every((c) => !c.clientId) && (
        <Notice>
          Your Buffer accounts don&rsquo;t have clients yet, so everything shows in grey.{" "}
          <Link href="/admin/calendar/settings" className="font-semibold text-ink underline underline-offset-2">
            Set up clients in one tap
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
            {scheduledCount ? ` · ${scheduledCount} scheduled` : ""}
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

      {/* Client colors (tap to show or hide) and view switch */}
      <div className="mt-3 flex items-start gap-2">
        {chips.length > 0 ? (
          <div className="-ml-4 flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 pl-4 sm:ml-0 sm:flex-wrap sm:pl-0">
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
          <p className="flex-1 pt-2 text-sm text-slate-500">
            {dbReady && (
              <>
                <Link href="/admin/calendar/settings" className="font-semibold text-ink underline underline-offset-2">
                  Add your clients
                </Link>{" "}
                and give each one a color.
              </>
            )}
          </p>
        )}
        <div role="radiogroup" aria-label="View" className="flex shrink-0 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {(
            [
              { id: "month", label: "Month", icon: LayoutGrid },
              { id: "list", label: "List", icon: List },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              role="radio"
              aria-checked={view === v.id}
              aria-label={v.label}
              onClick={() => pickView(v.id)}
              className={`inline-flex size-8 items-center justify-center rounded-full sm:w-auto sm:gap-1.5 sm:px-3 ${view === v.id ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}
            >
              <v.icon className="size-4" />
              <span className="hidden text-xs font-semibold sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {view === "list" ? (
        <div className="mt-4 space-y-5">
          {listDays.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">
              <CalendarDays className="size-6 text-slate-300" />
              Nothing planned this month yet.
            </div>
          )}
          {listDays.map((k) => (
            <section key={k} className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-6">
              <h2 className={`sticky top-[calc(env(safe-area-inset-top)+3.75rem)] z-[2] -mx-1 mb-2 bg-[#eceef0]/95 px-1 py-1 font-display text-2xl uppercase leading-none backdrop-blur lg:top-24 lg:mx-0 lg:mb-0 lg:text-balance lg:bg-transparent lg:px-0 lg:pt-3 lg:backdrop-blur-none ${k === today ? "text-ink" : k < today ? "text-slate-400" : "text-ink"}`}>
                {dayLabel(k)}
                {k === today && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 align-middle font-sans text-[10px] font-bold text-white">TODAY</span>}
              </h2>
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)] 2xl:grid-cols-2">
                {(byDay.get(k) ?? []).map((p) => (
                  <li key={p.id} className="rounded-2xl bg-white">
                    {card(p)}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
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
                const isDrop = dropDay === k && dragId;
                return (
                  <div
                    key={k}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(k)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelected(k))}
                    onDragOver={(e) => {
                      if (!dragId) return;
                      e.preventDefault();
                      setDropDay(k);
                    }}
                    onDragLeave={() => setDropDay((d) => (d === k ? null : d))}
                    onDrop={(e) => {
                      e.preventDefault();
                      drop(k);
                    }}
                    aria-label={`${dayLabel(k)}, ${items.length} post${items.length === 1 ? "" : "s"}`}
                    aria-pressed={isSel}
                    className={`relative flex min-h-16 cursor-pointer flex-col items-stretch gap-1 border-slate-100 p-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-brand sm:min-h-28 sm:p-1.5 ${
                      i % 7 ? "border-l" : ""
                    } ${i >= 7 ? "border-t" : ""} ${isDrop ? "bg-steel/40" : outside ? "bg-slate-50/70" : "bg-white"} ${isSel ? "z-[1] ring-2 ring-inset ring-ink" : "hover:bg-slate-50"}`}
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

                    {/* Tablet and up: labeled chips, drag to move */}
                    <span className={`hidden flex-col gap-1 sm:flex ${outside ? "opacity-50" : ""}`}>
                      {items.slice(0, 3).map((p) => {
                        const canMove = movable(p);
                        return (
                          <span
                            key={p.id}
                            draggable={canMove}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", p.id);
                              e.dataTransfer.effectAllowed = "move";
                              setDragId(p.id);
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setDropDay(null);
                            }}
                            className={`flex min-w-0 items-center gap-1 rounded-md border-l-[3px] px-1.5 py-0.5 text-[11px] xl:flex-wrap xl:gap-y-0 leading-tight text-ink ${p.status === "idea" || p.status === "draft" ? "border-dashed" : ""} ${canMove ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === p.id ? "opacity-40" : ""}`}
                            style={{ borderLeftColor: colorOf(p.clientId), background: `${colorOf(p.clientId)}1f` }}
                            title={`${nameOf(p.clientId)} · ${platformInfo(p.platform).label} · ${timeLabel(p.at)}${canMove ? " · drag to move" : ""}`}
                          >
                            {p.status === "error" && <CircleAlert className="size-3 shrink-0 text-decline" />}
                            <span className="shrink-0 font-bold">{platformInfo(p.platform).short}</span>
                            <span className="truncate text-slate-600">{timeLabel(p.at).replace(":00", "").replace(" ", "").toLowerCase()}</span>
                            {p.caption && <span className="hidden min-w-0 basis-full truncate text-slate-500 xl:block">{p.caption}</span>}
                          </span>
                        );
                      })}
                      {items.length > 3 && <span className="px-1 text-[11px] font-semibold text-slate-500">+{items.length - 3} more</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected day */}
          <section aria-live="polite" className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-24">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-2xl uppercase leading-none text-ink">{dayLabel(selected)}</h2>
              <div className="flex shrink-0 gap-1.5">
                {canPost && (
                  <button
                    onClick={() => setEditing("new")}
                    disabled={!dbReady}
                    aria-label="Add a plan on this day"
                    title="Add a plan (only on this calendar)"
                    className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-ink hover:text-ink disabled:opacity-40"
                  >
                    <NotebookPen className="size-4" />
                  </button>
                )}
                <button
                  onClick={() => newPost(selected >= today ? selected : today)}
                  disabled={!dbReady}
                  aria-label={canPost ? "New post on this day" : "Add a plan on this day"}
                  className="inline-flex size-9 items-center justify-center rounded-full bg-ink text-white hover:bg-slate-brand disabled:opacity-40"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
            {dayPosts.length === 0 ? (
              <button
                onClick={() => newPost(selected >= today ? selected : today)}
                disabled={!dbReady}
                className="mt-4 flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 hover:border-ink hover:text-ink"
              >
                <CalendarDays className="size-6 text-slate-300" />
                Nothing scheduled. {canPost ? <><span className="pointer-fine:hidden">Tap</span><span className="hidden pointer-fine:inline">Click</span> to plan a post.</> : ""}
              </button>
            ) : (
              <ul className="mt-3 space-y-3">
                {dayPosts.map((p) => (
                  <li key={p.id}>{card(p)}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {toast && (
        <p role="status" className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-sm rounded-2xl bg-ink px-4 py-3 text-center text-sm font-semibold text-white shadow-xl sm:bottom-6">
          {toast}
        </p>
      )}

      {editing && <PostEditor post={editing === "new" ? null : editing} defaultDate={selected} clients={clients} onClose={() => setEditing(null)} />}
      {composer && <Composer mode={composer} clients={clients} channels={channels} today={today} onClose={() => setComposer(null)} />}
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
