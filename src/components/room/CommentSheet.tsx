"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatTimecode } from "@/lib/format";
import type { RoomComment, RoomFile } from "@/lib/types";

type Props = {
  file: RoomFile | null;
  name: string;
  deliveredBy: string;
  /** Where the video was paused when the sheet opened; attached to the note by default. */
  timecode?: number | null;
  onClose: () => void;
  onSend: (body: string, timecode: number | null) => Promise<boolean>;
  /** Opens the video at this point. */
  onSeek?: (seconds: number) => void;
};

function Bubble({ c, onSeek }: { c: RoomComment; onSeek?: (seconds: number) => void }) {
  return (
    <div
      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        c.fromAgency ? "bg-room-accent/20 text-room-fg" : "ml-auto bg-white/8 text-room-fg"
      }`}
    >
      <p className="mb-0.5 font-typewriter text-[11px] text-room-muted">
        {c.author} · {timeAgo(c.createdAt)}
      </p>
      {c.timecode != null && (
        <button
          type="button"
          onClick={() => onSeek?.(c.timecode!)}
          disabled={!onSeek}
          className="mb-1 inline-flex items-center gap-1 rounded-full bg-room-accent px-2 py-0.5 font-typewriter text-[11px] font-bold text-room-accent-fg disabled:opacity-70"
        >
          <Clock className="size-3" /> {formatTimecode(c.timecode)}
        </button>
      )}
      <p className="whitespace-pre-wrap break-words">{c.body}</p>
    </div>
  );
}

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function CommentSheet({ file, name, deliveredBy, timecode, onClose, onSend, onSeek }: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  // Re-enabled for each new file or moment: only an explicit tap turns it off.
  const momentKey = `${file?.id}:${timecode}`;
  const [detached, setDetached] = useState<string | null>(null);
  const attachTime = detached !== momentKey;
  const setAttachTime = (fn: (v: boolean) => boolean) => setDetached(fn(attachTime) ? null : momentKey);
  const tc = file?.kind === "video" && timecode != null && attachTime ? timecode : null;
  const earlier = file?.versions.filter((v) => v.comments.length > 0) ?? [];
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [file?.comments.length, file?.id]);

  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file, onClose]);

  return (
    <AnimatePresence>
      {file && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-stretch sm:justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            role="dialog"
            aria-label={`Comments on ${file.fileName}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85dvh] w-full flex-col rounded-t-3xl border border-room-border bg-room-surface text-room-fg shadow-2xl sm:max-h-none sm:max-w-md sm:rounded-none sm:rounded-l-3xl"
          >
            <header className="flex items-center gap-3 border-b border-room-border p-4">
              {(file.thumbUrl ?? file.posterUrl) && (
                <img
                  src={(file.thumbUrl ?? file.posterUrl)!}
                  alt=""
                  className="size-12 rounded-xl object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-typewriter text-xs uppercase tracking-widest text-room-muted">
                  Comments
                </p>
                <p className="truncate text-sm font-semibold">{file.fileName}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close comments"
                className="flex size-9 items-center justify-center rounded-full border border-room-border hover:bg-white/5"
              >
                <X className="size-4" />
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {earlier.map((v) => (
                <div key={v.id} className="space-y-3 opacity-70">
                  <p className="text-center font-typewriter text-[11px] uppercase tracking-widest text-room-muted">
                    Notes on version {v.version}
                  </p>
                  {v.comments.map((c) => (
                    <Bubble key={c.id} c={c} />
                  ))}
                </div>
              ))}
              {earlier.length > 0 && (
                <p className="text-center font-typewriter text-[11px] uppercase tracking-widest text-room-muted">
                  Version {file.version} (latest)
                </p>
              )}
              {file.comments.length === 0 && (
                <p className="py-8 text-center text-sm text-room-muted">
                  No comments yet. Tell {deliveredBy} what you would like changed.
                  {file.kind === "video" && " Pause the video first to pin your note to that moment."}
                </p>
              )}
              {file.comments.map((c) => (
                <Bubble key={c.id} c={c} onSeek={onSeek} />
              ))}
            </div>

            {file.kind === "video" && timecode != null && (
              <div className="flex items-center gap-2 border-t border-room-border px-4 pt-3 text-xs text-room-muted">
                <button
                  type="button"
                  onClick={() => setAttachTime((v) => !v)}
                  aria-pressed={attachTime}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-typewriter font-bold ${
                    attachTime ? "bg-room-accent text-room-accent-fg" : "border border-room-border"
                  }`}
                >
                  <Clock className="size-3" /> {formatTimecode(timecode)}
                </button>
                {attachTime ? "Your note will point to this moment." : "Tap to pin your note to this moment."}
              </div>
            )}

            <form
              className="flex items-end gap-2 border-t border-room-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!body.trim() || sending) return;
                setSending(true);
                const ok = await onSend(body.trim(), tc);
                setSending(false);
                if (ok) setBody("");
              }}
            >
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder={name ? `Comment as ${name}` : "Write a comment"}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-room-border bg-black/30 px-4 py-2.5 text-base outline-none placeholder:text-room-muted focus:border-room-accent sm:text-sm"
              />
              <button
                type="submit"
                disabled={!body.trim() || sending}
                aria-label="Send comment"
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-room-accent text-room-accent-fg transition-opacity disabled:opacity-40"
              >
                <Send className="size-4" />
              </button>
            </form>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
