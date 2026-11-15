import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Globe,
  HardDrive,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Share2,
} from "lucide-react";
import { ClientAvatar } from "@/components/admin/ClientAvatar";
import { PlatformIcon } from "@/components/admin/calendar/PlatformIcon";
import { ClientMark } from "@/components/admin/clients/ClientMark";
import { NotesLog } from "@/components/admin/clients/NotesLog";
import { requireAdmin } from "@/lib/auth";
import { loadRange } from "@/lib/calendar-data";
import {
  channelsByClient,
  getClientProfile,
  listClientNotes,
  loginsForRooms,
  profilesReady,
  sameName,
} from "@/lib/client-profiles";
import { SOCIALS, STATUSES, money, nextOccurrence, shortDate, socialHref, socialLabel } from "@/lib/client-profile-types";
import { listRoomsWithStats } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DAY = 864e5;

function Card({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ icon: Icon, label, children, href }: { icon?: typeof Phone; label: string; children: ReactNode; href?: string }) {
  const body = (
    <>
      <span className="w-[5.5rem] shrink-0 text-[13px] text-slate-500 sm:w-24">{label}</span>
      <span className="min-w-0 flex-1 text-[15px] text-ink [overflow-wrap:anywhere] sm:text-sm">{children}</span>
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-slate-300" />}
    </>
  );
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100">
      {body}
    </a>
  ) : (
    <div className="flex items-start gap-3 px-4 py-3">{body}</div>
  );
}

const group = "divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200";
const empty = "rounded-2xl bg-white px-4 py-4 text-sm text-slate-400 shadow-sm ring-1 ring-slate-200";

