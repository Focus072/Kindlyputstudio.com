"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, MessageCircle, RotateCcw, X } from "lucide-react";
import { useState } from "react";

type Verdict = "approved" | "changes" | null;

const FALLBACK = [
  "linear-gradient(160deg,#4f6671,#1d2b32)",
  "linear-gradient(160deg,#b6c3c8,#4f6671)",
  "linear-gradient(160deg,#cfd8d8,#1d2b32)",
];
const NOTES = ["Love this one!", "Can we brighten it a touch?", "Perfect for the menu board."];

/** A working mini delivery room on the home page, so visitors can feel the approve flow. */
export function TryRoom({ photos, client }: { photos: string[]; client: string }) {
  const items = photos.length >= 3 ? photos.slice(0, 3) : [];
  const count = items.length || FALLBACK.length;
  const [i, setI] = useState(0);
  const [verdicts, setVerdicts] = useState<Verdict[]>(() => Array(count).fill(null));
  const [noted, setNoted] = useState<boolean[]>(() => Array(count).fill(false));
  const v = verdicts[i];
  const done = verdicts.filter(Boolean).length;

  const decide = (next: Verdict) => {
    setVerdicts((all) => all.map((x, k) => (k === i ? (x === next ? null : next) : x)));
    if (next && v !== next && i < count - 1) setTimeout(() => setI((k) => Math.min(k + 1, count - 1)), 900);
  };
  const reset = () => {
    setVerdicts(Array(count).fill(null));
    setNoted(Array(count).fill(false));
    setI(0);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative rounded-[30px] bg-ink p-3 text-cloud shadow-[0_50px_100px_-40px_rgba(15,24,29,0.7)] ring-1 ring-white/10 sm:p-5">
        <div className="flex items-center justify-between px-1 pb-3 sm:pb-4">
          <p className="font-typewriter text-[11px] text-mist/60 sm:text-xs">
            Try it · <span className="text-mist">{client}</span>
          </p>
          <p className="font-typewriter text-[11px] text-mist/60 sm:text-xs" aria-live="polite">
            {done} of {count} reviewed
          </p>
        </div>

        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#0F181D] sm:aspect-[5/5]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={i}
              className="absolute inset-0"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {items.length ? (
                <img src={items[i]} alt="" className="size-full object-cover" />
              ) : (
                <div className="size-full" style={{ background: FALLBACK[i] }} />
              )}
            </motion.div>
          </AnimatePresence>
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 font-typewriter text-[10px] text-white/85 backdrop-blur sm:text-[11px]">
            IMG_04{12 + i}.jpg
          </span>

          {/* Stamp */}
          <AnimatePresence>
            {v && (
              <motion.span
                key={v}
                initial={{ opacity: 0, scale: 1.6, rotate: -14 }}
                animate={{ opacity: 1, scale: 1, rotate: -10 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
                className={`absolute left-1/2 top-1/2 rounded-xl border-[3px] px-4 py-1.5 font-display text-4xl uppercase tracking-wide backdrop-blur-[2px] sm:text-5xl ${
                  v === "approved" ? "border-approve text-approve" : "border-decline text-decline"
                }`}
                style={{ x: "-50%", y: "-50%" }}
              >
                {v === "approved" ? "Approved" : "Changes"}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Note bubble */}
          <AnimatePresence>
            {noted[i] && (
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-3 bottom-3 flex items-start gap-2 rounded-2xl bg-white/95 p-3 text-sm text-ink shadow-lg"
              >
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-slate-brand" />
                <span>
                  <span className="font-semibold">{NOTES[i % NOTES.length]}</span>
                  <span className="block font-typewriter text-[11px] text-slate-500">Note sent to the studio</span>
                </span>
              </motion.span>
            )}
          </AnimatePresence>

          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => setI((k) => (k + count - 1) % count)}
            className="absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/60"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => setI((k) => (k + 1) % count)}
            className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/60"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
          {Array.from({ length: count }, (_, k) => (
            <span
              key={k}
              className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-steel" : "w-1.5"} ${
                k !== i && verdicts[k] === "approved" ? "bg-approve" : k !== i && verdicts[k] === "changes" ? "bg-decline" : k !== i ? "bg-white/25" : ""
              }`}
            />
          ))}
        </div>

        <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
          <button
            type="button"
            onClick={() => decide("approved")}
            aria-pressed={v === "approved"}
            className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-3 text-sm font-bold transition active:scale-95 ${
              v === "approved" ? "bg-approve text-white" : "bg-white/10 text-white hover:bg-approve/80"
            }`}
          >
            <Check className="size-4" /> Approve
          </button>
          <button
            type="button"
            onClick={() => decide("changes")}
            aria-pressed={v === "changes"}
            className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-3 text-sm font-bold transition active:scale-95 ${
              v === "changes" ? "bg-decline text-white" : "bg-white/10 text-white hover:bg-decline/80"
            }`}
          >
            <X className="size-4" /> Changes
          </button>
          <button
            type="button"
            onClick={() => setNoted((all) => all.map((x, k) => (k === i ? !x : x)))}
            aria-label="Leave a note"
            aria-pressed={noted[i]}
            className={`flex size-[46px] items-center justify-center rounded-full transition active:scale-95 ${
              noted[i] ? "bg-steel text-ink" : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <MessageCircle className="size-4" />
          </button>
        </div>

        <AnimatePresence>
          {done === count && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
                <p className="text-sm">
                  <span className="font-semibold">All reviewed.</span>{" "}
                  <span className="text-mist/70">The studio sees it the moment you do.</span>
                </p>
                <button type="button" onClick={reset} className="flex shrink-0 items-center gap-1 font-typewriter text-xs text-steel hover:text-white">
                  <RotateCcw className="size-3.5" /> Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
