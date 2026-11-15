import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, Plus } from "lucide-react";
import { unreadActivityCount } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth";
import { getStudioSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logout } from "@/app/login/actions";
import { AdminSettingsLink, AdminTabBar, AdminTopNav, SidebarClients, SidebarNav, SidebarSettings } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

async function sidebarClients() {
  // Works before and after the client-profile update (status column).
  const db = supabaseAdmin().from("calendar_clients");
  const withStatus = await db.select("id, name, color, status").order("name");
  if (!withStatus.error) return (withStatus.data ?? []).filter((c) => c.status !== "past");
  const { data } = await supabaseAdmin().from("calendar_clients").select("id, name, color").order("name");
  return data ?? [];
}

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  const [studio, unread, clients] = await Promise.all([getStudioSettings(), unreadActivityCount(), sidebarClients()]);
  return (
    <div className="kp-admin min-h-dvh bg-[#eceef0]">
      {/* Desktop: a fixed sidebar, like a native Mac app. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink text-white lg:flex">
        <Link href="/admin" className="flex items-center gap-3 px-6 pb-5 pt-6">
          <img src={studio.markOnDark} alt={studio.name} className="h-8 w-auto" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-mist/70">Studio</span>
        </Link>
        <div className="px-4">
          <Link
            href="/admin/rooms/new"
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-ink transition-colors hover:bg-cloud"
          >
            <Plus className="size-4" strokeWidth={2.4} /> New room
          </Link>
        </div>
        <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto px-3 [scrollbar-width:thin]">
          <SidebarNav unread={unread} />
          <SidebarClients clients={clients} />
        </div>
        <div className="space-y-0.5 border-t border-white/[0.07] px-3 py-3">
          <SidebarSettings />
          <form action={logout}>
            <button className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-mist/60 transition-colors hover:bg-white/[0.06] hover:text-white">
              <LogOut className="size-[17px]" strokeWidth={1.8} /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Phones and tablets: the dark header. */}
      <header className="sticky top-0 z-20 bg-ink/95 pt-[env(safe-area-inset-top)] text-white backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4 sm:h-auto sm:px-5 sm:py-3">
          <Link href="/admin" className="flex items-center gap-3">
            <img src={studio.markOnDark} alt={studio.name} className="h-7 w-auto sm:h-8" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-mist/70 sm:hidden">Studio</span>
          </Link>
          <AdminTopNav unread={unread} />
          <div className="flex items-center">
            <AdminSettingsLink />
            <form action={logout}>
              <button
                className="inline-flex size-11 items-center justify-center rounded-full text-mist/70 hover:bg-white/8 hover:text-white"
                aria-label="Sign out"
              >
                <LogOut className="size-[18px] sm:size-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:py-8 lg:px-10 lg:pb-16 lg:pt-10 2xl:max-w-7xl">
          {children}
        </div>
      </div>
      <AdminTabBar unread={unread} />
    </div>
  );
}