export default async function ClientProfilePage({ params }: PageProps<"/admin/clients/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const client = await getClientProfile(id);
  if (!client) {
    // Old links pointed at client logins here.
    const { data } = await supabaseAdmin().from("clients").select("id").eq("id", id).maybeSingle();
    if (data) redirect(`/admin/clients/logins/${id}`);
    notFound();
  }

  const now = new Date().getTime();
  const [allRooms, channels, notes, ready, upcoming] = await Promise.all([
    listRoomsWithStats(),
    channelsByClient(),
    listClientNotes(id),
    profilesReady(),
    loadRange(new Date(now - DAY), new Date(now + 21 * DAY))
      .then((r) => r.posts.filter((p) => p.clientId === id && p.status !== "posted").slice(0, 5))
      .catch(() => []),
  ]);
  const rooms = allRooms.filter((r) => sameName(r.client_name, client.name));
  const logins = await loginsForRooms(rooms.map((r) => r.id));
  const accounts = channels.get(id) ?? [];
  const status = STATUSES.find((s) => s.id === client.status) ?? STATUSES[0];

  const dates = [
    ...(client.renews_on ? [{ label: "Contract renews", date: client.renews_on, at: new Date(`${client.renews_on}T12:00:00`) }] : []),
    ...client.dates.map((d) => ({ ...d, at: nextOccurrence(d.date) })),
  ]
    .filter((d): d is { label: string; date: string; at: Date } => !!d.at)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const socials = SOCIALS.filter((s) => client.socials[s.key]);
  const primary = client.contacts[0];
  const callTo = client.phone || primary?.phone;
  const mailTo = client.email || primary?.email;
  const site = client.website ? (/^https?:\/\//i.test(client.website) ? client.website : `https://${client.website}`) : null;
  const quick = [
    callTo && { href: `tel:${callTo.replace(/[^\d+]/g, "")}`, label: "Call", icon: Phone },
    mailTo && { href: `mailto:${mailTo}`, label: "Email", icon: Mail },
    site && { href: site, label: "Website", icon: Globe },
    client.drive_url && { href: client.drive_url, label: "Drive", icon: HardDrive },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Phone }[];

  return (
    <main>
      <Link href="/admin/clients" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink max-sm:-my-2.5 max-sm:py-2.5">
        <ChevronLeft className="size-4" /> All clients
      </Link>

      {/* Header: centered contact card on phones, a wide banner on desktop. */}
      <header className="mt-3 overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="h-16 sm:h-20" style={{ background: `linear-gradient(120deg, ${client.color}, color-mix(in srgb, ${client.color} 45%, #1d2b32))`, opacity: 0.9 }} />
        <div className="px-5 pb-5 sm:flex sm:items-end sm:justify-between sm:gap-6 sm:px-6">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-end sm:gap-5 sm:text-left">
            <span className="relative -mt-9 rounded-[30%] bg-white p-1 sm:-mt-10">
              <ClientMark name={client.name} color={client.color} size="size-[4.5rem] sm:size-20" text="text-2xl" />
            </span>
            <div className="mt-3 min-w-0 sm:mb-1 sm:mt-4">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="break-words font-display text-[2rem] uppercase leading-none text-ink sm:text-4xl">{client.name}</h1>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.tone}`}>{status.label}</span>
              </div>
              <p className="mt-1.5 text-sm text-slate-500">
                {[client.industry, client.client_since ? `Client since ${shortDate(client.client_since)}` : null].filter(Boolean).join(" · ") ||
                  "Add an industry and start date in Edit."}
              </p>
            </div>
          </div>
          <div className="mt-5 flex justify-center gap-2 sm:mt-0 sm:shrink-0">
            {quick.map((q) => (
              <a
                key={q.label}
                href={q.href}
                target={q.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className="flex w-[4.25rem] flex-col items-center gap-1 rounded-xl bg-slate-100 py-2 text-[11px] font-semibold text-ink hover:bg-slate-200 sm:w-auto sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:py-2 sm:text-sm"
              >
                <q.icon className="size-[18px] sm:size-4" /> {q.label}
              </a>
            ))}
            <Link
              href={`/admin/clients/${id}/edit`}
              className="flex w-[4.25rem] flex-col items-center gap-1 rounded-xl bg-ink py-2 text-[11px] font-semibold text-white hover:bg-slate-brand sm:w-auto sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:py-2 sm:text-sm"
            >
              <Pencil className="size-[18px] sm:size-4" /> Edit
            </Link>
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        {/* Main column */}
        <div className="min-w-0 space-y-6 max-lg:order-2">
          <Card
            title={`Rooms · ${rooms.length}`}
            action={
              <Link href={`/admin/rooms/new?client=${encodeURIComponent(client.name)}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline max-sm:-my-2.5 max-sm:py-2.5">
                <Plus className="size-3.5" /> New room
              </Link>
            }
          >
            {rooms.length === 0 ? (
              <p className={empty}>No rooms for {client.name} yet. Rooms show up here when “Prepared for” matches the client name.</p>
            ) : (
              <ul className={group}>
                {rooms.map((r) => {
                  const total = Math.max(r.fileCount, 1);
                  return (
                    <li key={r.id}>
                      <Link href={`/admin/rooms/${r.id}`} className="flex items-center gap-3.5 px-4 py-3 hover:bg-slate-50 active:bg-slate-100">
                        <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-slate-200">
                          {r.coverUrl ? <img src={r.coverUrl} alt="" loading="lazy" className="size-full object-cover" /> : <FolderOpen className="absolute inset-0 m-auto size-5 text-slate-400" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-ink">{r.title}</p>
                          <div className="mt-1.5 flex items-center gap-2.5">
                            <span className="flex h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:w-32">
                              <span className="bg-sage" style={{ width: `${(r.stats.approved / total) * 100}%` }} />
                              <span className="bg-clay/70" style={{ width: `${(r.stats.changes / total) * 100}%` }} />
                            </span>
                            <span className="truncate text-xs text-slate-500">
                              {r.stats.approved}/{r.fileCount} approved{r.stats.changes ? ` · ${r.stats.changes} changes` : ""}
                            </span>
                          </div>
                        </div>
                        {r.status !== "live" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-500">{r.status}</span>}
                        <ChevronRight className="size-4 shrink-0 text-slate-300" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card
            title="Coming up on the calendar"
            action={
              <Link href="/admin/calendar" className="text-sm font-semibold text-brand hover:underline max-sm:-my-2.5 max-sm:py-2.5">
                Calendar
              </Link>
            }
          >
            {upcoming.length === 0 ? (
              <p className={empty}>Nothing scheduled in the next three weeks.</p>
            ) : (
              <ul className={group}>
                {upcoming.map((p) => {
                  const at = new Date(p.at);
                  return (
                    <li key={p.id} className="flex items-center gap-3.5 px-4 py-3">
                      <span className="flex w-11 shrink-0 flex-col items-center rounded-xl bg-slate-50 py-1 ring-1 ring-slate-200">
                        <span className="text-[10px] font-semibold uppercase text-clay">{at.toLocaleDateString("en-US", { month: "short", timeZone: "America/Los_Angeles" })}</span>
                        <span className="text-lg font-bold leading-none text-ink">{at.toLocaleDateString("en-US", { day: "numeric", timeZone: "America/Los_Angeles" })}</span>
                      </span>
                      {p.thumb && <img src={p.thumb} alt="" loading="lazy" className="size-11 shrink-0 rounded-lg object-cover" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] text-ink sm:text-sm">{p.caption || <span className="text-slate-400">No caption</span>}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <PlatformIcon service={p.platform} className="size-3" />
                          {p.channelName ?? p.platform} ·{" "}
                          {at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Notes">
            <NotesLog clientId={id} notes={notes} ready={ready} />
          </Card>
        </div>

        {/* Side column */}
        <aside className="min-w-0 space-y-6">
          <Card title="People">
            {client.contacts.length === 0 ? (
              <p className={empty}>No contacts yet.</p>
            ) : (
              <ul className={group}>
                {client.contacts.map((c, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <ClientAvatar name={c.name} url={null} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-ink sm:text-sm">
                        {c.name}
                        {i === 0 && client.contacts.length > 1 && <span className="ml-1.5 text-[11px] font-medium text-slate-400">Main</span>}
                      </p>
                      <p className="truncate text-xs text-slate-500">{[c.role, c.email].filter(Boolean).join(" · ") || c.phone}</p>
                    </div>
                    {c.phone && (
                      <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${c.name}`} className="inline-flex size-9 items-center justify-center rounded-full bg-slate-100 text-ink hover:bg-slate-200">
                        <Phone className="size-4" />
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} aria-label={`Email ${c.name}`} className="inline-flex size-9 items-center justify-center rounded-full bg-slate-100 text-ink hover:bg-slate-200">
                        <Mail className="size-4" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Business">
            {client.email || client.phone || site || client.address ? (
              <div className={group}>
                {client.phone && <Row label="Phone" href={`tel:${client.phone.replace(/[^\d+]/g, "")}`} icon={Phone}>{client.phone}</Row>}
                {client.email && <Row label="Email" href={`mailto:${client.email}`} icon={Mail}>{client.email}</Row>}
                {site && <Row label="Website" href={site} icon={Globe}>{client.website!.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")}</Row>}
                {client.address && (
                  <Row label="Address" href={`https://maps.google.com/?q=${encodeURIComponent(client.address)}`} icon={MapPin}>
                    <span className="whitespace-pre-line">{client.address}</span>
                  </Row>
                )}
              </div>
            ) : (
              <p className={empty}>No phone, email or address yet.</p>
            )}
          </Card>

          <Card title="Social">
            {socials.length === 0 && accounts.length === 0 ? (
              <p className={empty}>No handles yet.</p>
            ) : (
              <div className={group}>
                {socials.map((s) => (
                  <a key={s.key} href={socialHref(s.key, client.socials[s.key])} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <PlatformIcon service={s.key === "google" ? "googlebusiness" : s.key} className="size-4 text-slate-500" />
                    <span className="min-w-0 flex-1 truncate text-[15px] text-ink sm:text-sm">{socialLabel(client.socials[s.key])}</span>
                    <span className="text-xs text-slate-400">{s.label}</span>
                  </a>
                ))}
                {accounts.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500">
                    <CalendarDays className="size-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1">
                      {accounts.length} Buffer {accounts.length === 1 ? "account" : "accounts"}: {accounts.map((a) => a.name).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card title="Package">
            {client.package || client.monthly_rate != null || client.client_since || client.billing_notes ? (
              <div className={group}>
                {client.package && <Row label="Package">{client.package}</Row>}
                {client.monthly_rate != null && <Row label="Monthly">{money(client.monthly_rate)}</Row>}
                {client.client_since && <Row label="Since">{shortDate(client.client_since)}</Row>}
                {client.renews_on && <Row label="Renews">{shortDate(client.renews_on)}</Row>}
                {client.billing_notes && <Row label="Billing"><span className="whitespace-pre-line">{client.billing_notes}</span></Row>}
              </div>
            ) : (
              <p className={empty}>No package or pricing yet.</p>
            )}
          </Card>

          <Card title="Important dates">
            {dates.length === 0 ? (
              <p className={empty}>No dates yet. Add birthdays, anniversaries, launches.</p>
            ) : (
              <ul className={group}>
                {dates.map((d, i) => {
                  const days = Math.round((d.at.getTime() - now) / DAY);
                  return (
                    <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0 truncate text-[15px] text-ink sm:text-sm">{d.label}</span>
                      <span className="shrink-0 text-right text-xs text-slate-500">
                        {shortDate(d.at)}
                        <span className={`ml-1.5 rounded-full px-1.5 py-0.5 font-semibold ${days >= 0 && days <= 14 ? "bg-ochre-soft text-ochre" : "bg-slate-100 text-slate-500"}`}>
                          {days < 0 ? "passed" : days === 0 ? "today" : `in ${days}d`}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {(client.brand_notes || client.notes) && (
            <Card title="Brand & about">
              <div className={`${group} text-[15px] sm:text-sm`}>
                {client.brand_notes && (
                  <div className="px-4 py-3">
                    <p className="text-[13px] text-slate-500">Brand notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-ink">{client.brand_notes}</p>
                  </div>
                )}
                {client.notes && (
                  <div className="px-4 py-3">
                    <p className="text-[13px] text-slate-500">About</p>
                    <p className="mt-1 whitespace-pre-wrap text-ink">{client.notes}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card title={`Logins · ${logins.length}`}>
            {logins.length === 0 ? (
              <p className={empty}>Nobody from {client.name} has signed in to a room yet.</p>
            ) : (
              <ul className={group}>
                {logins.map((l) => (
                  <li key={l.id}>
                    <Link href={`/admin/clients/logins/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                      <ClientAvatar name={l.full_name ?? l.email ?? "?"} url={l.avatar_url} size="size-8" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{l.full_name ?? l.email}</p>
                        <p className="text-xs text-slate-500">Last opened {timeAgo(l.lastOpened)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {client.share_token && (
            <Link href={`/admin/calendar/ideas?c=${id}`} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
              <Share2 className="size-4 text-slate-400" />
              <span className="flex-1 font-semibold text-ink">Client calendar is shared</span>
              <ChevronRight className="size-4 text-slate-300" />
            </Link>
          )}
        </aside>
      </div>
    </main>
  );
}
