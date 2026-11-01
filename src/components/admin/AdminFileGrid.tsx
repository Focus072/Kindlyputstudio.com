"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, MessageCircle, MoreHorizontal, Play, RotateCcw, Star, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteFile, moveFile, replyToComment, resetReview, setHero } from "@/app/admin/actions";
import type { RoomFile } from "@/lib/types";
import { Lightbox } from "@/components/room/Lightbox";

const statusStyle = {
  approved: "bg-approve text-white",
  changes: "bg-decline text-white",
  pending: "bg-slate-100 text-slate-600",
} as const;

const statusLabel = { approved: "Approved", changes: "Changes", pending: "Pending" } as const;

export function AdminFileGrid({ roomId, slug, files, heroId }: { roomId: string; slug: string; files: RoomFile[]; heroId: string | null }) {
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const sheetIndex = files.findIndex((f) => f.id === sheetId);
  const sheetFile = sheetIndex >= 0 ? files[sheetIndex] : null;

  function remove(f: RoomFile) {
    if (confirm(`Delete ${f.fileName}? This cannot be undone.`)) {
      setSheetId(null);
      start(() => deleteFile(roomId, f.id));
    }
  }

  if (files.length === 0) {
    return <p className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">No files yet. Drop some above.</p>;
  }

  const btn =
    "inline-flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-ink disabled:opacity-30";

  return (
    <>
    <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${pending ? "opacity-70" : ""}`}>
      {files.map((f, i) => {
        const open = openId === f.id;
        return (
          <li key={f.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <button type="button" className="relative block aspect-[4/5] w-full cursor-zoom-in bg-ink" onClick={() => setViewIndex(i)} aria-label={`Open ${f.fileName}`}>
              {(f.thumbUrl ?? f.posterUrl) ? (
                <img src={(f.thumbUrl ?? f.posterUrl)!} alt={f.fileName} loading="lazy" className="absolute inset-0 size-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-white/60">{f.fileName}</span>
              )}
              {f.kind === "video" && (
                <span className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white">
                  <Play className="size-3.5 fill-current" />
                </span>
              )}
              {heroId === f.id && (
                <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">Hero</span>
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
                <button className={btn} title="Move later" disabled={i === files.length - 1} onClick={() => start(() => moveFile(roomId, f.id, 1))}>
                  <ArrowDown className="size-4" />
                </button>
                <button className={btn} title="Use as hero" disabled={heroId === f.id} onClick={() => start(() => setHero(roomId, f.id))}>
                  <Star className="size-4" />
                </button>
              </div>
              <div className="flex">
                <button className={`${btn} relative`} title="Comments" onClick={() => setOpenId(open ? null : f.id)}>
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
                {f.comments.length === 0 && <p className="text-xs text-slate-400">No comments yet.</p>}
                {f.comments.map((c) => (
                  <div key={c.id} className={`rounded-xl px-3 py-2 text-xs ${c.fromAgency ? "bg-brand/10" : "bg-slate-50"}`}>
                    <p className="font-semibold text-slate-700">{c.author}</p>
                    <p className="whitespace-pre-wrap text-slate-600">{c.body}</p>
                  </div>
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

    <Lightbox files={files} index={viewIndex} slug={slug} onIndex={setViewIndex} />

    <AnimatePresence>
      {sheetFile && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm sm:hidden"
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
            className="max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] bg-white pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <div className="sticky top-0 flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
              <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-ink">
                {(sheetFile.thumbUrl ?? sheetFile.posterUrl) && (
                  <img src={(sheetFile.thumbUrl ?? sheetFile.posterUrl)!} alt="" className="size-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{sheetFile.fileName}</p>
                <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${statusStyle[sheetFile.status]}`}>
                  {statusLabel[sheetFile.status]}
                  {sheetFile.reviewedBy ? ` · ${sheetFile.reviewedBy}` : ""}
                </span>
              </div>
              <button className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-label="Close" onClick={() => setSheetId(null)}>
                <X className="size-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 p-4">
              {[
                { label: "Move up", icon: ArrowUp, disabled: sheetIndex === 0, run: () => moveFile(roomId, sheetFile.id, -1) },
                { label: "Move down", icon: ArrowDown, disabled: sheetIndex === files.length - 1, run: () => moveFile(roomId, sheetFile.id, 1) },
                { label: heroId === sheetFile.id ? "Hero photo" : "Make hero", icon: Star, disabled: heroId === sheetFile.id, run: () => setHero(roomId, sheetFile.id) },
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
            </div>

            <div className="px-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Comments ({sheetFile.comments.length})</p>
              <div className="space-y-2">
                {sheetFile.comments.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
                {sheetFile.comments.map((c) => (
                  <div key={c.id} className={`rounded-2xl px-3.5 py-2.5 text-sm ${c.fromAgency ? "bg-brand/10" : "bg-slate-50"}`}>
                    <p className="font-semibold text-slate-700">{c.author}</p>
                    <p className="whitespace-pre-wrap text-slate-600">{c.body}</p>
                  </div>
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
