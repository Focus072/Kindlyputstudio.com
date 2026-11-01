"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

type Props = {
  open: boolean;
  deliveredBy: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
};

export function NamePrompt({ open, deliveredBy, onSubmit, onClose }: Props) {
  const [value, setValue] = useState("");
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.form
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (value.trim()) onSubmit(value.trim());
            }}
            className="w-full max-w-sm rounded-3xl border border-room-border bg-room-surface p-6 text-room-fg shadow-2xl"
          >
            <p className="font-typewriter text-xs uppercase tracking-widest text-room-muted">
              Quick question
            </p>
            <h2 className="mt-2 text-xl font-bold">What should we call you?</h2>
            <p className="mt-1 text-sm text-room-muted">
              So {deliveredBy} knows who approved what. You only do this once.
            </p>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Your first name"
              maxLength={60}
              className="mt-5 w-full rounded-full border border-room-border bg-black/30 px-5 py-3 text-base outline-none placeholder:text-room-muted focus:border-room-accent"
            />
            <button
              type="submit"
              disabled={!value.trim()}
              className="mt-4 w-full rounded-full bg-room-accent px-5 py-3 font-bold text-white transition-opacity disabled:opacity-40"
            >
              Continue
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
