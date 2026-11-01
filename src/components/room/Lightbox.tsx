"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useEffect } from "react";
import type { RoomFile } from "@/lib/types";
import { ReviewButtons } from "./ReviewButtons";

type Props = {
  files: RoomFile[];
  index: number | null;
  slug: string;
  onIndex: (i: number | null) => void;
  /** Leave both out for a read-only viewer (the studio admin). */
  onReview?: (file: RoomFile, status: "approved" | "changes") => void;
  onComment?: (file: RoomFile) => void;
};

const statusChip = {
  approved: "bg-approve text-white",
  changes: "bg-decline text-white",
  pending: "bg-white/10 text-white/80",
} as const;
const statusText = { approved: "Approved", changes: "Changes requested", pending: "Pending review" } as const;

export function Lightbox({ files, index, slug, onIndex, onReview, onComment }: Props) {
  const file = index === null ? null : files[index];

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onIndex(null);
      if (e.key === "ArrowRight") onIndex((index + 1) % files.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + files.length) % files.length);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, files.length, onIndex]);

  return (
    <AnimatePresence>
      {file && index !== null && (
        <motion.div
          className="fixed inset-0 z-[35] flex flex-col bg-black/95 text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex items-center justify-between gap-3 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
            <p className="min-w-0 truncate font-typewriter text-xs text-white/70">
              {index + 1} / {files.length} · {file.fileName}
            </p>
            <div className="flex items-center gap-2">
              <a
                href={`/r/${slug}/download/${file.id}`}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 px-4 text-sm hover:bg-white/10"
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">Download</span>
              </a>
              <button
                type="button"
                onClick={() => onIndex(null)}
                aria-label="Close"
                className="flex size-9 items-center justify-center rounded-full border border-white/15 hover:bg-white/10"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
            <AnimatePresence mode="wait">
              <motion.div
                key={file.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex size-full items-center justify-center"
              >
                {file.kind === "video" && file.videoUrl ? (
                  <video
                    src={file.videoUrl}
                    poster={file.posterUrl ?? undefined}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-full max-w-full rounded-xl"
                  />
                ) : (
                  <img
                    src={(file.previewUrl ?? file.thumbUrl)!}
                    alt={file.fileName}
                    className="max-h-full max-w-full rounded-xl object-contain"
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {files.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={() => onIndex((index - 1 + files.length) % files.length)}
                  className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  onClick={() => onIndex((index + 1) % files.length)}
                  className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center justify-center gap-6 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {files.length > 1 && (
              <button
                type="button"
                aria-label="Previous"
                onClick={() => onIndex((index - 1 + files.length) % files.length)}
                className="flex size-11 items-center justify-center rounded-full bg-white/10 sm:hidden"
              >
                <ChevronLeft className="size-5" />
              </button>
            )}
            {onReview && onComment ? (
              <ReviewButtons
                size="lg"
                status={file.status}
                commentCount={file.comments.length}
                onDecline={() => onReview(file, "changes")}
                onApprove={() => onReview(file, "approved")}
                onComment={() => onComment(file)}
              />
            ) : (
              <span className={`rounded-full px-4 py-2 text-sm font-semibold ${statusChip[file.status]}`}>
                {statusText[file.status]}
                {file.reviewedBy && file.status !== "pending" ? ` · ${file.reviewedBy}` : ""}
                {file.comments.length > 0 ? ` · ${file.comments.length} ${file.comments.length === 1 ? "note" : "notes"}` : ""}
              </span>
            )}
            {files.length > 1 && (
              <button
                type="button"
                aria-label="Next"
                onClick={() => onIndex((index + 1) % files.length)}
                className="flex size-11 items-center justify-center rounded-full bg-white/10 sm:hidden"
              >
                <ChevronRight className="size-5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
