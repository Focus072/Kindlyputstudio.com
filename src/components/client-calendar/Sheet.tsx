"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Bottom sheet on phones (drag the top down to close), side panel on bigger screens.
 */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      start.current = e.touches[0].clientY;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (start.current === null) return;
      setDrag(Math.max(0, e.touches[0].clientY - start.current));
    },
    onTouchEnd: () => {
      if (drag > 90) onClose();
      start.current = null;
      setDrag(0);
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 backdrop-blur-[2px] sm:items-stretch sm:justify-end" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
        className="kp-sheet flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl transition-transform duration-200 sm:max-h-none sm:max-w-md sm:rounded-none"
      >
        <div {...handlers} className="touch-none select-none sm:touch-auto">
          <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
            <span className="h-1.5 w-10 rounded-full bg-slate-200" />
          </div>
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-2 sm:border-b sm:border-slate-100 sm:py-3.5">
            <h2 className="truncate font-display text-[26px] uppercase leading-none text-ink">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="-mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-ink sm:bg-transparent sm:hover:bg-slate-100">
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-1 sm:pt-4 ${footer ? "" : "pb-[max(1.25rem,env(safe-area-inset-bottom))]"}`}>{children}</div>
        {footer && <div className="border-t border-slate-100 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}
