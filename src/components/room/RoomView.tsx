"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarClock, Check, CheckCheck, CreditCard, Download, Lock, Play, Send, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { addComment, approveRemaining, recordView, setReview, submitFeedback } from "@/app/r/[slug]/actions";
import { themeVars } from "@/config/themes";
import type { RoomFile, RoomStats } from "@/lib/types";
import { VerifiedDot } from "@/components/ui/VerifiedDot";
import { CommentSheet } from "./CommentSheet";
import { FileTile } from "./FileTile";
import { Lightbox } from "./Lightbox";
import { AuthModal } from "@/components/auth/AuthModal";
import { RoomBackdrop } from "./RoomBackdrop";
import { StatsLine } from "./StatsLine";
import { Watermark } from "./Watermark";

export type RoomViewProps = {
  room: {
    slug: string;
    title: string;
    clientName: string;
    deliveredBy: string;
    themePreset: string;
    accentColor: string | null;
    layout?: "grid" | "natural";
    watermark?: boolean;
    intro?: string | null;
    downloads?: "on" | "approved" | "off";
    paymentUrl?: string | null;
    paymentStatus?: "none" | "due" | "paid";
    feedbackSentAt?: string | null;
    /** Reviews or notes saved after the last "Send feedback". */
    unsentChanges?: boolean;
    /** Day the studio would like feedback by (YYYY-MM-DD). */
    reviewBy?: string | null;
  };
  files: RoomFile[];
  heroId: string | null;
  initialViews: number;
  brand: { name: string; mark: string; poweredByLabel: string };
  /** Admin preview: shows the room exactly as the client sees it, without tracking. */
  preview?: boolean;
  /** Set when a studio admin is looking: shows a way back to the admin. */
  adminRoomId?: string | null;
  /** Signed-in client (or a guest on a share link), or null when nobody is signed in. */
  viewer: { name: string; avatarUrl: string | null; guest?: boolean } | null;
  /** View-only share link: no approve, decline, or notes. */
  readOnly?: boolean;
  /** When set, the room is locked behind the create-account popup. */
  gate?: {
    supabaseUrl: string;
    supabaseKey: string;
    fileCount: number;
    teaserUrl: string | null;
    authError?: "1" | "confirmed" | null;
  };
};

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Room titles often start with the shoot date ("10/30/2026 · Foreign Fleet · Day 2").
 * The date moves into the small meta lines and the headline scales with its length,
 * so long titles never break in the middle of a word.
 */
function splitTitle(title: string) {
  const m = title.match(/^\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[·•|\-–—]\s*(.+)$/);
  return m ? { date: m[1], headline: m[2] } : { date: null, headline: title };
}

type StatusFilter = "all" | "pending" | "approved" | "changes";

const FILTERS: { key: Exclude<StatusFilter, "all">; label: string; dot: string }[] = [
  { key: "pending", label: "To review", dot: "bg-room-fg" },
  { key: "approved", label: "Approved", dot: "bg-approve" },
  { key: "changes", label: "Changes", dot: "bg-decline" },
];

/** "Fri, Nov 14" plus how far away that is, from a YYYY-MM-DD date. */
function reviewByLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 864e5);
  const date = due.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : days > 1 && days <= 6 ? `in ${days} days` : null;
  return { date, when, past: days < 0 };
}

function titleSize(headline: string) {
  const n = headline.length;
  if (n <= 16) return "text-[clamp(2.9rem,13vw,9.5rem)]";
  if (n <= 28) return "text-[clamp(2.6rem,11vw,6.5rem)] lg:text-[clamp(3rem,5.6vw,6.5rem)]";
  return "text-[clamp(2.4rem,10vw,5rem)] lg:text-[clamp(2.75rem,4.4vw,5rem)]";
}

