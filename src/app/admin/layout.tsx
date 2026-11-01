import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <img src={brand.logo.mark} alt={brand.name} className="h-8 w-auto" />
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.28em] text-ink sm:inline">
              {brand.name}
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-semibold">
            <Link href="/admin" className="rounded-full px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-ink">
              Rooms
            </Link>
            <Link href="/admin/clients" className="rounded-full px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-ink">
              Clients
            </Link>
          </nav>
          <form action={logout}>
            <button className="text-sm text-slate-500 hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
    </div>
  );
}
