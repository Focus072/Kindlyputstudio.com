/** Shown the moment a room link opens, while the files load. Matches the Studio theme. */
export default function RoomLoading() {
  return (
    <div className="min-h-dvh bg-[#0F181D]" role="status" aria-label="Opening your room">
      <div className="mx-auto max-w-7xl px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8 sm:pt-[calc(1.75rem+env(safe-area-inset-top))] 2xl:max-w-[1600px]">
        <div className="h-8 w-14 animate-pulse rounded-lg bg-white/8 sm:h-9" />
        <div className="grid gap-8 pt-8 sm:gap-10 sm:pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end lg:gap-14 lg:pt-20">
          <div className="space-y-4">
            <div className="h-3 w-40 animate-pulse rounded bg-white/8" />
            <div className="h-3 w-52 animate-pulse rounded bg-white/8" />
            <div className="mt-6 h-14 w-4/5 animate-pulse rounded-xl bg-white/10 sm:h-20" />
            <div className="h-14 w-3/5 animate-pulse rounded-xl bg-white/10 sm:h-20" />
            <div className="!mt-8 h-12 w-full animate-pulse rounded-full bg-white/8 sm:w-56" />
          </div>
          <div className="aspect-[4/3] w-full animate-pulse rounded-[28px] bg-white/6" />
        </div>
        <div className="mt-14 grid grid-cols-2 gap-3 sm:mt-28 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-white/6" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
      <span className="sr-only">Opening your room…</span>
    </div>
  );
}