export function RoomView({ room, files: initialFiles, heroId, initialViews, brand, preview, adminRoomId, viewer, readOnly, gate }: RoomViewProps) {
  const [files, setFiles] = useState(initialFiles);
  const [sheetFileId, setSheetFileId] = useState<string | null>(null);
  const [sheetTimecode, setSheetTimecode] = useState<number | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeSet, setActiveSet] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [confirmRest, setConfirmRest] = useState(false);
  const [approvingRest, setApprovingRest] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(room.feedbackSentAt ?? null);
  /** Reviews or notes since the last "Send feedback". */
  const [changedSinceSend, setChangedSinceSend] = useState(room.unsentChanges ? 1 : 0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (preview || !viewer) return;
    const key = `kp:viewed:${room.slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    recordView(room.slug).catch(() => {});
  }, [room.slug, preview, viewer]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const stats: RoomStats = useMemo(() => {
    const s: RoomStats = { views: initialViews, comments: 0, approved: 0, changes: 0, pending: 0 };
    for (const f of files) {
      s.comments += f.comments.length;
      if (f.status === "approved") s.approved++;
      else if (f.status === "changes") s.changes++;
      else s.pending++;
    }
    return s;
  }, [files, initialViews]);

  const hero = files.find((f) => f.id === heroId) ?? files.find((f) => f.kind === "image") ?? files[0];
  const sheetFile = files.find((f) => f.id === sheetFileId) ?? null;
  const watermark = room.watermark ? brand.name : null;
  const natural = room.layout === "natural";

  // Sets: tabs appear once files are sorted into two or more groups.
  const sets = useMemo(() => {
    const names: string[] = [];
    for (const f of files) if (f.category && !names.includes(f.category)) names.push(f.category);
    const hasLoose = files.some((f) => !f.category);
    return names.length >= 2 || (names.length === 1 && hasLoose) ? names : [];
  }, [files]);
  const inSet = activeSet && sets.includes(activeSet) ? files.filter((f) => f.category === activeSet) : files;
  const visible = statusFilter === "all" ? inSet : inSet.filter((f) => f.status === statusFilter);
  const pendingInSet = inSet.filter((f) => f.status === "pending");
  // A review can drop the open file out of a status filter ("To review"): the next
  // file slides into its place, and after the last one the viewer closes.
  const openIndex = lightboxIndex !== null && lightboxIndex < visible.length ? lightboxIndex : null;

  const paymentDue = room.paymentStatus === "due";
  const downloadable = files.filter((f) => f.canDownload).length;
  const reviewed = stats.approved + stats.changes;
  const canSubmit = !!viewer && !preview && !readOnly && files.length > 0;
  const showFeedbackBar = canSubmit && (changedSinceSend > 0 || (!sentAt && reviewed > 0));
  const due = room.reviewBy && files.length > 0 ? reviewByLabel(room.reviewBy) : null;
  const allReviewed = files.length > 0 && stats.pending === 0;

  /** Approves every file in view that nobody has reviewed yet. */
  async function approveRest() {
    if (approvingRest) return;
    const ids = pendingInSet.map((f) => f.id);
    if (ids.length === 0) return;
    setApprovingRest(true);
    const res = await approveRemaining({ slug: room.slug, fileIds: ids }).catch(() => ({
      ok: false as const,
      error: "Connection lost. Please try again.",
    }));
    setApprovingRest(false);
    setConfirmRest(false);
    if (!res.ok) {
      setToast(res.error);
      return;
    }
    const done = new Set(res.data?.approved ?? []);
    setFiles((prev) =>
      prev.map((f) =>
        done.has(f.id) ? { ...f, status: "approved", reviewedBy: viewer?.name ?? null, canDownload: downloadableAs("approved") } : f,
      ),
    );
    if (done.size > 0) {
      setChangedSinceSend((n) => n + done.size);
      setToast(`Approved ${done.size} ${done.size === 1 ? "file" : "files"}.`);
    }
  }

  async function sendFeedback() {
    if (sending) return;
    setSending(true);
    const res = await submitFeedback(room.slug).catch(() => ({ ok: false as const, error: "Connection lost. Please try again." }));
    setSending(false);
    if (!res.ok) {
      setToast(res.error);
      return;
    }
    setSentAt(res.data?.sentAt ?? new Date().toISOString());
    setChangedSinceSend(0);
    setToast(`Sent. ${room.deliveredBy} has your feedback.`);
  }

  function patchFile(id: string, patch: Partial<RoomFile>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  /** Mirrors canDownload() on the server, so the lock updates as the client reviews. */
  function downloadableAs(status: RoomFile["status"]) {
    if (room.paymentStatus === "due" || room.downloads === "off") return false;
    return room.downloads === "approved" ? status === "approved" : true;
  }

  async function review(file: RoomFile, status: "approved" | "changes") {
    const next = file.status === status ? "pending" : status;
    const before = { status: file.status, reviewedBy: file.reviewedBy, canDownload: file.canDownload };
    patchFile(file.id, {
      status: next,
      reviewedBy: next === "pending" ? null : viewer?.name ?? null,
      canDownload: downloadableAs(next),
    });
    const res = await setReview({ slug: room.slug, fileId: file.id, status: next }).catch(() => ({
      ok: false as const,
      error: "Connection lost. Please try again.",
    }));
    if (!res.ok) {
      patchFile(file.id, before);
      setToast(res.error);
    } else {
      setChangedSinceSend((n) => n + 1);
    }
  }

  function openComments(file: RoomFile, timecode: number | null = null) {
    setSheetTimecode(timecode);
    setSheetFileId(file.id);
  }

  /** Opens a file in the viewer, optionally at a point in its video. */
  function openFile(file: RoomFile, at: number | null = null) {
    setStartAt(at);
    const i = visible.findIndex((f) => f.id === file.id);
    if (i >= 0) setLightboxIndex(i);
    else {
      setActiveSet(null);
      setStatusFilter("all");
      setLightboxIndex(files.findIndex((f) => f.id === file.id));
    }
  }

  async function sendComment(body: string, timecode: number | null): Promise<boolean> {
    if (!sheetFile) return false;
    const res = await addComment({ slug: room.slug, fileId: sheetFile.id, body, timecode }).catch(() => ({ ok: false as const, error: "Connection lost. Please try again." }));
    if (!res.ok || !res.data) {
      setToast(res.ok ? "Could not post." : res.error);
      return false;
    }
    const { id, createdAt, author, fromAgency } = res.data;
    patchFile(sheetFile.id, {
      comments: [...sheetFile.comments, { id, author, body, fromAgency, createdAt, timecode: res.data.timecode ?? null }],
    });
    if (!preview) setChangedSinceSend((n) => n + 1);
    return true;
  }

  const heroImage = hero ? hero.previewUrl ?? hero.posterUrl ?? hero.thumbUrl : null;
  const { date, headline } = splitTitle(room.title);

  return (
    <div
      className="room-root relative min-h-dvh overflow-x-hidden text-room-fg"
      style={themeVars(room.themePreset, room.accentColor)}
    >
      <RoomBackdrop />

      <header className="mx-auto flex max-w-7xl 2xl:max-w-[1600px] items-center justify-between gap-4 px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8 sm:pt-[calc(1.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3" aria-label={brand.name}>
          {adminRoomId && (
            <a
              href={`/admin/rooms/${adminRoomId}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-room-border bg-white/10 py-1.5 pl-2.5 pr-3.5 text-xs font-semibold backdrop-blur-md hover:bg-white/15"
            >
              <ArrowLeft className="size-4" /> Admin
            </a>
          )}
          <img src={brand.mark} alt="" className="h-8 w-auto sm:h-9" />
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.28em] sm:inline">
            {brand.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-room-border bg-white/5 px-3 py-1.5 font-typewriter text-[11px] text-room-muted backdrop-blur-md sm:inline-flex">
            <span className="size-1.5 rounded-full bg-room-accent" />
            Powered by <span className="text-room-fg">{brand.poweredByLabel}</span>
          </span>
          {viewer?.guest && (
            <span
              title={readOnly ? "Opened with a view-only link" : "Opened with a share link. No account needed."}
              className="inline-flex max-w-[11rem] items-center gap-2 rounded-full border border-room-border bg-white/5 py-1 pl-1 pr-3 text-xs font-semibold backdrop-blur-md sm:max-w-none"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-room-accent text-room-accent-fg">
                <UserRound className="size-3.5" />
              </span>
              <span className="truncate">{readOnly ? "View only" : viewer.name === "Guest" ? "Guest" : viewer.name}</span>
            </span>
          )}
          {viewer && !viewer.guest && (
            <a
              href="/account"
              title="My rooms"
              className="inline-flex items-center gap-2 rounded-full border border-room-border bg-white/5 py-1 pl-1 pr-3 text-xs font-semibold backdrop-blur-md hover:bg-white/10"
            >
              {viewer.avatarUrl ? (
                <img src={viewer.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-6 rounded-full" />
              ) : (
                <span className="flex size-6 items-center justify-center rounded-full bg-room-accent text-room-accent-fg">
                  <UserRound className="size-3.5" />
                </span>
              )}
              My rooms
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl 2xl:max-w-[1600px] px-5 pb-24 sm:px-8">
        <section className="grid gap-8 pt-8 sm:gap-10 sm:pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end lg:gap-14 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
            className="min-w-0"
          >
            <div className="space-y-1.5 font-typewriter text-sm text-room-muted">
              {date && (
                <p>
                  Shot on <span className="font-bold text-room-fg">{date}</span>
                </p>
              )}
              <p>
                Prepared for <span className="font-bold uppercase text-room-fg">{room.clientName}</span>
              </p>
              <p className="flex items-center gap-2">
                Delivered by <span className="font-bold text-room-fg">{room.deliveredBy}</span>
                <VerifiedDot />
              </p>
            </div>

            <h1
              className={`mt-6 text-balance break-words font-display uppercase leading-[0.9] tracking-[-0.01em] ${titleSize(headline)}`}
            >
              {headline}
            </h1>

            {room.intro && (
              <p className="mt-5 max-w-xl whitespace-pre-wrap text-[15px] leading-relaxed text-room-muted">{room.intro}</p>
            )}

            {due && (
              <p
                className={`mt-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-typewriter text-xs ${
                  allReviewed ? "border-room-border text-room-muted" : "border-room-accent/50 text-room-fg"
                }`}
                suppressHydrationWarning
              >
                <CalendarClock className="size-3.5 shrink-0" />
                {allReviewed ? (
                  <>All reviewed. Thank you!</>
                ) : due.past ? (
                  <>Feedback was due {due.date}</>
                ) : (
                  <>
                    Please review by <span className="font-bold">{due.date}</span>
                    {due.when && <span className="text-room-muted">({due.when})</span>}
                  </>
                )}
              </p>
            )}

            {files.length > 0 && paymentDue ? (
              <div className="mt-7 sm:mt-8">
                {room.paymentUrl ? (
                  <a
                    href={room.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2.5 rounded-full bg-room-accent px-6 py-4 text-sm font-bold text-room-accent-fg shadow-[0_10px_40px_-10px_var(--room-accent)] transition-transform hover:-translate-y-0.5 sm:inline-flex sm:w-auto sm:py-3.5"
                  >
                    <CreditCard className="size-4" />
                    Pay invoice
                  </a>
                ) : null}
                <p className="mt-3 flex items-center gap-2 font-typewriter text-xs text-room-muted">
                  <Lock className="size-3.5" /> Downloads open once the invoice is paid.
                </p>
              </div>
            ) : downloadable > 0 ? (
              <a
                href={`/r/${room.slug}/download-all`}
                className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-full bg-room-accent px-6 py-4 sm:mt-8 sm:inline-flex sm:w-auto sm:py-3.5 text-sm font-bold text-room-accent-fg shadow-[0_10px_40px_-10px_var(--room-accent)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Download className="size-4" />
                {downloadable === files.length
                  ? `Download all ${files.length} ${files.length === 1 ? "file" : "files"}`
                  : `Download ${downloadable} approved ${downloadable === 1 ? "file" : "files"}`}
              </a>
            ) : files.length > 0 && room.downloads !== "on" ? (
              <p className="mt-7 flex items-center gap-2 font-typewriter text-xs text-room-muted sm:mt-8">
                <Lock className="size-3.5" />
                {room.downloads === "approved" ? "Approve a file to download it." : "Downloads open once the studio releases the final files."}
              </p>
            ) : null}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.15, ease }}
            className="min-w-0"
          >
            {heroImage ? (
              <button
                type="button"
                onClick={() => hero && openFile(hero)}
                onContextMenu={watermark ? (e) => e.preventDefault() : undefined}
                className="group relative block aspect-[4/3] w-full overflow-hidden rounded-[28px] border border-room-border bg-room-surface shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]"
                aria-label={`Open ${hero!.fileName}`}
              >
                <img
                  src={heroImage}
                  alt={hero!.fileName}
                  fetchPriority="high"
                  className="absolute inset-0 size-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
                />
                {watermark && <Watermark label={watermark} />}
                <span className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/10" />
                {hero!.kind === "video" && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex size-16 items-center justify-center rounded-full bg-room-accent text-room-accent-fg shadow-[0_0_40px_var(--room-accent)]">
                      <Play className="ml-1 size-7 fill-current" />
                    </span>
                  </span>
                )}
              </button>
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[28px] border border-dashed border-room-border font-typewriter text-sm text-room-muted">
                Your files are on the way.
              </div>
            )}
            <div className="mt-5">
              <StatsLine stats={stats} />
            </div>
          </motion.div>
        </section>

        <section className="mt-14 sm:mt-28" aria-labelledby="deliverables">
          <div className="mb-6 flex items-end justify-between gap-4 border-b border-room-border pb-4">
            <h2 id="deliverables" className="font-display text-3xl uppercase tracking-wide sm:text-4xl">
              Deliverables
            </h2>
            <p className="font-typewriter text-xs text-room-muted">
              {sentAt && changedSinceSend === 0 ? (
                <span className="inline-flex items-center gap-1 text-approve">
                  <Check className="size-3.5" /> Feedback sent
                </span>
              ) : (
                <>
                  {files.length} {files.length === 1 ? "file" : "files"}
                  {!readOnly && (
                    <>
                      <span className="hidden sm:inline pointer-fine:hidden"> · tap ✓ to approve</span>
                      <span className="hidden sm:pointer-fine:inline"> · click ✓ to approve</span>
                    </>
                  )}
                </>
              )}
            </p>
          </div>

          {sets.length > 0 && (
            <div className="-mx-5 mb-6 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Sets">
              {[null, ...sets].map((name) => {
                const active = (activeSet ?? null) === name;
                const count = name ? files.filter((f) => f.category === name).length : files.length;
                return (
                  <button
                    key={name ?? "all"}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setActiveSet(name);
                      setConfirmRest(false);
                      setLightboxIndex(null);
                    }}
                    className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-room-accent bg-room-accent text-room-accent-fg"
                        : "border-room-border bg-white/5 text-room-fg hover:bg-white/10"
                    }`}
                  >
                    {name ?? "All"} <span className="font-typewriter text-xs opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {files.length > 1 && (
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="-mx-5 flex items-center gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:px-0" role="group" aria-label="Show only">
                <span className="shrink-0 pr-1 font-typewriter text-xs text-room-muted">Show</span>
                {FILTERS.map((f) => {
                  const count = inSet.filter((x) => x.status === f.key).length;
                  if (count === 0 && statusFilter !== f.key) return null;
                  const active = statusFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setLightboxIndex(null);
                        setStatusFilter(active ? "all" : f.key);
                      }}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-typewriter text-xs transition-colors ${
                        active
                          ? "border border-room-fg/40 bg-white/15 text-room-fg"
                          : "border border-transparent text-room-muted hover:bg-white/5 hover:text-room-fg"
                      }`}
                    >
                      <span aria-hidden className={`size-1.5 rounded-full ${f.dot}`} />
                      {f.label} <span className="tabular-nums opacity-70">{count}</span>
                      {active && <X aria-hidden className="size-3 opacity-70" />}
                    </button>
                  );
                })}
              </div>

              {canSubmit && pendingInSet.length > 1 && (
                <div className="flex items-center gap-2 sm:shrink-0">
                  {confirmRest ? (
                    <>
                      <span className="min-w-0 flex-1 font-typewriter text-xs text-room-muted sm:flex-none">
                        Approve {pendingInSet.length} files?
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirmRest(false)}
                        className="rounded-full px-3 py-2 text-sm font-semibold text-room-muted hover:text-room-fg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={approveRest}
                        disabled={approvingRest}
                        className="inline-flex items-center gap-2 rounded-full bg-approve px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                      >
                        <Check className="size-4" />
                        {approvingRest ? "Approving…" : "Yes, approve"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRest(true)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-room-border bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 sm:w-auto"
                    >
                      <CheckCheck className="size-4 text-approve" />
                      Approve the rest{activeSet && sets.includes(activeSet) ? ` of ${activeSet}` : ""}
                      <span className="font-typewriter text-xs text-room-muted">{pendingInSet.length}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {files.length === 0 ? (
            <p className="py-16 text-center font-typewriter text-sm text-room-muted">
              Nothing here yet. We will let you know when your files are ready.
            </p>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center font-typewriter text-sm text-room-muted">
              <p>{statusFilter === "pending" ? "You have reviewed everything here." : "Nothing here."}</p>
              <button type="button" onClick={() => { setLightboxIndex(null); setStatusFilter("all"); }} className="mt-3 text-room-fg underline underline-offset-4">
                Show all files
              </button>
            </div>
          ) : (
            <ul
              className={
                natural
                  ? "columns-2 gap-3 sm:gap-4 md:columns-3 lg:columns-4 lg:gap-5 2xl:columns-5"
                  : "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5 2xl:grid-cols-5"
              }
            >
              {visible.map((file, i) => (
                <FileTile
                  key={file.id}
                  file={file}
                  index={i}
                  natural={natural}
                  watermark={watermark}
                  onOpen={() => openFile(file)}
                  onReview={(status) => review(file, status)}
                  onComment={() => openComments(file)}
                  readOnly={readOnly}
                />
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-7xl 2xl:max-w-[1600px] px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))] font-typewriter text-xs text-room-muted sm:px-8">
        Delivered with care by {room.deliveredBy}.
      </footer>

      <Lightbox
        files={visible}
        index={openIndex}
        slug={room.slug}
        onIndex={(i) => {
          setStartAt(null);
          setLightboxIndex(i);
        }}
        onReview={readOnly ? undefined : review}
        onComment={readOnly ? undefined : openComments}
        startAt={startAt}
        watermark={watermark}
        alwaysDownload={!!adminRoomId}
        paused={!!sheetFile}
      />

      <CommentSheet
        file={sheetFile}
        name={viewer?.name ?? room.deliveredBy}
        deliveredBy={room.deliveredBy}
        timecode={sheetTimecode}
        onClose={() => setSheetFileId(null)}
        onSend={sendComment}
        onSeek={(t) => {
          if (!sheetFile) return;
          setSheetFileId(null);
          openFile(sheetFile, t);
        }}
      />

      <AnimatePresence>
        {showFeedbackBar && openIndex === null && !sheetFile && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl items-center gap-3 rounded-full border border-room-border bg-room-surface/95 py-2 pl-5 pr-2 shadow-2xl backdrop-blur-xl"
          >
            <p className="min-w-0 flex-1 truncate font-typewriter text-xs text-room-muted">
              <span className="sm:hidden">
                <span className="font-bold text-room-fg">{reviewed}</span> of {files.length} reviewed
              </span>
              <span className="hidden sm:inline">
                <span className="font-bold text-approve">{stats.approved}</span> approved ·{" "}
                <span className="font-bold text-decline">{stats.changes}</span> changes ·{" "}
                <span className="font-bold text-room-fg">{stats.pending}</span> left
              </span>
            </p>
            <button
              type="button"
              onClick={sendFeedback}
              disabled={sending}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-room-accent px-4 py-2.5 text-sm font-bold text-room-accent-fg disabled:opacity-50"
            >
              <Send className="size-4" />
              {sending ? "Sending…" : sentAt ? "Send update" : "Send feedback"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {gate && (
        <>
          {gate.teaserUrl && (
            <img
              src={gate.teaserUrl}
              alt=""
              aria-hidden
              className="pointer-events-none fixed inset-0 -z-[5] size-full scale-110 object-cover opacity-25 blur-2xl"
            />
          )}
          <AuthModal
            supabaseUrl={gate.supabaseUrl}
            supabaseKey={gate.supabaseKey}
            next={`/r/${room.slug}`}
            brandMark={brand.mark}
            heading="Create your account"
            subheading={`${room.deliveredBy} has ${gate.fileCount} ${gate.fileCount === 1 ? "file" : "files"} ready for ${room.clientName}. Create your free account to view, approve, and download them. One account opens all your rooms.`}
            initialError={gate.authError}
          />
        </>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            // Sits above the "Send feedback" bar while it is showing, so neither hides the other.
            className={`fixed inset-x-0 z-[60] mx-auto w-fit max-w-[90vw] rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-black shadow-xl ${
              showFeedbackBar && openIndex === null && !sheetFile
                ? "bottom-[calc(5.25rem+env(safe-area-inset-bottom))]"
                : "bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
            }`}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
