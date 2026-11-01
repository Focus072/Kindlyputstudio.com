"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ShowcaseShoot } from "@/lib/showcase";

export function Showcase({ shoots }: { shoots: ShowcaseShoot[] }) {
  const [open, setOpen] = useState<ShowcaseShoot | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <MotionConfig reducedMotion="user">
      <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
        {shoots.map((s, i) => (
          <motion.li
            key={s.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              onClick={() => setOpen(s)}
              className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[22px] bg-ink text-left sm:rounded-[28px]"
            >
              <img
                src={s.cover}
                alt={`${s.client}, ${s.label}`}
                loading="lazy"
                className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/90 text-ink opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
                <ArrowUpRight className="size-4" />
              </span>
              <span className="absolute inset-x-3 bottom-3 text-white sm:inset-x-5 sm:bottom-5">
                <span className="block font-typewriter text-[10px] text-white/70 sm:text-xs">{s.photoCount} photos</span>
                <span className="mt-0.5 block text-balance font-display text-2xl uppercase leading-none sm:text-4xl">{s.client}</span>
                <span className="mt-1 line-clamp-1 block text-xs text-white/75 sm:text-sm">{s.label}</span>
              </span>
            </button>
          </motion.li>
        ))}
      </ul>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 overflow-y-auto bg-ink/95 text-cloud backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
          >
            <div className="mx-auto max-w-6xl px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 z-10 -mx-4 flex items-start justify-between gap-4 bg-ink/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
                <div className="min-w-0">
                  <p className="font-typewriter text-xs text-mist/60">Recent work · {open.photoCount} photos</p>
                  <h3 className="font-display text-4xl uppercase leading-none sm:text-6xl">{open.client}</h3>
                  <p className="mt-1 text-sm text-mist/80">{open.label}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  aria-label="Close"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <X className="size-5" />
                </button>
              </div>
              <ul className="mt-4 columns-2 gap-3 sm:columns-3 sm:gap-4">
                {open.photos.map((p, i) => (
                  <li key={i} className="mb-3 break-inside-avoid overflow-hidden rounded-2xl bg-white/5 sm:mb-4">
                    <img src={p.full} alt="" loading="lazy" className="w-full" />
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
