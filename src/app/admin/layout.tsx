import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { brand } from "@/config/brand";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { AdminTabBar, AdminTopNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="min-h-dvh bg-[#eceef0]">
      <header className="sticky top-0 z-20 bg-ink/95 pt-[env(safe-area-inset-top)] text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/admin" className="flex items-center gap-3">
            <img src={brand.logo.markOnDark} alt={brand.name} className="h-8 w-auto" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-mist/80">Studio</span>
          </Link>
          <AdminTopNav />
          <form action={logout}>
            <button
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-mist/70 hover:bg-white/8 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-5 sm:py-8">{children}</div>
      <AdminTabBar />
    </div>
  );
}
