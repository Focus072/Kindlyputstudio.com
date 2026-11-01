"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutGrid, Plus, UsersRound } from "lucide-react";

const tabs = [
  { href: "/admin", label: "Rooms", icon: LayoutGrid, match: (p: string) => p === "/admin" || (p.startsWith("/admin/rooms/") && p !== "/admin/rooms/new") },
  { href: "/admin/rooms/new", label: "New room", icon: Plus, match: (p: string) => p === "/admin/rooms/new" },
  { href: "/admin/clients", label: "Clients", icon: UsersRound, match: (p: string) => p.startsWith("/admin/clients") },
  { href: "/admin/leads", label: "Leads", icon: Inbox, match: (p: string) => p.startsWith("/admin/leads") },
];

/** Top nav links on tablet and desktop. */
export function AdminTopNav() {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 text-sm font-semibold sm:flex">
      {tabs
        .filter((t) => t.href !== "/admin/rooms/new")
        .map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-full px-4 py-2 transition-colors ${
              t.match(path) ? "bg-white/12 text-white" : "text-mist/70 hover:bg-white/8 hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        ))}
    </nav>
  );
}

/** Thumb-reach tab bar on phones, like a native app. */
export function AdminTabBar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
    >
      <ul className="grid grid-cols-4">
        {tabs.map((t) => {
          const active = t.match(path);
          const Icon = t.icon;
          const isNew = t.href === "/admin/rooms/new";
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${
                  active ? "text-white" : "text-mist/60"
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
                  <span className="flex size-8 items-center justify-center">
                    <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                  </span>
                )}
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
