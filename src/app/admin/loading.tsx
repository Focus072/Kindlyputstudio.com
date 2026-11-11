/** Placeholder while an admin page loads. The header and tabs stay put. */
export default function AdminLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="space-y-3">
        <div className="h-3 w-28 animate-pulse rounded bg-slate-300/60" />
        <div className="h-10 w-64 max-w-full animate-pulse rounded-xl bg-slate-300/70" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-slate-200" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-[26px] bg-white shadow-sm ring-1 ring-slate-200">
            <div className="aspect-[16/10] animate-pulse bg-slate-200" />
            <div className="space-y-3 p-4">
              <div className="h-1.5 animate-pulse rounded-full bg-slate-100" />
              <div className="h-8 animate-pulse rounded-xl bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
