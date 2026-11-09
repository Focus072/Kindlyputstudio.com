import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { unreadActivityCount } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth";
import { getStudioSettings } from "@/lib/settings";
import { logout } from "@/app/login/actions";
import { AdminSettingsLink, AdminTabBar, AdminTopNav } from "@/components/admin/AdminNav";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: { default: "Admin", template: `%s · ${brand.name}` },
  robots: { index: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  const [studio, unread] = await Promise.all([getStudioSettings(), unreadActivityCount()]);
  return (
    <div className="kp-admin min-h-dvh bg-[#eceef0]">
      <a href="#admin-content" className="sr-only rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-40 focus:outline-2 focus:outline-offset-2 focus:outline-ink">
        Skip to main content
      </a>
      <header className="sticky top-0 z-20 bg-ink/95 pt-[env(safe-area-inset-top)] text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-5 lg:px-8 2xl:max-w-7xl">
          <Link href="/admin" className="flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel">
            <img src={studio.markOnDark} alt={studio.name} className="h-8 w-auto min-w-0 max-w-24 object-contain" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-mist/80 sm:max-lg:hidden">Studio</span>
          </Link>
          <AdminTopNav unread={unread} />
          <div className="flex shrink-0 items-center gap-1">
            <AdminSettingsLink />
            <form action={logout}>
              <button
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm text-mist/80 hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
                <span className="hidden lg:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <div id="admin-content" tabIndex={-1} className="mx-auto max-w-6xl scroll-mt-[calc(4rem+env(safe-area-inset-top))] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 outline-none sm:px-5 sm:py-8 lg:px-8 lg:pb-16 lg:pt-10 2xl:max-w-7xl">{children}</div>
      <AdminTabBar unread={unread} />
    </div>
  );
}
