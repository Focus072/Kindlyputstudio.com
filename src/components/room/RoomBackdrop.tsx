"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Soft accent glow from the left side of the room, drifting slowly. */
export function RoomBackdrop() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-room-bg">
      <motion.div
        className="absolute -left-[30vw] top-[-10vh] h-[90vh] w-[80vw] rounded-full blur-[110px]"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--room-accent) 75%, transparent), transparent)",
          opacity: "var(--room-glow)",
        }}
        animate={reduce ? undefined : { x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -left-[15vw] top-[45vh] h-[60vh] w-[45vw] rounded-full blur-[120px]"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--room-accent) 45%, transparent), transparent)",
          opacity: "calc(var(--room-glow) * 0.7)",
        }}
        animate={reduce ? undefined : { x: [0, -20, 0], y: [0, -40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Fine grain keeps large gradients from banding on cheap screens. */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
