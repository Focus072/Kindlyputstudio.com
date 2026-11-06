"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Clock,
  FolderInput,
  Layers,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Play,
  RotateCcw,
  Square,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  bulkFiles,
  deleteFile,
  moveFile,
  reorderFiles,
  replyToComment,
  resetReview,
  setHero,
  updateFileDetails,
} from "@/app/admin/actions";
import { formatTimecode } from "@/lib/format";
import { useVisibleViewport } from "@/lib/visible-viewport";
import type { RoomComment, RoomFile } from "@/lib/types";
import { uploadToRoom } from "@/lib/upload-client";
import { Lightbox } from "@/components/room/Lightbox";

const statusStyle = {
  approved: "bg-approve text-white",
  changes: "bg-decline text-white",
  pending: "bg-slate-100 text-slate-600",
} as const;

const statusLabel = { approved: "Approved", changes: "Changes", pending: "Pending" } as const;

function Note({ c }: { c: RoomComment }) {
  return (
    <div className={`rounded-xl px-3 py-2 text-xs ${c.fromAgency ? "bg-brand/10" : "bg-slate-50"}`}>
      <p className="font-semibold text-slate-700">
        {c.author}
        {c.timecode != null && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-ink px-1.5 py-px font-typewriter text-[10px] font-bold text-white">
            <Clock className="size-2.5" /> {formatTimecode(c.timecode)}
          </span>
        )}
      </p>
      <p className="whitespace-pre-wrap text-slate-600">{c.body}</p>
    </div>
  );
}

/** Caption and set for one file. */
function DetailsForm({ roomId, file, sets, onDone }: { roomId: string; file: RoomFile; sets: string[]; onDone?: () => void }) {
  const [caption, setCaption] = useState(file.caption ?? "");
  const [category, setCategory] = useState(file.category ?? "");
  const [saving, start] = useTransition();
  const dirty = caption !== (file.caption ?? "") || category !== (file.category ?? "");
  const listId = `sets-${file.id}`;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await updateFileDetails(roomId, file.id, { caption, category });
          onDone?.();
        });
      }}
      className="space-y-2"
    >
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        list={listId}
        maxLength={40}
        placeholder="Set (Reels, Stills, Day 1)"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus:border-brand sm:text-xs"
      />
      <datalist id={listId}>
        {sets.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Caption or post copy the client should approve"
        className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus:border-brand sm:text-xs"
      />
      {dirty && (
        <button disabled={saving} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          {saving ? "Saving…" : "Save details"}
        </button>
      )}
    </form>
  );
}

/** Picks a file and uploads it as the next version of this one. */
function NewVersionButton({ roomId, file, className, children }: { roomId: string; file: RoomFile; className: string; children: React.ReactNode }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={progress !== null}
        title="Upload a new version"
        onClick={() => input.current?.click()}
      >
        {progress !== null ? <Loader2 className="size-4 animate-spin" /> : children}
        {progress !== null && <span className="text-[10px] tabular-nums">{Math.round(progress * 100)}%</span>}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
      <input
        ref={input}
        type="file"
        accept={file.kind === "video" ? "video/*" : "image/*"}
        className="hidden"
        onChange={async (e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (!picked) return;
          setError(null);
          setProgress(0);
          try {
            await uploadToRoom(roomId, picked, { replaceOf: file.id, onProgress: setProgress });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
          } finally {
            setProgress(null);
          }
        }}
      />
    </>
  );
}

