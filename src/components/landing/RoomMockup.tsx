"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { Check, Download, Eye, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

type Props = { cover: string | null; thumbs: string[]; client: string; title: string; mark: string };

const float = (delay: number) => ({
  animate: { y: [0, -8, 0] },
  transition: { duration: 5, repeat: Infinity, ease: "easeInOut" as const, delay },
});

/** A miniature delivery room, tilted, with floating stat cards. Pure markup, no screenshot. */
export function RoomMockup({ cover, thumbs, client, title, mark }: Props) {
  const grid = thumbs.length ? thumbs.slice(0, 6) : Array.from({ length: 6 }, () => null);

  // On desktop the room leans gently toward the cursor.
  const tiltX = useSpring(useMotionValue(0), { stiffness: 80, damping: 18 });
  const tiltY = useSpring(useMotionValue(0), { stiffness: 80, damping: 18 });
  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!mq.matches) return;
    const onMove = (e: PointerEvent) => {
      tiltY.set(((e.clientX / window.innerWidth) - 0.5) * 8);
      tiltX.set(((e.clientY / window.innerHeight) - 0.5) * -5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [tiltX, tiltY]);

  return (
    <div className="relative mx-auto w-full max-w-[880px] [perspective:1800px]">
      <Viewfinder />
      <motion.div style={{ rotateX: tiltX, rotateY: tiltY, transformStyle: "preserve-3d" }}>
      <motion.div
        initial={{ opacity: 0, y: 40, rotateX: 22, rotateZ: -4 }}
        animate={{ opacity: 1, y: 0, rotateX: 14, rotateZ: -3 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative origin-bottom overflow-hidden rounded-[22px] border border-white/10 bg-[#0F181D] p-3 text-cloud shadow-[0_60px_120px_-40px_rgba(15,24,29,0.65)] sm:rounded-[30px] sm:p-6"
        style={{ transformStyle: "preserve-3d" }}
      >
        <span className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-steel/40 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <img src={mark} alt="" className="h-5 w-auto sm:h-7" />
          <span className="rounded-full border border-white/10 px-2 py-0.5 font-typewriter text-[8px] text-mist/70 sm:px-3 sm:py-1 sm:text-[10px]">
            Delivered by Kindly Put Studio
          </span>
        </div>
        <div className="relative mt-3 grid grid-cols-[1fr_1.2fr] items-end gap-3 sm:mt-6 sm:gap-6">
          <div className="min-w-0">
            <p className="font-typewriter text-[8px] text-mist/60 sm:text-[11px]">Prepared for {client}</p>
            <p className="mt-1 line-clamp-3 font-display text-[1.35rem] uppercase leading-[0.9] sm:text-5xl">{title}</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-steel px-2 py-1 text-[8px] font-bold text-ink sm:mt-4 sm:gap-1.5 sm:px-4 sm:py-2 sm:text-xs">
              <Download className="size-2.5 sm:size-3.5" /> Download all
            </span>
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-[#1D2B32] sm:rounded-2xl">
            {cover && <img src={cover} alt="" className="size-full object-cover" />}
          </div>
        </div>
        <div className="relative mt-3 grid grid-cols-6 gap-1.5 sm:mt-6 sm:gap-3">
          {grid.map((t, i) => (
            <div key={i} className="relative aspect-[4/5] overflow-hidden rounded-md bg-[#1D2B32] sm:rounded-xl">
              {t && <img src={t} alt="" loading="lazy" className="size-full object-cover" />}
              {i < 4 && (
                <span className="absolute right-0 top-0 size-0 border-l-[14px] border-t-[14px] border-l-transparent border-t-approve sm:border-l-[22px] sm:border-t-[22px]" />
              )}
            </div>
          ))}
        </div>
      </motion.div>
      </motion.div>

      {/* Floating stat cards */}
      <motion.div {...float(0)} className="absolute -left-2 top-[18%] sm:-left-10">
        <Card icon={<Check className="size-3.5 sm:size-4" />} tone="bg-approve text-white" big="12" small="approved" />
      </motion.div>
      <motion.div {...float(1.2)} className="absolute -right-2 top-[6%] sm:-right-8 lg:-right-14 lg:top-[11%]">
        <Card icon={<Eye className="size-3.5 sm:size-4" />} tone="bg-ink text-white" big="Opened" small="just now" />
      </motion.div>
      <motion.div {...float(2.4)} className="absolute -bottom-4 right-[12%] sm:-bottom-6">
        <Card icon={<MessageCircle className="size-3.5 sm:size-4" />} tone="bg-steel text-ink" big="“Love this one!”" small="new comment" />
      </motion.div>
    </div>
  );
}

/** Camera viewfinder framing around the hero room: corner brackets and exposure readouts. */
function Viewfinder() {
  const [frames, setFrames] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setFrames((f) => f + 1), 1000 / 12);
    return () => clearInterval(id);
  }, []);
  const fps = 24;
  const total = Math.floor(frames * 2);
  const pad = (n: number) => String(n).padStart(2, "0");
  const tc = `00:${pad(Math.floor(total / fps / 60) % 60)}:${pad(Math.floor(total / fps) % 60)}:${pad(total % fps)}`;
  const corner = "absolute size-6 border-slate-brand/50 sm:size-10";
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-x-3 -bottom-10 -top-8 hidden sm:block lg:-inset-x-20 lg:-bottom-14 lg:-top-12">
      <span className={`${corner} left-0 top-0 border-l-2 border-t-2`} />
      <span className={`${corner} right-0 top-0 border-r-2 border-t-2`} />
      <span className={`${corner} bottom-0 left-0 border-b-2 border-l-2`} />
      <span className={`${corner} bottom-0 right-0 border-b-2 border-r-2`} />
      <span className="absolute left-12 top-0 hidden -translate-y-1/2 items-center gap-1.5 font-typewriter text-[11px] text-slate-brand lg:flex">
        <span className="kp-blink size-2 rounded-full bg-decline" /> REC
      </span>
      <span className="absolute right-12 top-0 hidden -translate-y-1/2 font-typewriter text-[11px] text-slate-500 lg:block">4K · 24 FPS · RAW</span>
      <span className="absolute bottom-0 left-12 hidden translate-y-1/2 font-typewriter text-[11px] text-slate-500 lg:block">ISO 400 · 1/125 · f/2.8</span>
      <span className="absolute bottom-0 right-12 hidden translate-y-1/2 font-typewriter text-[11px] tabular-nums text-slate-brand lg:block">{tc}</span>
    </div>
  );
}

function Card({ icon, tone, big, small }: { icon: React.ReactNode; tone: string; big: string; small: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/95 py-1.5 pl-1.5 pr-3 shadow-[0_20px_40px_-16px_rgba(15,24,29,0.45)] ring-1 ring-black/5 backdrop-blur sm:gap-3 sm:py-2.5 sm:pl-2.5 sm:pr-5">
      <span className={`flex size-7 items-center justify-center rounded-xl sm:size-9 ${tone}`}>{icon}</span>
      <span className="leading-tight">
        <span className="block text-xs font-bold text-ink sm:text-sm">{big}</span>
        <span className="block font-typewriter text-[9px] text-slate-500 sm:text-[11px]">{small}</span>
      </span>
    </div>
  );
}
