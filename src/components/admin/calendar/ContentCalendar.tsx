"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  LayoutGrid,
  Lightbulb,
  List,
  NotebookPen,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { movePost, syncNow } from "@/app/admin/calendar/buffer-actions";
import type { BufferState } from "@/lib/calendar-data";
import {
  type CalChannel,
  type CalClient,
  type CalPost,
  type CalTag,
  UNASSIGNED,
  UNASSIGNED_COLOR,
  isEditable,
  platformInfo,
} from "@/lib/calendar";
import {
  addDays,
  addMonths,
  dayKey,
  dayLabel,
  monthGrid,
  monthLabel,
  relativeLabel,
  timeLabel,
  weekDays,
  weekLabel,
} from "@/lib/calendar-time";
import { Composer, type ComposerMode, duplicateMode } from "./Composer";
import { ChannelAvatar, PlatformIcon } from "./PlatformIcon";
import { PostCard, statusTone } from "./PostCard";
import { PostEditor } from "./PostEditor";

export type CalView = "week" | "month" | "list";

type Props = {
  view: CalView;
  month: string;
  anchor: string;
  today: string;
  clients: CalClient[];
  channels: CalChannel[];
  tags: CalTag[];
  posts: CalPost[];
  buffer: BufferState;
  dbReady: boolean;
  /** Buffer accounts that just appeared on the site. */
  added: string[];
  initialClient: string | null;
};

type StatusFilter = "all" | "scheduled" | "posted" | "draft" | "attention";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CLIENT_KEY = "kp-calendar-client";

export function ContentCalendar(props: Props) {
  // Remount per range so the selected day resets cleanly.
  return <Calendar key={`${props.view}-${props.view === "week" ? props.anchor : props.month}`} {...props} />;
}

/** The page reads this cookie so the chosen view opens without a flash. */
function rememberView(v: CalView) {
  document.cookie = `kp-cal-view=${v}; path=/admin; max-age=31536000; samesite=lax`;
}

function needsAttention(p: CalPost) {
  return p.status === "error" || (p.status === "posted" && !!p.reminder) || p.status === "draft";
}

