"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, Lock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RoomFile } from "@/lib/types";
import { ReviewButtons } from "./ReviewButtons";
import { Watermark } from "./Watermark";

type Props = {
  files: RoomFile[];
  index: number | null;
  slug: string;
  onIndex: (i: number | null) => void;
  /** Leave both out for a read-only viewer (the studio admin). */
  onReview?: (file: RoomFile, status: "approved" | "changes") => void;
  /** Called with the video's current time when the file is a video. */
  onComment?: (file: RoomFile, timecode: number | null) => void;
  /** Jump the video to this point when it opens (from a timestamped note). */
  startAt?: number | null;
  /** Studio name tiled over previews, when the room has watermarks on. */
  watermark?: string | null;
  /** Admins can always download. */
  alwaysDownload?: boolean;
};

const statusChip = {
  approved: "bg-approve text-white",
  changes: "bg-decline text-white",
  pending: "bg-white/10 text-white/80",
} as const;
const statusText = { approved: "Approved", changes: "Changes requested", pending: "Pending review" } as const;

export function Lightbox({ files, index, slug, onIndex, onReview, onComment, startAt, watermark, alwaysDownload }: Props) {
  const file = index === null ? null : files[index];
  const videoRef = useRef<HTMLVideoElement>(null);
  // null = the current version; otherwise an earlier version's id.
  const [picked, setPicked] = useState<{ fileId: string | null; versionId: string | null }>({ fileId: null, versionId: null });
  const versionId = picked.fileId === (file?.id ?? null) ? picked.versionId : null;
  const setVersionId = (id: string | null) => setPicked({ fileId: file?.id ?? null, versionId: id });

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

  // A timestamp tapped while this video is already open: jump there now.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || startAt == null || v.readyState < 1) return;
    v.currentTime = startAt;
    v.play().catch(() => {});
  }, [startAt]);

  const older = file && versionId ? file.versions.find((v) => v.id === versionId) ?? null : null;
  const media = file
    ? older
      ? { videoUrl: older.videoUrl, posterUrl: older.posterUrl, imageUrl: older.previewUrl ?? older.thumbUrl ?? older.posterUrl }
      : { videoUrl: file.videoUrl, posterUrl: file.posterUrl, imageUrl: file.previewUrl ?? file.thumbUrl ?? file.posterUrl }
    : null;
  const status = older ? older.status : file?.status ?? "pending";
  const canDownload = !!file && !older && (alwaysDownload || file.canDownload);

  function currentTime(): number | null {
    if (!file || file.kind !== "video" || older) return null;
    const t = videoRef.current?.currentTime;
    return typeof t === "number" && Number.isFinite(t) ? t : null;
  }

  return (
    <AnimatePresence>
      {file && media && index !== null && (
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
              {canDownload ? (
                <a
                  href={`/r/${slug}/download/${file.id}`}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 px-4 text-sm hover:bg-white/10"
                >
                  <Download className="size-4" />
                  <span className="hidden sm:inline">Download</span>
                </a>
              ) : (
                !older && (
                  <span
                    title="Download opens once the studio releases this file"
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 px-4 text-sm text-white/50"
                  >
                    <Lock className="size-4" />
                    <span className="hidden sm:inline">Download locked</span>
                  </span>
                )
              )}
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

          {file.versions.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 px-4 pb-2" role="tablist" aria-label="Versions">
              {[{ id: null as string | null, version: file.version, label: "Latest" }, ...file.versions.map((v) => ({ id: v.id as string | null, version: v.version, label: "" }))].map((v) => {
                const active = versionId === v.id;
                return (
                  <button
                    key={v.id ?? "current"}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setVersionId(v.id)}
                    className={`rounded-full px-3 py-1 font-typewriter text-xs ${
                      active ? "bg-white text-black" : "bg-white/10 text-white/70 hover:bg-white/15"
                    }`}
                  >
                    v{v.version}
                    {v.label ? ` · ${v.label}` : ""}
                  </button>
                );
              })}
            </div>
          )}

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${file.id}:${versionId ?? "current"}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex size-full items-center justify-center"
              >
                {file.kind === "video" && media.videoUrl ? (
                  <span className="relative inline-flex max-h-full max-w-full">
                    <video
                      ref={videoRef}
                      src={media.videoUrl}
                      poster={media.posterUrl ?? undefined}
                      controls
                      autoPlay
                      playsInline
                      controlsList={canDownload ? undefined : "nodownload"}
                      onLoadedMetadata={(e) => {
                        if (!older && startAt != null && startAt > 0) e.currentTarget.currentTime = startAt;
                      }}
                      className="max-h-[calc(100dvh-12rem)] max-w-full rounded-xl"
                    />
                  </span>
                ) : media.imageUrl ? (
                  <span className="relative inline-flex max-h-full max-w-full" onContextMenu={watermark ? (e) => e.preventDefault() : undefined}>
                    <img
                      src={media.imageUrl}
                      alt={file.caption ?? file.fileName}
                      draggable={!watermark}
                      className="max-h-[calc(100dvh-12rem)] max-w-full rounded-xl object-contain"
                    />
                    {watermark && <Watermark label={watermark} size="lg" />}
                  </span>
                ) : (
                  <p className="font-typewriter text-sm text-white/60">{file.fileName}</p>
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

          {file.caption && !older && (
            <p className="mx-auto max-w-2xl whitespace-pre-wrap px-6 pt-3 text-center text-sm text-white/80">{file.caption}</p>
          )}

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
            {older ? (
              <button
                type="button"
                onClick={() => setVersionId(null)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${statusChip[status]}`}
              >
                v{older.version} was {statusText[status].toLowerCase()} · Back to latest
              </button>
            ) : onReview && onComment ? (
              <ReviewButtons
                size="lg"
                status={file.status}
                commentCount={file.comments.length}
                onDecline={() => onReview(file, "changes")}
                onApprove={() => onReview(file, "approved")}
                onComment={() => onComment(file, currentTime())}
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
