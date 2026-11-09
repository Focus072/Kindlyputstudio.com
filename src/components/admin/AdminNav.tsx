"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Inbox, LayoutGrid, Plus, Settings, UsersRound } from "lucide-react";

const tabs = [
  { href: "/admin", label: "Rooms", icon: LayoutGrid, match: (p: string) => p === "/admin" || (p.startsWith("/admin/rooms/") && p !== "/admin/rooms/new") },
  { href: "/admin/rooms/new", label: "New room", icon: Plus, match: (p: string) => p === "/admin/rooms/new" },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays, match: (p: string) => p.startsWith("/admin/calendar") },
  { href: "/admin/activity", label: "Activity", icon: Bell, match: (p: string) => p.startsWith("/admin/activity") },
  { href: "/admin/clients", label: "Clients", icon: UsersRound, match: (p: string) => p.startsWith("/admin/clients") },
  { href: "/admin/leads", label: "Leads", icon: Inbox, match: (p: string) => p.startsWith("/admin/leads") },
  { href: "/admin/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/admin/settings") },
];

/** Settings lives in the header on phones, so the tab bar keeps six slots. */
const phoneTabs = tabs.filter((t) => t.href !== "/admin/settings");

function Badge({ n, className = "" }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={`min-w-4 rounded-full bg-decline px-1 text-center text-[10px] font-bold leading-4 text-white ${className}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** Settings gear in the phone header, lit up while you are on Settings. */
export function AdminSettingsLink() {
  const on = usePathname().startsWith("/admin/settings");
  return (
    <Link
      href="/admin/settings"
      aria-label="Studio settings"
      aria-current={on ? "page" : undefined}
      className={`inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel sm:hidden ${
        on ? "bg-white/12 text-white" : "text-mist/70 hover:bg-white/8 hover:text-white"
      }`}
    >
      <Settings className="size-5" />
    </Link>
  );
}

/** Top nav links on tablet and desktop. */
export function AdminTopNav({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="hidden items-center gap-1 text-sm font-semibold sm:flex">
      {tabs
        .filter((t) => t.href !== "/admin/rooms/new")
        .map((t) => {
          const active = t.match(path) || (t.href === "/admin" && path === "/admin/rooms/new");
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={path === t.href ? "page" : active ? "location" : undefined}
              className={`rounded-full px-2 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-steel md:px-3 lg:px-4 ${
                active ? "bg-white/12 text-white" : "text-mist/80 hover:bg-white/8 hover:text-white"
              }`}
            >
              {t.label}
              {t.href === "/admin/activity" && <Badge n={unread} className="ml-1.5 inline-block align-middle" />}
            </Link>
          );
        })}
    </nav>
  );
}

/** Thumb-reach tab bar on phones, like a native app. */
export function AdminTabBar({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
    >
      <ul className="grid grid-cols-6">
        {phoneTabs.map((t) => {
          const active = t.match(path);
          const Icon = t.icon;
          const isNew = t.href === "/admin/rooms/new";
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-label={isNew ? t.label : undefined}
                aria-current={path === t.href ? "page" : active ? "location" : undefined}
                className={`flex h-full flex-col items-center gap-1 py-2.5 text-[11px] font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-steel ${
                  active ? "text-white" : "text-mist/80"
                }`}
              >
                {isNew ? (
                  <span
                    className={`flex size-8 items-center justify-center rounded-full ${
                      active ? "bg-white text-ink" : "bg-steel text-ink"
                    }`}
                  >
                    <Icon className="size-5" strokeWidth={2.5} />
                  </span>
                ) : (
                  <span className="relative flex size-8 items-center justify-center">
                    <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                    {t.href === "/admin/activity" && <Badge n={unread} className="absolute -right-1.5 -top-0.5" />}
                  </span>
                )}
                {isNew ? (
                  <span aria-hidden="true">
                    <span className="min-[375px]:hidden">New</span>
                    <span className="hidden min-[375px]:inline">New room</span>
                  </span>
                ) : t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
