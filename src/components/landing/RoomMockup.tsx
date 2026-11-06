"use client";

import { motion } from "framer-motion";
import { Check, Download, Eye, MessageCircle } from "lucide-react";

type Props = { cover: string | null; thumbs: string[]; client: string; title: string; mark: string };

const float = (delay: number) => ({
  animate: { y: [0, -8, 0] },
  transition: { duration: 5, repeat: Infinity, ease: "easeInOut" as const, delay },
});

/** A miniature delivery room, tilted, with floating stat cards. Pure markup, no screenshot. */
export function RoomMockup({ cover, thumbs, client, title, mark }: Props) {
  const grid = thumbs.length ? thumbs.slice(0, 6) : Array.from({ length: 6 }, () => null);
  return (
    <div className="relative mx-auto w-full max-w-[880px] [perspective:1800px]">
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
