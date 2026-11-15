"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarClock, ChevronRight, FolderOpen, Search, UserRound } from "lucide-react";
import { PlatformIcon } from "@/components/admin/calendar/PlatformIcon";
import { ClientMark } from "@/components/admin/clients/ClientMark";
import { type ClientContact, type ClientStatus, STATUSES, money, shortDate } from "@/lib/client-profile-types";

export type DirectoryClient = {
  id: string;
  name: string;
  color: string;
  status: ClientStatus;
  industry: string | null;
  contact: ClientContact | null;
  email: string | null;
  phone: string | null;
  package: string | null;
  rate: number | null;
  rooms: number;
  liveRooms: number;
  accounts: string[];
  next: { label: string; at: string } | null;
};

function StatusPill({ status }: { status: ClientStatus }) {
  const s = STATUSES.find((x) => x.id === status) ?? STATUSES[0];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.tone}`}>{s.label}</span>;
}

export function ClientDirectory({ clients }: { clients: DirectoryClient[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ClientStatus | "all">("all");

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: clients.length };
    for (const c of clients) m[c.status] = (m[c.status] ?? 0) + 1;
    return m;
  }, [clients]);

  const shown = clients.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return [c.name, c.industry, c.contact?.name, c.email, c.phone, c.package].some((v) => v?.toLowerCase().includes(needle));
  });

  if (!clients.length) {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="font-bold text-ink">No clients yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Add a client to keep their contacts, package, brand notes and dates in one place.</p>
        <Link href="/admin/clients/new" className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white">
          New client
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <span className="sr-only">Search clients</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clients"
            className="h-11 w-full rounded-xl bg-white pl-10 pr-3 text-base outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-brand/30 sm:h-10 sm:text-sm"
          />
        </label>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {(["all", ...STATUSES.map((s) => s.id)] as const).map((id) => {
            if (id !== "all" && !counts[id]) return null;
            const on = filter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                aria-pressed={on}
                className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                  on ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-ink"
                }`}
              >
                {id === "all" ? "All" : STATUSES.find((s) => s.id === id)!.label}
                <span className={`ml-1.5 tabular-nums ${on ? "text-white/60" : "text-slate-400"}`}>{counts[id] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white px-4 py-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">No clients match.</p>
      ) : (
        <>
          {/* Phones: an iOS grouped list. */}
          <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-[18px] bg-white ring-1 ring-slate-200/80 sm:hidden">
            {shown.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-slate-100">
                  <ClientMark name={c.name} color={c.color} size="size-10" text="text-[13px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold text-ink">{c.name}</p>
                    <p className="truncate text-[13px] text-slate-500">
                      {[c.contact?.name, c.industry].filter(Boolean).join(" · ") || (c.rooms ? `${c.rooms} ${c.rooms === 1 ? "room" : "rooms"}` : "No details yet")}
                    </p>
                  </div>
                  {c.status !== "active" && <StatusPill status={c.status} />}
                  <ChevronRight className="size-4 shrink-0 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Tablet and desktop: cards. */}
          <ul className="mt-5 grid gap-4 max-sm:hidden sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/clients/${c.id}`}
                  className="group flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-300"
                >
                  <div className="flex items-start gap-3.5">
                    <ClientMark name={c.name} color={c.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[17px] font-bold leading-snug text-ink">{c.name}</p>
                      <p className="truncate text-sm text-slate-500">{c.industry || "No industry set"}</p>
                    </div>
                    <StatusPill status={c.status} />
                  </div>

                  <dl className="mb-4 mt-4 space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <UserRound className="size-4 shrink-0 text-slate-400" />
                      <dt className="sr-only">Contact</dt>
                      <dd className="truncate">
                        {c.contact ? (
                          <>
                            <span className="font-medium text-ink">{c.contact.name}</span>
                            {c.contact.role ? <span className="text-slate-400"> · {c.contact.role}</span> : null}
                          </>
                        ) : (
                          <span className="text-slate-400">No contact yet</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <FolderOpen className="size-4 shrink-0 text-slate-400" />
                      <dt className="sr-only">Rooms</dt>
                      <dd>
                        {c.rooms} {c.rooms === 1 ? "room" : "rooms"}
                        {c.liveRooms ? <span className="text-slate-400"> · {c.liveRooms} live</span> : null}
                      </dd>
                    </div>
                    {c.next && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <CalendarClock className="size-4 shrink-0 text-slate-400" />
                        <dt className="sr-only">Next date</dt>
                        <dd className="truncate">
                          {c.next.label} <span className="text-slate-400">· {shortDate(new Date(c.next.at))}</span>
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
                    <p className="flex min-w-0 text-sm">
                      {c.package || c.rate != null ? (
                        <>
                          <span className="truncate font-semibold text-ink">{c.package || "Retainer"}</span>
                          {c.rate != null && <span className="shrink-0 whitespace-pre text-slate-500"> · {money(c.rate)}/mo</span>}
                        </>
                      ) : (
                        <span className="text-slate-400">No package set</span>
                      )}
                    </p>
                    {c.accounts.length > 0 && (
                      <span className="flex shrink-0 items-center gap-1.5 text-slate-400">
                        {[...new Set(c.accounts)].slice(0, 4).map((s) => (
                          <PlatformIcon key={s} service={s} className="size-3.5" />
                        ))}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
