"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Play } from "lucide-react";
import { useRef, useState } from "react";
import type { RoomFile } from "@/lib/types";
import { ReviewButtons } from "./ReviewButtons";
import { Watermark } from "./Watermark";

type Props = {
  file: RoomFile;
  index: number;
  onOpen: () => void;
  onReview?: (status: "approved" | "changes") => void;
  onComment?: () => void;
  /** Keep the file's own shape instead of cropping to 4:5. */
  natural?: boolean;
  /** Studio name tiled over the preview. */
  watermark?: string | null;
};

/** Width / height, kept between a tall reel (9:16) and a wide banner (21:9). */
function ratio(file: RoomFile) {
  if (!file.width || !file.height) return 4 / 5;
  return Math.min(21 / 9, Math.max(9 / 16, file.width / file.height));
}

export function FileTile({ file, index, onOpen, onReview, onComment, natural, watermark }: Props) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = file.kind === "video";
  const cover = file.thumbUrl ?? file.posterUrl;

  function handleClick() {
    // Phones open videos in the full screen viewer, where the client can still
    // approve, decline, and pin a note to the moment. A 2-column tile is too small to watch.
    const phone = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
    if (isVideo && file.videoUrl && !phone) {
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
      className={`group relative ${natural ? "mb-3 break-inside-avoid sm:mb-4 lg:mb-5" : ""}`}
    >
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className={`relative cursor-pointer overflow-hidden rounded-2xl border border-room-border bg-room-surface shadow-[0_20px_40px_-24px_rgba(0,0,0,0.8)] ${
          natural ? "" : "aspect-[4/5]"
        }`}
        style={natural ? { aspectRatio: String(ratio(file)) } : undefined}
        onClick={handleClick}
        onContextMenu={watermark ? (e) => e.preventDefault() : undefined}
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
            alt={file.caption ?? file.fileName}
            draggable={!watermark}
            loading={index < 8 ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center font-typewriter text-xs text-room-muted">
            {file.fileName}
          </div>
        )}

        {watermark && !(isVideo && playing) && <Watermark label={watermark} />}

        {file.versions.length > 0 && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 font-typewriter text-[11px] font-bold text-white backdrop-blur-md">
            v{file.version}
          </span>
        )}

        {isVideo && !playing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-room-accent text-room-accent-fg shadow-[0_0_30px_var(--room-accent)] transition-transform duration-300 group-hover:scale-110">
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
        {onReview && onComment && !(isVideo && playing) && (
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
      {file.caption && (
        <p className="mt-2 line-clamp-2 px-1 text-xs leading-relaxed text-room-muted">{file.caption}</p>
      )}
    </motion.li>
  );
}
