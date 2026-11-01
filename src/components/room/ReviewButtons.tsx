"use client";

import { motion } from "framer-motion";
import { Check, MessageCircle, X } from "lucide-react";
import type { ReviewStatus } from "@/lib/types";

type Props = {
  status: ReviewStatus;
  commentCount: number;
  onDecline: () => void;
  onApprove: () => void;
  onComment: () => void;
  size?: "sm" | "lg";
};

export function ReviewButtons({
  status,
  commentCount,
  onDecline,
  onApprove,
  onComment,
  size = "sm",
}: Props) {
  const dim = size === "lg" ? "size-12" : "size-9";
  const icon = size === "lg" ? "size-5" : "size-4";
  const base = `relative inline-flex ${dim} items-center justify-center rounded-full border backdrop-blur-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`;
  const idle = "border-white/15 bg-black/40 text-white hover:bg-black/60";

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        onClick={onDecline}
        aria-pressed={status === "changes"}
        aria-label={status === "changes" ? "Undo request changes" : "Request changes"}
        title="Request changes"
        className={`${base} ${
          status === "changes" ? "border-decline bg-decline text-white" : idle
        }`}
      >
        <X className={icon} strokeWidth={2.5} />
      </motion.button>

      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        onClick={onApprove}
        aria-pressed={status === "approved"}
        aria-label={status === "approved" ? "Undo approve" : "Approve"}
        title="Approve"
        className={`${base} ${
          status === "approved" ? "border-approve bg-approve text-white" : idle
        }`}
        animate={
          status === "approved"
            ? { scale: [1, 1.25, 1], boxShadow: ["0 0 0 0 rgba(34,197,94,0.6)", "0 0 0 10px rgba(34,197,94,0)", "0 0 0 0 rgba(34,197,94,0)"] }
            : { scale: 1 }
        }
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <Check className={icon} strokeWidth={3} />
      </motion.button>

      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        onClick={onComment}
        aria-label={`Comments (${commentCount})`}
        title="Comment"
        className={`${base} ${idle}`}
      >
        <MessageCircle className={icon} strokeWidth={2.25} />
        {commentCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-room-accent px-1 text-[10px] font-bold leading-4 text-room-accent-fg">
            {commentCount}
          </span>
        )}
      </motion.button>
    </div>
  );
}
