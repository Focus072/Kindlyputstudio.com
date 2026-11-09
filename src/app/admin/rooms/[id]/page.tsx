import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { updateRoom } from "@/app/admin/actions";
import { AdminFileGrid } from "@/components/admin/AdminFileGrid";
import { CopyLink } from "@/components/admin/CopyLink";
import { DeleteRoomButton } from "@/components/admin/DeleteRoomButton";
import { RoomForm } from "@/components/admin/RoomForm";
import { Uploader } from "@/components/admin/Uploader";
import { requireAdmin } from "@/lib/auth";
import { clientsForRoom } from "@/lib/clients-data";
import { getRoomById, loadRoomBundle, roomAvailability } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { ClientAvatar } from "@/components/admin/ClientAvatar";
import { RoomAccess } from "@/components/admin/RoomAccess";
import { RoomStatusBadge } from "@/components/admin/RoomStatusBadge";
import { listAccessRequests, listInvites } from "@/lib/access";

export const metadata = { title: "Room details" };

const sections = [
  { id: "room-overview", label: "Overview" },
  { id: "room-access", label: "Access" },
  { id: "upload-files", label: "Upload" },
  { id: "files", label: "Files" },
  { id: "room-settings", label: "Settings" },
];

const closedMessages = {
  draft: "Publish this draft to make the client link available.",
  expired: "Change or clear the expiration date to reopen the client link.",
  archived: "Archived rooms are closed to clients.",
};

export default async function AdminRoomPage({ params }: PageProps<"/admin/rooms/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const room = await getRoomById(id);
  if (!room) notFound();
  const availability = roomAvailability(room);
  const isLive = availability === "live";
  const clientPath = `/r/${room.slug}`;
  const [{ files, stats, hero }, roomClients, invites, requests] = await Promise.all([
    loadRoomBundle(room),
    clientsForRoom(room.id),
    listInvites(room.id),
    listAccessRequests(room.id),
  ]);

  return (
    <main className="space-y-9">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 py-1 text-sm text-slate-500 hover:text-ink">← All rooms</Link>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <RoomStatusBadge status={availability} />
              <p className="font-typewriter text-sm text-slate-600">Prepared for {room.client_name}</p>
            </div>
            <h1 className="mt-2 break-words font-display text-4xl uppercase leading-none text-ink sm:text-5xl">{room.title}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {isLive
                ? room.access_mode === "invited" ? "Client access is limited to the guest list." : "Clients with the link can sign in to open this room."
                : closedMessages[availability]}
            </p>
            {room.showcase && availability !== "archived" && (
              <a href="#room-portfolio" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-2">
                Public portfolio enabled
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {isLive ? (
              <CopyLink path={clientPath} label="Copy client link" className="min-h-11 justify-center" />
            ) : (
              <a href={availability === "expired" ? "#room-expiration" : "#room-publishing"} className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-4 text-sm font-bold text-white">
                {availability === "expired" ? "Expiration settings" : "Publishing settings"}
              </a>
            )}
            <a
              href={`${clientPath}?preview=1`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-ink"
            >
              Studio preview <ArrowUpRight aria-hidden className="size-4 shrink-0" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
        <nav aria-label="Room sections" className="mt-5 flex flex-wrap gap-x-2 gap-y-1">
          {sections.map(({ id, label }) => (
            <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-white hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
      </div>

      <section aria-labelledby="room-overview">
        <h2 id="room-overview" tabIndex={-1} className="mb-3 scroll-mt-24 text-lg font-bold text-ink">Review overview</h2>
        <dl className="grid grid-cols-6 gap-y-3 rounded-2xl bg-white py-3 text-center shadow-sm ring-1 ring-slate-200 sm:grid-cols-5 sm:divide-x sm:divide-slate-100">
          {[
            { label: "Views", value: stats.views, tone: "text-ink" },
            { label: "Notes", value: stats.comments, tone: "text-ink" },
            { label: "Approved", value: stats.approved, tone: "text-approve" },
            { label: "Changes", value: stats.changes, tone: "text-decline" },
            { label: "Pending", value: stats.pending, tone: "text-ink" },
          ].map((s) => (
            <div key={s.label} className="col-span-2 flex min-w-0 flex-col px-1 max-sm:nth-[n+4]:col-span-3 sm:col-span-1">
              <dt className="order-2 text-xs font-semibold text-slate-600">{s.label}</dt>
              <dd className={`order-1 text-xl font-bold tabular-nums sm:text-2xl ${s.value ? s.tone : "text-slate-600"}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {room.feedback_sent_at && (
        <p className="rounded-2xl bg-approve/10 px-4 py-3 text-sm font-semibold text-approve ring-1 ring-approve/30">
          The client sent their feedback {timeAgo(room.feedback_sent_at)}: {stats.approved} approved, {stats.changes} need changes, {stats.pending} not reviewed.
        </p>
      )}

      <section aria-labelledby="room-access">
        <h2 id="room-access" tabIndex={-1} className="mb-3 scroll-mt-24 text-lg font-bold text-ink">Client access</h2>
        {!isLive && <p className="mb-3 text-sm text-slate-600">These settings take effect when the room is live.</p>}
        <RoomAccess
          roomId={room.id}
          mode={room.access_mode ?? "link"}
          invites={invites}
          requests={requests.map((r) => ({ id: r.id, email: r.email, name: r.name }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Clients in this room ({roomClients.length})</h2>
        {roomClients.length === 0 ? (
          <p className="text-sm text-slate-600">
            {isLive ? "Nobody has opened this room yet. Share the client link when you are ready." : "Nobody has opened this room yet."}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {roomClients.map(({ client, lastOpened }) => (
              <li key={client!.id} className="min-w-0 max-w-full">
                <Link
                  href={`/admin/clients/${client!.id}`}
                  className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-sm shadow-sm ring-1 ring-slate-200 hover:ring-slate-300"
                >
                  <ClientAvatar name={client!.full_name ?? client!.email ?? "?"} url={client!.avatar_url} size="size-7" />
                  <span className="min-w-0 font-semibold text-ink [overflow-wrap:anywhere]">{client!.full_name ?? client!.email}</span>
                  <time dateTime={lastOpened} className="shrink-0 text-xs text-slate-600">
                    <span className="sr-only">Last opened </span>{timeAgo(lastOpened)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="upload-files">
        <h2 id="upload-files" tabIndex={-1} className="mb-3 scroll-mt-24 text-lg font-bold text-ink">Upload files</h2>
        <Uploader roomId={room.id} />
      </section>

      <section aria-labelledby="files">
        <h2 id="files" tabIndex={-1} className="mb-3 scroll-mt-24 text-lg font-bold text-ink">Files ({files.length})</h2>
        <AdminFileGrid roomId={room.id} slug={room.slug} files={files} heroId={hero?.id ?? null} />
      </section>

      <section aria-labelledby="room-settings">
        <h2 id="room-settings" tabIndex={-1} className="mb-3 scroll-mt-24 text-lg font-bold text-ink">Room settings</h2>
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <RoomForm action={updateRoom.bind(null, room.id)} room={room} submitLabel="Save changes" />
        </div>
        <div className="mt-5 rounded-2xl border border-rose-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-bold text-ink">Remove this room</h3>
          <DeleteRoomButton roomId={room.id} title={room.title} />
        </div>
      </section>
    </main>
  );
}
