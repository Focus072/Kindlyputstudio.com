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

/** Phones get five tabs like a native app. Settings lives in the header and
 *  New room is the + next to the Rooms title. */
const phoneTabs = tabs.filter((t) => t.href !== "/admin/settings" && t.href !== "/admin/rooms/new");

function Badge({ n, className = "" }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={`min-w-4 rounded-full bg-[#c4553f] px-1 text-center text-[10px] font-bold leading-4 text-white ${className}`}>
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
      aria-label="Settings"
      aria-current={on ? "page" : undefined}
      className={`inline-flex size-11 items-center justify-center rounded-full sm:hidden ${
        on ? "bg-white/12 text-white" : "text-mist/70 hover:bg-white/8 hover:text-white"
      }`}
    >
      <Settings className="size-[19px]" />
    </Link>
  );
}

/** Top nav links on tablet and desktop. */
export function AdminTopNav({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 text-sm font-semibold sm:flex">
      {tabs
        .filter((t) => t.href !== "/admin/rooms/new")
        .map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-full px-3 py-2 transition-colors lg:px-4 ${
              t.match(path) ? "bg-white/12 text-white" : "text-mist/70 hover:bg-white/8 hover:text-white"
            }`}
          >
            {t.label}
            {t.href === "/admin/activity" && <Badge n={unread} className="ml-1.5 inline-block align-middle" />}
          </Link>
        ))}
    </nav>
  );
}

/** Thumb-reach tab bar on phones, sized like the iOS tab bar (49pt + home bar). */
export function AdminTabBar({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-ink/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 sm:hidden"
    >
      <ul className="grid grid-cols-5">
        {phoneTabs.map((t) => {
          const active = t.match(path);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-[52px] flex-col items-center justify-center gap-[3px] text-[10px] font-medium tracking-[0.01em] transition-colors ${
                  active ? "text-white" : "text-mist/50 active:text-mist/80"
                }`}
              >
                <span className="relative flex h-6 items-center justify-center">
                  <Icon className="size-[23px]" strokeWidth={active ? 2.2 : 1.7} />
                  {t.href === "/admin/activity" && <Badge n={unread} className="absolute -right-2.5 -top-1 ring-2 ring-ink" />}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
