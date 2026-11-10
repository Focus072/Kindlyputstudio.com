"use client";

import Link from "next/link";
import { useEffect } from "react";
import { brand } from "@/config/brand";

/** Friendly, on-brand page when something breaks, with a way to try again. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-ink px-6 text-center text-white">
      <img src={brand.logo.markOnDark} alt={brand.name} className="h-10 w-auto opacity-90" />
      <h1 className="mt-8 font-display text-5xl uppercase">Something slipped</h1>
      <p className="mt-4 max-w-sm text-white/60">
        This page did not load. It is usually a weak connection. Try again, and if it keeps happening, let {brand.name} know.
      </p>
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={reset} className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-ink hover:bg-cloud">
          Try again
        </button>
        <Link href="/" className="rounded-full border border-white/15 px-5 py-2.5 text-sm hover:bg-white/10">
          Go home
        </Link>
      </div>
      {error.digest && <p className="mt-10 font-typewriter text-[11px] text-white/30">Error code {error.digest}</p>}
    </main>
  );
}
