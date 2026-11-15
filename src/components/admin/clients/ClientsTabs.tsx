import Link from "next/link";

/** Segmented control: client businesses vs. the people who log in to rooms. */
export function ClientsTabs({ active, clients, logins }: { active: "clients" | "logins"; clients?: number; logins?: number }) {
  const item = (on: boolean) =>
    `flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-4 text-sm font-semibold transition-colors sm:flex-none ${
      on ? "bg-white text-ink shadow-sm ring-1 ring-slate-200/70" : "text-slate-500 hover:text-ink"
    }`;
  return (
    <nav aria-label="Client views" className="flex rounded-xl bg-slate-200/70 p-[3px] sm:inline-flex">
      <Link href="/admin/clients" aria-current={active === "clients" ? "page" : undefined} className={item(active === "clients")}>
        Businesses{clients != null && <span className="text-xs font-medium text-slate-400 tabular-nums">{clients}</span>}
      </Link>
      <Link href="/admin/clients/logins" aria-current={active === "logins" ? "page" : undefined} className={item(active === "logins")}>
        Logins{logins != null && <span className="text-xs font-medium text-slate-400 tabular-nums">{logins}</span>}
      </Link>
    </nav>
  );
}
