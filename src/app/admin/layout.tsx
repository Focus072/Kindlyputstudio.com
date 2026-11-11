import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { unreadActivityCount } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth";
import { getStudioSettings } from "@/lib/settings";
import { logout } from "@/app/login/actions";
import { AdminSettingsLink, AdminTabBar, AdminTopNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  const [studio, unread] = await Promise.all([getStudioSettings(), unreadActivityCount()]);
  return (
    <div className="kp-admin min-h-dvh bg-[#eceef0]">
      <header className="sticky top-0 z-20 bg-ink/95 pt-[env(safe-area-inset-top)] text-white backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4 sm:h-auto sm:px-5 sm:py-3 lg:px-8 2xl:max-w-7xl">
          <Link href="/admin" className="flex items-center gap-3">
            <img src={studio.markOnDark} alt={studio.name} className="h-7 w-auto sm:h-8" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-mist/70 sm:text-[11px] sm:text-mist/80 sm:max-lg:hidden">Studio</span>
          </Link>
          <AdminTopNav unread={unread} />
          <div className="flex items-center">
          <AdminSettingsLink />
          <form action={logout}>
            <button
              className="inline-flex size-11 items-center justify-center gap-1.5 rounded-full text-sm text-mist/70 hover:bg-white/8 hover:text-white sm:size-auto sm:px-3 sm:py-2"
              aria-label="Sign out"
            >
              <LogOut className="size-[18px] sm:size-4" />
              <span className="hidden lg:inline">Sign out</span>
            </button>
          </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:py-8 lg:px-8 lg:pb-16 lg:pt-10 2xl:max-w-7xl">{children}</div>
      <AdminTabBar unread={unread} />
    </div>
  );
}
