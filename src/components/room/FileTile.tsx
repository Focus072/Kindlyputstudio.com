"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Play } from "lucide-react";
import { useRef, useState } from "react";
import type { RoomFile } from "@/lib/types";
import { ReviewButtons } from "./ReviewButtons";

type Props = {
  file: RoomFile;
  index: number;
  onOpen: () => void;
  onReview: (status: "approved" | "changes") => void;
  onComment: () => void;
};

export function FileTile({ file, index, onOpen, onReview, onComment }: Props) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = file.kind === "video";
  const cover = file.thumbUrl ?? file.posterUrl;

  function handleClick() {
    if (isVideo && file.videoUrl) {
      setPlaying(true);
      requestAnimationFrame(() => videoRef.current?.play().catch(() => {}));
    } else {
      onOpen();
    }
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      // The first row fades in on load; the rest as they scroll into view.
      {...(index < 4
        ? { animate: { opacity: 1, y: 0 } }
        : { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.15 } })}
      transition={{ duration: 0.5, delay: Math.min(index % 8, 7) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
    >
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="relative aspect-[4/5] cursor-pointer overflow-hidden rounded-2xl border border-room-border bg-room-surface shadow-[0_20px_40px_-24px_rgba(0,0,0,0.8)]"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`${isVideo ? "Play" : "Open"} ${file.fileName}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {isVideo && playing && file.videoUrl ? (
          <video
            ref={videoRef}
            src={file.videoUrl}
            poster={file.posterUrl ?? undefined}
            className="absolute inset-0 size-full bg-black object-cover"
            controls
            playsInline
            preload="metadata"
            onClick={(e) => e.stopPropagation()}
            onEnded={() => setPlaying(false)}
          />
        ) : cover ? (
          <img
            src={cover}
            alt={file.fileName}
            loading={index < 8 ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center font-typewriter text-xs text-room-muted">
            {file.fileName}
          </div>
        )}

        {isVideo && !playing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-room-accent text-white shadow-[0_0_30px_var(--room-accent)] transition-transform duration-300 group-hover:scale-110">
              <Play className="ml-0.5 size-6 fill-current" />
            </span>
          </div>
        )}

        {/* Corner marker for the review state */}
        <AnimatePresence>
          {file.status !== "pending" && (
            <motion.span
              key={file.status}
              aria-hidden
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              style={{ transformOrigin: "top right" }}
              className={`absolute right-0 top-0 size-12 [clip-path:polygon(0_0,100%_0,100%_100%)] ${
                file.status === "approved" ? "bg-approve" : "bg-decline"
              }`}
            />
          )}
        </AnimatePresence>

        {!(isVideo && playing) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
        )}
        {!(isVideo && playing) && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center p-3">
            <ReviewButtons
              status={file.status}
              commentCount={file.comments.length}
              onDecline={() => onReview("changes")}
              onApprove={() => onReview("approved")}
              onComment={onComment}
            />
          </div>
        )}
      </motion.div>
    </motion.li>
  );
}
