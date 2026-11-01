"use client";

import { ArrowDown, ArrowUp, MessageCircle, Play, RotateCcw, Star, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteFile, moveFile, replyToComment, resetReview, setHero } from "@/app/admin/actions";
import type { RoomFile } from "@/lib/types";

const statusStyle = {
  approved: "bg-approve text-white",
  changes: "bg-decline text-white",
  pending: "bg-slate-100 text-slate-600",
} as const;

const statusLabel = { approved: "Approved", changes: "Changes", pending: "Pending" } as const;

export function AdminFileGrid({ roomId, files, heroId }: { roomId: string; files: RoomFile[]; heroId: string | null }) {
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  if (files.length === 0) {
    return <p className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">No files yet. Drop some above.</p>;
  }

  const btn =
    "inline-flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-ink disabled:opacity-30";

  return (
    <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${pending ? "opacity-70" : ""}`}>
      {files.map((f, i) => {
        const open = openId === f.id;
        return (
          <li key={f.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="relative aspect-[4/5] bg-ink">
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
            </div>
            <div className="flex items-center justify-between gap-1 px-2 py-1.5">
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
                  onClick={() => {
                    if (confirm(`Delete ${f.fileName}? This cannot be undone.`)) start(() => deleteFile(roomId, f.id));
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            {open && (
              <div className="space-y-2 border-t border-slate-100 p-3">
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
  );
}
