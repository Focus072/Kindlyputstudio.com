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
            {brand.logo ? (
              <img src={brand.logo} alt={brand.name} className="h-6 w-auto" />
            ) : (
              <span className="font-display text-xl uppercase tracking-wide text-slate-900">{brand.name}</span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-typewriter text-[11px] text-slate-500">
              Rooms
            </span>
          </Link>
          <form action={logout}>
            <button className="text-sm text-slate-500 hover:text-slate-900">Sign out</button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
    </div>
  );
}
