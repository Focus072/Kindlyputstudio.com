"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Inbox, LayoutGrid, Plus, Settings, UsersRound } from "lucide-react";

const rooms = { href: "/admin", label: "Rooms", icon: LayoutGrid, match: (p: string) => p === "/admin" || (p.startsWith("/admin/rooms/") && p !== "/admin/rooms/new") };
const calendar = { href: "/admin/calendar", label: "Calendar", icon: CalendarDays, match: (p: string) => p.startsWith("/admin/calendar") };
const clients = { href: "/admin/clients", label: "Clients", icon: UsersRound, match: (p: string) => p.startsWith("/admin/clients") };
const activity = { href: "/admin/activity", label: "Activity", icon: Bell, match: (p: string) => p.startsWith("/admin/activity") };
const leads = { href: "/admin/leads", label: "Leads", icon: Inbox, match: (p: string) => p.startsWith("/admin/leads") };
const settings = { href: "/admin/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/admin/settings") };

/** Tablet top nav order. */
const tabs = [rooms, calendar, clients, activity, leads, settings];

/** Phones get five tabs like a native app. Settings lives in the header and
 *  New room is the + next to the Rooms title. */
const phoneTabs = [rooms, calendar, activity, clients, leads];

/** Desktop sidebar groups. */
const sidebarGroups = [
  { label: "Work", items: [rooms, calendar, clients] },
  { label: "Inbox", items: [activity, leads] },
];

function SidebarLink({ item, path, unread = 0 }: { item: typeof rooms; path: string; unread?: number }) {
  const on = item.match(path);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={on ? "page" : undefined}
      className={`flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
        on ? "bg-white/[0.11] text-white" : "text-mist/65 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <Icon className="size-[17px]" strokeWidth={on ? 2.1 : 1.8} />
      <span className="flex-1">{item.label}</span>
      {item.href === "/admin/activity" && <Badge n={unread} />}
    </Link>
  );
}

/** Desktop sidebar: main sections. */
export function SidebarNav({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="space-y-5">
      {sidebarGroups.map((g) => (
        <div key={g.label}>
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-mist/35">{g.label}</p>
          <div className="space-y-0.5">
            {g.items.map((t) => (
              <SidebarLink key={t.href} item={t} path={path} unread={unread} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function SidebarSettings() {
  return <SidebarLink item={settings} path={usePathname()} />;
}

/** Desktop sidebar: one line per client, like channels in a chat app. */
export function SidebarClients({ clients }: { clients: { id: string; name: string; color: string }[] }) {
  const path = usePathname();
  if (!clients.length) return null;
  return (
    <div className="mt-5 pb-4">
      <div className="mb-1 flex items-center justify-between px-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mist/35">Clients</p>
        <Link href="/admin/clients/new" aria-label="Add client" className="-mr-1 rounded p-1 text-mist/40 hover:bg-white/[0.06] hover:text-white">
          <Plus className="size-3.5" strokeWidth={2.4} />
        </Link>
      </div>
      <ul className="space-y-0.5">
        {clients.map((c) => {
          const on = path === `/admin/clients/${c.id}` || path.startsWith(`/admin/clients/${c.id}/`);
          return (
            <li key={c.id}>
              <Link
                href={`/admin/clients/${c.id}`}
                aria-current={on ? "page" : undefined}
                className={`flex h-8 items-center gap-3 rounded-lg px-3 text-[13px] transition-colors ${
                  on ? "bg-white/[0.11] text-white" : "text-mist/60 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <span className="size-2 shrink-0 rounded-full ring-2 ring-white/10" style={{ background: c.color }} />
                <span className="truncate">{c.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
    <nav className="hidden items-center gap-0.5 text-sm font-semibold sm:flex">
      {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-full px-3 py-2 transition-colors ${
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