export function AdminFileGrid({ roomId, slug, files, heroId }: { roomId: string; slug: string; files: RoomFile[]; heroId: string | null }) {
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const sheetViewport = useVisibleViewport(sheetId !== null);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [order, setOrder] = useState(files);
  const [dragId, setDragId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Take the server's order whenever fresh files arrive.
  const [synced, setSynced] = useState(files);
  if (synced !== files) {
    setSynced(files);
    setOrder(files);
  }

  const sheetIndex = order.findIndex((f) => f.id === sheetId);
  const sheetFile = sheetIndex >= 0 ? order[sheetIndex] : null;
  const sets = [...new Set(files.map((f) => f.category).filter(Boolean) as string[])];

  function remove(f: RoomFile) {
    const extra = f.versions.length ? " Its earlier version will show again." : "";
    if (confirm(`Delete ${f.fileName}? This cannot be undone.${extra}`)) {
      setSheetId(null);
      start(() => deleteFile(roomId, f.id));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function endSelect() {
    setSelecting(false);
    setSelected(new Set());
  }

  function bulk(action: Parameters<typeof bulkFiles>[2]) {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (action.type === "delete" && !confirm(`Delete ${ids.length} ${ids.length === 1 ? "file" : "files"}? This cannot be undone.`)) return;
    start(async () => {
      await bulkFiles(roomId, ids, action);
      endSelect();
    });
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const next = [...order];
    const from = next.findIndex((f) => f.id === dragId);
    const to = next.findIndex((f) => f.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    setDragId(null);
    start(() => reorderFiles(roomId, next.map((f) => f.id)));
  }

  if (files.length === 0) {
    return <p className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">No files yet. Drop some above.</p>;
  }

  const btn =
    "inline-flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-ink disabled:opacity-30";

  return (
    <>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => (selecting ? endSelect() : setSelecting(true))}
        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-sm ring-1 ring-slate-200"
      >
        {selecting ? <X className="size-4" /> : <CheckSquare className="size-4" />}
        {selecting ? "Done" : "Select"}
      </button>
      {selecting && (
        <button
          type="button"
          onClick={() => setSelected(selected.size === order.length ? new Set() : new Set(order.map((f) => f.id)))}
          className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white"
        >
          {selected.size === order.length ? "Select none" : "Select all"}
        </button>
      )}
      {!selecting && <p className="hidden text-xs text-slate-500 sm:block">Drag tiles to reorder.</p>}
    </div>

    <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${pending ? "opacity-70" : ""}`}>
      {order.map((f, i) => {
        const open = openId === f.id;
        const isSelected = selected.has(f.id);
        return (
          <li
            key={f.id}
            draggable={!selecting}
            onDragStart={(e) => {
              setDragId(f.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (dragId) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              dropOn(f.id);
            }}
            onDragEnd={() => setDragId(null)}
            className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ${
              isSelected ? "ring-2 ring-brand" : dragId === f.id ? "opacity-40 ring-slate-200" : "ring-slate-200"
            }`}
          >
            <button
              type="button"
              className={`relative block aspect-[4/5] w-full bg-ink ${selecting ? "cursor-pointer" : "cursor-zoom-in"}`}
              onClick={() => (selecting ? toggle(f.id) : setViewIndex(i))}
              aria-label={selecting ? `Select ${f.fileName}` : `Open ${f.fileName}`}
              aria-pressed={selecting ? isSelected : undefined}
            >
              {(f.thumbUrl ?? f.posterUrl) ? (
                <img src={(f.thumbUrl ?? f.posterUrl)!} alt={f.fileName} loading="lazy" draggable={false} className="absolute inset-0 size-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-white/60">{f.fileName}</span>
              )}
              {selecting && (
                <span className={`absolute left-2 top-2 flex size-7 items-center justify-center rounded-lg ${isSelected ? "bg-brand text-white" : "bg-white/90 text-slate-500"}`}>
                  {isSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                </span>
              )}
              {!selecting && f.kind === "video" && (
                <span className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white">
                  <Play className="size-3.5 fill-current" />
                </span>
              )}
              <span className="absolute right-2 top-2 flex gap-1">
                {f.versions.length > 0 && (
                  <span className="rounded-full bg-white/90 px-2 py-0.5 font-typewriter text-[10px] font-bold text-ink">v{f.version}</span>
                )}
                {heroId === f.id && (
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">Hero</span>
                )}
              </span>
              {f.category && (
                <span className="absolute bottom-8 left-2 max-w-[85%] truncate rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {f.category}
                </span>
              )}
              <span className={`absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${statusStyle[f.status]}`}>
                {statusLabel[f.status]}
                {f.reviewedBy ? ` · ${f.reviewedBy}` : ""}
              </span>
            </button>
            {/* Phones: one tap opens a sheet with every action, labeled. */}
            <div className="flex items-center justify-between px-1.5 py-1 sm:hidden">
              <button className={`${btn} relative size-10`} aria-label="Comments" onClick={() => setSheetId(f.id)}>
                <MessageCircle className="size-[18px]" />
                {f.comments.length > 0 && (
                  <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-white">{f.comments.length}</span>
                )}
              </button>
              <button className={`${btn} size-10`} aria-label="More actions" onClick={() => setSheetId(f.id)}>
                <MoreHorizontal className="size-5" />
              </button>
            </div>
            <div className="hidden items-center justify-between gap-1 px-2 py-1.5 sm:flex">
              <div className="flex">
                <button className={btn} title="Move earlier" disabled={i === 0} onClick={() => start(() => moveFile(roomId, f.id, -1))}>
                  <ArrowUp className="size-4" />
                </button>
                <button className={btn} title="Move later" disabled={i === order.length - 1} onClick={() => start(() => moveFile(roomId, f.id, 1))}>
                  <ArrowDown className="size-4" />
                </button>
                <button className={btn} title="Use as hero" disabled={heroId === f.id} onClick={() => start(() => setHero(roomId, f.id))}>
                  <Star className="size-4" />
                </button>
                <NewVersionButton roomId={roomId} file={f} className={btn}>
                  <Layers className="size-4" />
                </NewVersionButton>
              </div>
              <div className="flex">
                <button className={`${btn} relative`} title="Details and comments" onClick={() => setOpenId(open ? null : f.id)}>
                  <MessageCircle className="size-4" />
                  {f.comments.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-white">{f.comments.length}</span>
                  )}
                </button>
                {f.status !== "pending" && (
                  <button className={btn} title="Reset to pending" onClick={() => start(() => resetReview(roomId, f.id))}>
                    <RotateCcw className="size-4" />
                  </button>
                )}
                <button
                  className={`${btn} hover:text-red-600`}
                  title="Delete file"
                  onClick={() => remove(f)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            {open && (
              <div className="hidden space-y-2 border-t sm:block border-slate-100 p-3">
                <DetailsForm roomId={roomId} file={f} sets={sets} />
                {f.versions.some((v) => v.comments.length) && (
                  <p className="text-[11px] text-slate-400">
                    Earlier versions have {f.versions.reduce((n, v) => n + v.comments.length, 0)} more notes (open the file to compare).
                  </p>
                )}
                {f.comments.length === 0 && <p className="text-xs text-slate-400">No comments yet.</p>}
                {f.comments.map((c) => (
                  <Note key={c.id} c={c} />
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const body = reply.trim();
                    if (!body) return;
                    setReply("");
                    start(() => replyToComment(roomId, f.id, body));
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply"
                    className="min-w-0 flex-1 rounded-full border border-slate-200 px-3 py-1.5 text-base outline-none focus:border-brand sm:text-xs"
                  />
                  <button className="rounded-full bg-ink px-3 text-xs font-bold text-white">Send</button>
                </form>
              </div>
            )}
          </li>
        );
      })}
    </ul>

    <AnimatePresence>
      {selecting && selected.size > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl flex-wrap items-center justify-center gap-2 rounded-3xl bg-ink p-2 text-white shadow-2xl sm:bottom-6"
        >
          <span className="px-2 text-sm font-semibold">{selected.size} selected</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const name = prompt(`Move to which set? (${sets.join(", ") || "for example Reels"}). Leave empty to remove from sets.`);
              if (name !== null) bulk({ type: "set", category: name });
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
          >
            <FolderInput className="size-4" /> Set
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => bulk({ type: "reset" })}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"
          >
            <RotateCcw className="size-4" /> Reset review
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => bulk({ type: "delete" })}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-2 text-sm font-semibold hover:bg-red-600"
          >
            <Trash2 className="size-4" /> Delete
          </button>
        </motion.div>
      )}
    </AnimatePresence>

    <Lightbox files={order} index={viewIndex} slug={slug} onIndex={setViewIndex} alwaysDownload />

    <AnimatePresence>
      {sheetFile && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm sm:hidden"
          style={sheetViewport}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSheetId(null)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={sheetFile.fileName}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88%] w-full overflow-y-auto rounded-t-[28px] bg-white pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
              <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-ink">
                {(sheetFile.thumbUrl ?? sheetFile.posterUrl) && (
                  <img src={(sheetFile.thumbUrl ?? sheetFile.posterUrl)!} alt="" className="size-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  {sheetFile.fileName}
                  {sheetFile.versions.length > 0 && <span className="ml-1 font-typewriter text-xs text-slate-400">v{sheetFile.version}</span>}
                </p>
                <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${statusStyle[sheetFile.status]}`}>
                  {statusLabel[sheetFile.status]}
                  {sheetFile.reviewedBy ? ` · ${sheetFile.reviewedBy}` : ""}
                </span>
              </div>
              <button className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-label="Close" onClick={() => setSheetId(null)}>
                <X className="size-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 p-4">
              {[
                { label: "Move up", icon: ArrowUp, disabled: sheetIndex === 0, run: () => moveFile(roomId, sheetFile.id, -1) },
                { label: "Move down", icon: ArrowDown, disabled: sheetIndex === order.length - 1, run: () => moveFile(roomId, sheetFile.id, 1) },
                { label: heroId === sheetFile.id ? "Hero" : "Make hero", icon: Star, disabled: heroId === sheetFile.id, run: () => setHero(roomId, sheetFile.id) },
              ].map((a) => (
                <button
                  key={a.label}
                  disabled={a.disabled || pending}
                  onClick={() => start(() => a.run())}
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-50 py-3.5 text-xs font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-40"
                >
                  <a.icon className="size-5" />
                  {a.label}
                </button>
              ))}
              <NewVersionButton
                roomId={roomId}
                file={sheetFile}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-50 py-3.5 text-xs font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-40"
              >
                <Layers className="size-5" />
                New version
              </NewVersionButton>
            </div>

            <div className="px-4 pb-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Details</p>
              <DetailsForm key={sheetFile.id} roomId={roomId} file={sheetFile} sets={sets} />
            </div>

            <div className="px-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Comments ({sheetFile.comments.length})</p>
              <div className="space-y-2">
                {sheetFile.comments.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
                {sheetFile.comments.map((c) => (
                  <Note key={c.id} c={c} />
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const body = reply.trim();
                  if (!body) return;
                  setReply("");
                  start(() => replyToComment(roomId, sheetFile.id, body));
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply to the client"
                  className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-base outline-none focus:border-brand"
                />
                <button className="rounded-full bg-ink px-4 text-sm font-bold text-white">Send</button>
              </form>
            </div>

            <div className="mt-5 flex gap-2 border-t border-slate-100 px-4 pt-4">
              {sheetFile.status !== "pending" && (
                <button
                  onClick={() => start(() => resetReview(roomId, sheetFile.id))}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-100 py-3 text-sm font-semibold text-slate-700"
                >
                  <RotateCcw className="size-4" /> Reset review
                </button>
              )}
              <button
                onClick={() => remove(sheetFile)}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-50 py-3 text-sm font-semibold text-red-600"
              >
                <Trash2 className="size-4" /> Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
