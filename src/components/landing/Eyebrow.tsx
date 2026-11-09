/** Section label in the brand-kit style: index, name, then a hairline rule. */
export function Eyebrow({ n, children, dark = false }: { n: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <p className={`flex items-center gap-3 font-typewriter text-xs uppercase tracking-[0.14em] sm:text-sm sm:tracking-[0.2em] ${dark ? "text-mist/60" : "text-slate-500"}`}>
      <span className={dark ? "text-steel" : "text-slate-brand"}>{n}</span>
      <span aria-hidden>/</span>
      <span>{children}</span>
      <span aria-hidden className={`h-px flex-1 ${dark ? "bg-white/15" : "bg-black/10"}`} />
    </p>
  );
}
