/** Placeholder while a client's rooms load. */
export default function AccountLoading() {
  return (
    <main className="min-h-dvh bg-ink" role="status" aria-label="Loading your rooms">
      <div className="mx-auto max-w-6xl px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8">
        <div className="h-9 w-14 animate-pulse rounded-lg bg-white/8" />
        <div className="mt-11 h-3 w-48 animate-pulse rounded bg-white/8" />
        <div className="mt-4 h-12 w-72 max-w-full animate-pulse rounded-xl bg-white/10 sm:h-16" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-3xl bg-white/6" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </main>
  );
}