function Calendar({ view, month, anchor, today, clients, channels, tags, posts, buffer, dbReady, added, initialClient }: Props) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [client, setClient] = useState<string>(initialClient && (initialClient === UNASSIGNED || clients.some((c) => c.id === initialClient)) ? initialClient : "all");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState(today.startsWith(month) ? today : view === "week" ? anchor : `${month}-01`);
  const [editing, setEditing] = useState<CalPost | "new" | null>(null);
  const [composer, setComposer] = useState<ComposerMode | null>(null);
  const [sheet, setSheet] = useState<CalPost | null>(null);
  const [moved, setMoved] = useState<Record<string, { from: string; to: string }>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(added.length ? `New in Buffer: ${added.join(", ")}. Added to the calendar.` : null);
  const [now] = useState(() => Date.now());
  const canPost = buffer.state !== "off" && channels.length > 0;

  // Restore the last client filter when the URL doesn't name one.
  useEffect(() => {
    if (initialClient) return;
    try {
      const saved = localStorage.getItem(CLIENT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore after hydration
      if (saved && (saved === UNASSIGNED || clients.some((c) => c.id === saved))) setClient(saved);
    } catch {
      /* ignore */
    }
  }, [initialClient, clients]);

  // Keep the picked client in view on phones, where the rail scrolls sideways.
  const railRef = useRef<HTMLElement>(null);
  useEffect(() => {
    railRef.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [client]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function pickClient(id: string) {
    setClient(id);
    try {
      if (id === "all") localStorage.removeItem(CLIENT_KEY);
      else localStorage.setItem(CLIENT_KEY, id);
    } catch {
      /* ignore */
    }
    const u = new URL(window.location.href);
    if (id === "all") u.searchParams.delete("c");
    else u.searchParams.set("c", id);
    window.history.replaceState(null, "", u.toString());
  }

  const clientIds = useMemo(() => new Set(clients.map((c) => c.id)), [clients]);
  const clientOf = (p: { clientId: string | null }) => (p.clientId && clientIds.has(p.clientId) ? p.clientId : UNASSIGNED);
  const colorOf = useMemo(() => {
    const m = new Map(clients.map((c) => [c.id, c.color]));
    return (id: string | null) => (id && m.get(id)) || UNASSIGNED_COLOR;
  }, [clients]);
  const nameOf = useMemo(() => {
    const m = new Map(clients.map((c) => [c.id, c.name]));
    return (id: string | null) => (id && m.get(id)) || "No client";
  }, [clients]);

  // Client + network filters (status filter applies to the views, not the summary).
  const scoped = useMemo(
    () =>
      posts
        .map((p) => (moved[p.id]?.from === p.at ? { ...p, at: moved[p.id].to } : p))
        .filter((p) => (client === "all" || clientOf(p) === client) && (platform === "all" || platformInfo(p.platform).id === platform)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posts, moved, client, platform, clientIds],
  );
  const shown = useMemo(
    () =>
      scoped.filter((p) =>
        status === "all" ? true : status === "attention" ? needsAttention(p) && dayKey(p.at) >= addDays(today, -7) : status === "draft" ? p.status === "draft" || p.status === "idea" : p.status === status,
      ),
    [scoped, status, today],
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

  // Right-now summary --------------------------------------------------------
  const summary = useMemo(() => {
    const todays = scoped.filter((p) => dayKey(p.at) === today);
    const next = scoped.filter((p) => p.status === "scheduled" && Date.parse(p.at) > now).sort((a, b) => a.at.localeCompare(b.at))[0] ?? null;
    const weekEnd = addDays(today, 7);
    const upcoming = scoped.filter((p) => p.status === "scheduled" && dayKey(p.at) >= today && dayKey(p.at) < weekEnd);
    const covered = new Set(upcoming.map((p) => clientOf(p)));
    const activeClients = clients.filter((c) => channels.some((ch) => ch.clientId === c.id));
    const quiet = client === "all" ? activeClients.filter((c) => !covered.has(c.id)) : activeClients.filter((c) => c.id === client && !covered.has(c.id));
    const attention = scoped.filter((p) => needsAttention(p) && dayKey(p.at) >= addDays(today, -7));
    return { todays, next, upcoming, quiet, attention, failed: attention.filter((p) => p.status === "error").length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, today, now, clients, channels, client]);

  // Counts per client for the filter rail (inside the loaded range).
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of posts) {
      if (platform !== "all" && platformInfo(p.platform).id !== platform) continue;
      m.set(clientOf(p), (m.get(clientOf(p)) ?? 0) + 1);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, platform, clientIds]);
  const services = useMemo(() => [...new Set([...channels.map((c) => platformInfo(c.service).id), ...posts.map((p) => platformInfo(p.platform).id)])], [channels, posts]);
  const hasUnassigned = posts.some((p) => clientOf(p) === UNASSIGNED) || channels.some((c) => !c.clientId || !clientIds.has(c.clientId));
  const reconnect = channels.filter((c) => c.needsReconnect && (client === "all" || c.clientId === client));

  // Navigation ---------------------------------------------------------------
  const week = weekDays(anchor);
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams(extra);
    if (client !== "all") p.set("c", client);
    return `/admin/calendar?${p.toString()}`;
  };
  const prevHref = view === "week" ? qs({ view, d: addDays(anchor, -7) }) : qs({ view, m: addMonths(month, -1) });
  const nextHref = view === "week" ? qs({ view, d: addDays(anchor, 7) }) : qs({ view, m: addMonths(month, 1) });
  const isCurrent = view === "week" ? week.includes(today) : today.startsWith(month);
  const rangeLabel = view === "week" ? weekLabel(week) : monthLabel(month);
  const shortLabel = view === "week" ? rangeLabel : monthLabel(month).replace(/^(\w{3})\w*/, "$1");
  const inRange = shown.filter((p) => (view === "week" ? week.includes(dayKey(p.at)) : dayKey(p.at).startsWith(month)));

  function setView(v: CalView) {
    rememberView(v);
    router.push(v === "week" ? qs({ view: v, d: today.startsWith(month) || view === "week" ? anchor : `${month}-01` }) : qs({ view: v, m: view === "week" ? anchor.slice(0, 7) : month }));
  }

  function refresh() {
    startRefresh(async () => {
      const r = await syncNow();
      setToast(r.error ?? r.ok ?? null);
      router.refresh();
    });
  }

  function newPost(date = selected) {
    const d = date >= today ? date : today;
    if (canPost) setComposer({ kind: "new", date: d, clientId: client !== "all" && client !== UNASSIGNED ? client : null });
    else setEditing("new");
  }

  function openPost(p: CalPost) {
    setSheet(p);
  }

  function editPost(p: CalPost) {
    setSheet(null);
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
  }

  const dropProps = (k: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragId) return;
      e.preventDefault();
      setDropDay(k);
    },
    onDragLeave: () => setDropDay((d) => (d === k ? null : d)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      drop(k);
    },
  });
  const dragProps = (p: CalPost) =>
    isEditable(p) && p.status !== "error"
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            e.dataTransfer.setData("text/plain", p.id);
            e.dataTransfer.effectAllowed = "move";
            setDragId(p.id);
          },
          onDragEnd: () => {
            setDragId(null);
            setDropDay(null);
          },
        }
      : {};

  const card = (p: CalPost) => (
    <PostCard
      post={p}
      color={colorOf(clientOf(p))}
      clientName={nameOf(clientOf(p))}
      onEdit={isEditable(p) ? () => editPost(p) : undefined}
      onDuplicate={canPost && (p.caption || p.media.length) ? () => (setSheet(null), setComposer(duplicateMode(p, today))) : undefined}
    />
  );

  const clientChips = [
    ...clients.map((c) => ({ id: c.id, name: c.name, color: c.color, accounts: channels.filter((ch) => ch.clientId === c.id) })),
    ...(hasUnassigned ? [{ id: UNASSIGNED, name: "No client", color: UNASSIGNED_COLOR, accounts: channels.filter((ch) => !ch.clientId || !clientIds.has(ch.clientId)) }] : []),
  ];
  const activeClient = clientChips.find((c) => c.id === client);

  return (
    <main>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-typewriter text-sm text-slate-500">What&rsquo;s going out</p>
          <h1 className="font-display text-5xl uppercase leading-none text-ink">Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          {buffer.state !== "off" && (
            <button
              onClick={refresh}
              disabled={refreshing}
              aria-label="Sync with Buffer"
              title="Sync accounts and posts with Buffer"
              className="inline-flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-ink hover:text-ink sm:w-auto sm:gap-1.5 sm:px-4"
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden text-sm font-semibold sm:inline">{refreshing ? "Syncing…" : "Sync"}</span>
            </button>
          )}
          <Link
            href={`/admin/calendar/ideas${client !== "all" && client !== UNASSIGNED ? `?c=${client}` : ""}`}
            title="Share a client's calendar and ideas board"
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 hover:border-ink hover:text-ink sm:px-4"
          >
            <Lightbulb className="size-4" /> <span className="hidden sm:inline">Client plans</span><span className="sm:hidden">Plans</span>
          </Link>
          <Link
            href="/admin/calendar/settings"
            aria-label="Calendar settings"
            className="inline-flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-ink hover:text-ink"
          >
            <Settings className="size-5" />
          </Link>
          <button
            onClick={() => newPost(isCurrent ? today : selected)}
            disabled={!dbReady}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-brand disabled:opacity-40"
          >
            <Plus className="size-4" strokeWidth={2.5} /> {canPost ? "New post" : "Add a plan"}
          </button>
        </div>
      </div>

      {!dbReady && <Notice tone="warn">The calendar&rsquo;s database tables aren&rsquo;t set up yet. Once the update runs, clients, colors and posts will save here.</Notice>}
      {buffer.state === "off" && dbReady && (
        <Notice>
          Connect Buffer to see and schedule every account&rsquo;s posts here.{" "}
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
      {reconnect.length > 0 && (
        <Notice tone="warn">
          Buffer lost access to {reconnect.map((c) => c.name).join(", ")}. Posts there won&rsquo;t go out until you reconnect {reconnect.length === 1 ? "it" : "them"} in{" "}
          <a href="https://publish.buffer.com/channels" target="_blank" rel="noreferrer" className="font-semibold text-ink underline underline-offset-2">
            Buffer
          </a>
          .
        </Notice>
      )}

      {/* Client filter */}
      {clientChips.length > 0 && (
        <nav ref={railRef} aria-label="Filter by client" className="-mx-4 mt-5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            <ClientChip active={client === "all"} onClick={() => pickClient("all")} label="All clients" count={posts.length} />
            {clientChips.map((c) => (
              <ClientChip key={c.id} active={client === c.id} onClick={() => pickClient(c.id)} label={c.name} color={c.color} accounts={c.accounts} count={counts.get(c.id) ?? 0} />
            ))}
          </div>
        </nav>
      )}

      {/* Right now */}
      {buffer.state !== "off" && (
        <section aria-label="Right now" className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <Stat
            icon={<CalendarDays className="size-4" />}
            label="Today"
            value={summary.todays.length ? `${summary.todays.length} post${summary.todays.length === 1 ? "" : "s"}` : "Nothing"}
            detail={
              summary.todays.length
                ? `${summary.todays.filter((p) => p.status === "posted").length} out · ${summary.todays.filter((p) => p.status === "scheduled").length} to go`
                : "Nothing goes out today"
            }
            onClick={() => (view === "week" && isCurrent ? document.getElementById(`day-${today}`)?.scrollIntoView({ behavior: "smooth", block: "start" }) : router.push(qs({ view: "week", d: today })))}
          />
          <button
            type="button"
            onClick={() => summary.next && openPost(summary.next)}
            disabled={!summary.next}
            className="flex min-w-0 items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 hover:ring-ink disabled:hover:ring-slate-200 sm:p-4"
          >
            {summary.next ? (
              <>
                {summary.next.thumb ? (
                  <img src={summary.next.thumb} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
                ) : (
                  <ChannelAvatar avatar={summary.next.channelAvatar} service={summary.next.platform} name={summary.next.channelName} size="size-11" />
                )}
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <Clock className="size-3.5" /> Next up
                  </span>
                  <span className="block truncate text-sm font-bold text-ink">{relativeLabel(summary.next.at, now)}</span>
                  <span className="block truncate text-xs text-slate-500">{summary.next.channelName ?? nameOf(clientOf(summary.next))}</span>
                </span>
              </>
            ) : (
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <Clock className="size-3.5" /> Next up
                </span>
                <span className="block text-sm font-bold text-ink">Nothing scheduled</span>
                <span className="block text-xs text-slate-500">The queue is empty</span>
              </span>
            )}
          </button>
          <Stat
            icon={<CalendarRange className="size-4" />}
            label="Next 7 days"
            value={`${summary.upcoming.length} scheduled`}
            detail={summary.quiet.length ? `Nothing for ${summary.quiet.map((c) => c.name).slice(0, 2).join(", ")}${summary.quiet.length > 2 ? ` +${summary.quiet.length - 2}` : ""}` : "Every client has posts"}
            warn={summary.quiet.length > 0}
            onClick={() => router.push(qs({ view: "week", d: today }))}
          />
          <Stat
            icon={<CircleAlert className="size-4" />}
            label="Needs a look"
            value={summary.attention.length ? `${summary.attention.length} post${summary.attention.length === 1 ? "" : "s"}` : "All clear"}
            detail={summary.attention.length ? `${summary.failed ? `${summary.failed} failed · ` : ""}drafts and reminders` : "No failed posts or drafts"}
            warn={summary.failed > 0}
            active={status === "attention"}
            onClick={() => setStatus(status === "attention" ? "all" : "attention")}
          />
        </section>
      )}

      {/* Range switcher and view */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-3xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
        <div className="order-1 flex min-w-0 flex-1 items-center gap-1">
          <Link href={prevHref} aria-label={view === "week" ? "Previous week" : "Previous month"} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0 px-1">
            <p className="truncate font-display text-2xl uppercase leading-none text-ink sm:text-3xl">
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{rangeLabel}</span>
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {inRange.length} post{inRange.length === 1 ? "" : "s"}
              {activeClient ? ` · ${activeClient.name}` : ""}
              {buffer.state === "ok" ? " · live from Buffer" : ""}
            </p>
          </div>
          <Link href={nextHref} aria-label={view === "week" ? "Next week" : "Next month"} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100">
            <ChevronRight className="size-5" />
          </Link>
          {!isCurrent && (
            <Link href={qs({ view })} className="ml-1 inline-flex h-9 shrink-0 items-center rounded-full border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:border-ink hover:text-ink">
              Today
            </Link>
          )}
        </div>
        <div className="order-3 flex w-full items-center gap-2 sm:order-2 sm:w-auto">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Network" className="h-10 min-w-0 flex-1 rounded-full border border-slate-200 bg-white pl-3 pr-8 text-sm font-semibold text-slate-600 sm:flex-none">
            <option value="all">All networks</option>
            {services.map((s) => (
              <option key={s} value={s}>
                {platformInfo(s).label}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Status" className="h-10 min-w-0 flex-1 rounded-full border border-slate-200 bg-white pl-3 pr-8 text-sm font-semibold text-slate-600 sm:flex-none">
            <option value="all">Every status</option>
            <option value="scheduled">Scheduled</option>
            <option value="posted">Posted</option>
            <option value="draft">Drafts</option>
            <option value="attention">Needs a look</option>
          </select>
        </div>
        <div role="radiogroup" aria-label="View" className="order-2 flex shrink-0 rounded-full bg-slate-100 p-1 sm:order-3">
            {(
              [
                { id: "week", label: "Week", icon: CalendarRange },
                { id: "month", label: "Month", icon: LayoutGrid },
                { id: "list", label: "List", icon: List },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                role="radio"
                aria-checked={view === v.id}
                aria-label={v.label}
                onClick={() => view !== v.id && setView(v.id)}
                className={`inline-flex size-8 items-center justify-center rounded-full lg:w-auto lg:gap-1.5 lg:px-3 ${view === v.id ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"}`}
              >
                <v.icon className="size-4" />
                <span className="hidden text-xs font-semibold lg:inline">{v.label}</span>
              </button>
            ))}
        </div>
      </div>

      {(status !== "all" || platform !== "all") && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          Showing {status === "attention" ? "failed posts, drafts and reminders" : status !== "all" ? `${status} posts` : "posts"}
          {platform !== "all" ? ` on ${platformInfo(platform).label}` : ""}.
          <button
            onClick={() => {
              setStatus("all");
              setPlatform("all");
            }}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink ring-1 ring-slate-200 hover:ring-ink"
          >
            <X className="size-3" /> Clear
          </button>
        </div>
      )}

      {/* Views */}
      {view === "week" && (
        <>
          {/* Desktop: seven columns */}
          <div className="mt-4 hidden overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 lg:grid lg:grid-cols-7">
            {week.map((k, i) => {
              const items = byDay.get(k) ?? [];
              const past = k < today;
              return (
                <div key={k} id={`day-${k}`} {...dropProps(k)} className={`group flex min-h-[28rem] min-w-0 flex-col ${i ? "border-l border-slate-100" : ""} ${dropDay === k && dragId ? "bg-steel/30" : past ? "bg-slate-50/60" : ""}`}>
                  <div className={`flex items-center justify-between gap-1 border-b border-slate-100 px-2.5 py-2 ${k === today ? "bg-ink text-white" : ""}`}>
                    <span className="flex items-baseline gap-1.5">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${k === today ? "text-mist" : "text-slate-400"}`}>{WEEKDAYS[i]}</span>
                      <span className={`font-display text-2xl leading-none ${k === today ? "text-white" : past ? "text-slate-400" : "text-ink"}`}>{Number(k.slice(8))}</span>
                    </span>
                    {!past && dbReady && (
                      <button
                        onClick={() => newPost(k)}
                        aria-label={`New post on ${dayLabel(k)}`}
                        className={`inline-flex size-7 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100 focus:opacity-100 ${k === today ? "hover:bg-white/15" : "hover:bg-slate-100"}`}
                      >
                        <Plus className="size-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-2">
                    {items.map((p) => (
                      <WeekTile key={p.id} post={p} color={colorOf(clientOf(p))} onOpen={() => openPost(p)} dragging={dragId === p.id} {...dragProps(p)} />
                    ))}
                    {!items.length && !past && dbReady && (
                      <button onClick={() => newPost(k)} className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-transparent text-xs font-semibold text-slate-300 hover:border-slate-300 hover:text-slate-500">
                        + Plan a post
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Phones and tablets: day by day */}
          <div className="mt-4 space-y-4 lg:hidden">
            {week.map((k) => {
              const items = byDay.get(k) ?? [];
              const past = k < today;
              return (
                <section key={k} id={`day-m-${k}`} className="scroll-mt-24">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className={`font-display text-2xl uppercase leading-none ${past ? "text-slate-400" : "text-ink"}`}>
                      {dayLabel(k, { weekday: "long", month: "short", day: "numeric" })}
                      {k === today && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 align-middle font-sans text-[10px] font-bold text-white">TODAY</span>}
                    </h2>
                    {!past && dbReady && (
                      <button onClick={() => newPost(k)} aria-label={`New post on ${dayLabel(k)}`} className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-ink hover:text-ink">
                        <Plus className="size-4" />
                      </button>
                    )}
                  </div>
                  {items.length ? (
                    <ul className="grid gap-3 md:grid-cols-2">
                      {items.map((p) => (
                        <li key={p.id}>{card(p)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-400">Nothing {past ? "went out" : "planned"}.</p>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {view === "list" && (
        <ListView
          month={month}
          today={today}
          byDay={byDay}
          card={card}
          onNew={newPost}
        />
      )}

      {view === "month" && (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
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
              {monthGrid(month).flat().map((k, i) => {
                const items = byDay.get(k) ?? [];
                const outside = !k.startsWith(month);
                const isSel = k === selected;
                return (
                  <div
                    key={k}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(k)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelected(k))}
                    {...dropProps(k)}
                    aria-label={`${dayLabel(k)}, ${items.length} post${items.length === 1 ? "" : "s"}`}
                    aria-pressed={isSel}
                    className={`relative flex min-h-16 cursor-pointer flex-col items-stretch gap-1 border-slate-100 p-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-brand sm:min-h-28 sm:p-1.5 ${
                      i % 7 ? "border-l" : ""
                    } ${i >= 7 ? "border-t" : ""} ${dropDay === k && dragId ? "bg-steel/40" : outside ? "bg-slate-50/70" : "bg-white"} ${isSel ? "z-[1] ring-2 ring-inset ring-ink" : "hover:bg-slate-50"}`}
                  >
                    <span className={`flex size-6 items-center justify-center self-center rounded-full text-xs font-bold sm:self-start ${k === today ? "bg-ink text-white" : outside ? "text-slate-300" : "text-slate-600"}`}>
                      {Number(k.slice(8))}
                    </span>
                    {items.length > 0 && (
                      <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                        {items.slice(0, 4).map((p) => (
                          <span key={p.id} className="size-1.5 rounded-full" style={{ background: colorOf(clientOf(p)), opacity: outside ? 0.5 : 1 }} />
                        ))}
                        {items.length > 4 && <span className="text-[9px] font-bold leading-none text-slate-400">+</span>}
                      </span>
                    )}
                    <span className={`hidden flex-col gap-1 sm:flex ${outside ? "opacity-50" : ""}`}>
                      {items.slice(0, 3).map((p) => {
                        const c = colorOf(clientOf(p));
                        return (
                          <span
                            key={p.id}
                            {...dragProps(p)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(k);
                              openPost(p);
                            }}
                            className={`flex min-w-0 items-center gap-1 rounded-md border-l-[3px] px-1 py-0.5 text-[11px] leading-tight text-ink hover:brightness-95 xl:flex-wrap xl:gap-y-0 ${p.status === "idea" || p.status === "draft" ? "border-dashed" : ""} ${isEditable(p) ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${dragId === p.id ? "opacity-40" : ""}`}
                            style={{ borderLeftColor: c, background: `${c}1f` }}
                            title={`${nameOf(clientOf(p))} · ${p.channelName ?? platformInfo(p.platform).label} · ${timeLabel(p.at)}`}
                          >
                            {p.status === "error" ? <CircleAlert className="size-3 shrink-0 text-decline" /> : <PlatformIcon service={p.platform} className="size-3.5" />}
                            <span className="truncate text-slate-600">{timeLabel(p.at).replace(":00", "").replace(" ", "").toLowerCase()}</span>
                            {p.status === "posted" && <span className="size-1.5 shrink-0 rounded-full bg-approve" />}
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
                  onClick={() => newPost(selected)}
                  disabled={!dbReady}
                  aria-label={canPost ? "New post on this day" : "Add a plan on this day"}
                  className="inline-flex size-9 items-center justify-center rounded-full bg-ink text-white hover:bg-slate-brand disabled:opacity-40"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
            {(byDay.get(selected) ?? []).length === 0 ? (
              <button
                onClick={() => newPost(selected)}
                disabled={!dbReady}
                className="mt-4 flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 hover:border-ink hover:text-ink"
              >
                <CalendarDays className="size-6 text-slate-300" />
                Nothing {selected < today ? "went out" : "scheduled"}. {selected >= today && canPost ? <><span className="pointer-fine:hidden">Tap</span><span className="hidden pointer-fine:inline">Click</span> to plan a post.</> : ""}
              </button>
            ) : (
              <ul className="mt-3 space-y-3">
                {(byDay.get(selected) ?? []).map((p) => (
                  <li key={p.id}>{card(p)}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {buffer.state !== "off" && channels.length > 0 && channels.every((c) => !c.clientId) && (
        <Notice>
          <Sparkles className="mr-1 inline size-4" /> Your Buffer accounts don&rsquo;t have clients yet.{" "}
          <Link href="/admin/calendar/settings" className="font-semibold text-ink underline underline-offset-2">
            Set up clients in one tap
          </Link>
        </Notice>
      )}

      {toast && (
        <p role="status" className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-2xl bg-ink px-4 py-3 text-center text-sm font-semibold text-white shadow-xl sm:bottom-6">
          {toast}
        </p>
      )}

      {sheet && <PostSheet onClose={() => setSheet(null)}>{card(sheet)}</PostSheet>}
      {editing && <PostEditor post={editing === "new" ? null : editing} defaultDate={selected} clients={clients} onClose={() => setEditing(null)} />}
      {composer && <Composer mode={composer} clients={clients} channels={channels} tags={tags} today={today} onClose={() => setComposer(null)} />}
    </main>
  );
}

function ClientChip({
  active,
  onClick,
  label,
  color,
  accounts,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
  accounts?: CalChannel[];
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-sm font-semibold transition ${
        active ? "bg-ink text-white shadow-md" : "bg-white text-ink shadow-sm ring-1 ring-slate-200 hover:ring-ink"
      }`}
    >
      {accounts?.length ? (
        <span className="flex -space-x-2">
          {accounts.slice(0, 3).map((a) => (
            <span key={a.id} className={`rounded-full ring-2 ${active ? "ring-ink" : "ring-white"}`}>
              {a.avatar ? (
                <img src={a.avatar} alt="" className="size-8 rounded-full object-cover" />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: color }}>
                  {label.slice(0, 2).toUpperCase()}
                </span>
              )}
            </span>
          ))}
        </span>
      ) : (
        <span className={`flex size-8 items-center justify-center rounded-full ${active ? "bg-white/15" : "bg-slate-100"}`}>
          {color ? <span className="size-3 rounded-full" style={{ background: color }} /> : <LayoutGrid className="size-4" />}
        </span>
      )}
      {color && <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="whitespace-nowrap">{label}</span>
      <span className={`rounded-full px-1.5 text-[11px] font-bold ${active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>{count}</span>
    </button>
  );
}

function Stat({
  icon,
  label,
  value,
  detail,
  onClick,
  warn,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  onClick?: () => void;
  warn?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-0 rounded-2xl p-3 text-left shadow-sm ring-1 transition sm:p-4 ${active ? "bg-ink text-white ring-ink" : "bg-white ring-slate-200 hover:ring-ink"}`}
    >
      <span className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${active ? "text-mist" : "text-slate-400"}`}>
        {icon} {label}
      </span>
      <span className="mt-0.5 block truncate text-sm font-bold sm:text-base">{value}</span>
      <span className={`block truncate text-xs ${active ? "text-mist" : warn ? "font-semibold text-amber-700" : "text-slate-500"}`}>{detail}</span>
    </button>
  );
}

function WeekTile({
  post,
  color,
  onOpen,
  dragging,
  ...drag
}: {
  post: CalPost;
  color: string;
  onOpen: () => void;
  dragging: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}) {
  const thumb = post.thumb;
  const reminded = post.status === "posted" && post.reminder;
  return (
    <button
      type="button"
      onClick={onOpen}
      {...drag}
      className={`group/tile w-full overflow-hidden rounded-xl bg-white text-left ring-1 ring-slate-200 transition hover:shadow-md hover:ring-ink ${drag.draggable ? "cursor-grab active:cursor-grabbing" : ""} ${dragging ? "opacity-40" : ""} ${post.status === "draft" || post.status === "idea" ? "ring-dashed" : ""}`}
      style={{ boxShadow: `inset 3px 0 0 ${color}` }}
    >
      <span className="flex items-center gap-1.5 px-2 pb-1.5 pl-2.5 pt-2">
        <ChannelAvatar avatar={post.channelAvatar} service={post.platform} name={post.channelName} size="size-7" badge="size-3.5" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink">{timeLabel(post.at)}</span>
        <span
          className={`size-2 shrink-0 rounded-full ${post.status === "posted" ? (reminded ? "bg-amber-400" : "bg-approve") : post.status === "error" ? "bg-decline" : post.status === "scheduled" ? "bg-slate-brand" : "border border-slate-400"}`}
          title={post.status}
        />
      </span>
      {thumb && (
        <span className="relative mx-2 block aspect-square overflow-hidden rounded-lg bg-slate-100">
          <img src={thumb} alt="" loading="lazy" className="size-full object-cover" />
          {post.media.length > 1 && <span className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-white">{post.media.length}</span>}
          {post.isVideo && <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-white">▶</span>}
        </span>
      )}
      <span className={`block px-2.5 pb-2 pt-1.5 text-[11px] leading-snug text-slate-600 ${thumb ? "line-clamp-2" : "line-clamp-4"}`}>
        {post.caption || <span className="italic text-slate-400">No caption</span>}
      </span>
      {post.status === "error" && <span className="block bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase text-decline">Failed</span>}
      {post.status === "draft" && <span className={`mx-2 mb-2 inline-block rounded-full px-1.5 text-[10px] font-bold uppercase ${statusTone.draft}`}>Draft</span>}
    </button>
  );
}

function ListView({ month, today, byDay, card, onNew }: { month: string; today: string; byDay: Map<string, CalPost[]>; card: (p: CalPost) => React.ReactNode; onNew: (d: string) => void }) {
  const days = [...byDay.keys()].filter((k) => k.startsWith(month)).sort();
  const todayRef = useRef<HTMLDivElement>(null);
  const firstUpcoming = days.find((k) => k >= today);
  useEffect(() => {
    if (today.startsWith(month)) todayRef.current?.scrollIntoView({ block: "start" });
  }, [month, today]);
  if (!days.length) {
    return (
      <div className="mt-4 flex flex-col items-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">
        <CalendarDays className="size-6 text-slate-300" />
        Nothing here this month.
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-5">
      {days.map((k) => (
        <section key={k} className="scroll-mt-24 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-6">
          {k === firstUpcoming && (
            <div ref={todayRef} className="col-span-full -mt-1 mb-3 flex scroll-mt-24 items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink">
              <span className="h-px flex-1 bg-ink" /> {k === today ? "Today" : "Coming up"} <span className="h-px flex-1 bg-ink" />
            </div>
          )}
          <h2
            className={`sticky top-[calc(env(safe-area-inset-top)+3.75rem)] z-[2] -mx-1 mb-2 flex items-center justify-between gap-2 bg-[#eceef0]/95 px-1 py-1 font-display text-2xl uppercase leading-none backdrop-blur lg:top-24 lg:mx-0 lg:mb-0 lg:block lg:text-balance lg:bg-transparent lg:px-0 lg:pt-3 lg:backdrop-blur-none ${k < today ? "text-slate-400" : "text-ink"}`}
          >
            <span>
              {dayLabel(k)}
              {k === today && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 align-middle font-sans text-[10px] font-bold text-white">TODAY</span>}
            </span>
            {k >= today && (
              <button onClick={() => onNew(k)} aria-label={`New post on ${dayLabel(k)}`} className="inline-flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-ink lg:mt-2">
                <Plus className="size-4" />
              </button>
            )}
          </h2>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)] 2xl:grid-cols-2">
            {(byDay.get(k) ?? []).map((p) => (
              <li key={p.id}>{card(p)}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PostSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Post" onClick={(e) => e.stopPropagation()} className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-[#f6f7f8] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="mb-2 flex justify-end">
          <button onClick={onClose} aria-label="Close" className="inline-flex size-9 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  return (
    <p className={`mt-4 rounded-2xl px-4 py-3 text-sm ${tone === "warn" ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
      {children}
    </p>
  );
}
