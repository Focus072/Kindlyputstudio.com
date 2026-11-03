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
import { getRoomById, loadRoomBundle } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { ClientAvatar } from "@/components/admin/ClientAvatar";
import { RoomAccess } from "@/components/admin/RoomAccess";
import { listAccessRequests, listInvites } from "@/lib/access";

export default async function AdminRoomPage({ params }: PageProps<"/admin/rooms/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const room = await getRoomById(id);
  if (!room) notFound();
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
            <p className="font-typewriter text-sm text-slate-500">Prepared for {room.client_name}</p>
            <h1 className="mt-1 break-words font-display text-[2.6rem] uppercase leading-[0.95] text-ink sm:text-5xl">{room.title}</h1>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <CopyLink path={`/r/${room.slug}`} label="Copy link" className="justify-center py-2.5" />
            <a
              href={`/r/${room.slug}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white"
            >
              Open room <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-5 divide-x divide-slate-100 rounded-2xl bg-white py-3 text-center shadow-sm ring-1 ring-slate-200">
          {[
            { label: "Views", value: stats.views, tone: "text-ink" },
            { label: "Notes", value: stats.comments, tone: "text-ink" },
            { label: "Approved", value: stats.approved, tone: "text-approve" },
            { label: "Changes", value: stats.changes, tone: "text-decline" },
            { label: "Pending", value: stats.pending, tone: "text-ink" },
          ].map((s) => (
            <div key={s.label} className="min-w-0 px-1">
              <dd className={`text-lg font-bold tabular-nums sm:text-2xl ${s.value ? s.tone : "text-ink/30"}`}>{s.value}</dd>
              <dt className="truncate text-[9px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[11px]">{s.label}</dt>
            </div>
          ))}
        </dl>
      </div>

      {room.feedback_sent_at && (
        <p className="rounded-2xl bg-approve/10 px-4 py-3 text-sm font-semibold text-approve ring-1 ring-approve/30">
          The client sent their feedback {timeAgo(room.feedback_sent_at)}: {stats.approved} approved, {stats.changes} need changes, {stats.pending} not reviewed.
        </p>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Who can open this room</h2>
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
          <p className="text-sm text-slate-500">Nobody has opened this room yet. Send the client link to get started.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {roomClients.map(({ client, lastOpened }) => (
              <li key={client!.id}>
                <Link
                  href={`/admin/clients/${client!.id}`}
                  className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-sm shadow-sm ring-1 ring-slate-200 hover:ring-slate-300"
                >
                  <ClientAvatar name={client!.full_name ?? client!.email ?? "?"} url={client!.avatar_url} size="size-7" />
                  <span className="font-semibold text-ink">{client!.full_name ?? client!.email}</span>
                  <span className="text-xs text-slate-400">{timeAgo(lastOpened)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Upload files</h2>
        <Uploader roomId={room.id} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Files ({files.length})</h2>
        <AdminFileGrid roomId={room.id} slug={room.slug} files={files} heroId={hero?.id ?? null} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Room settings</h2>
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <RoomForm action={updateRoom.bind(null, room.id)} room={room} submitLabel="Save changes" />
        </div>
        <div className="mt-4">
          <DeleteRoomButton roomId={room.id} title={room.title} />
        </div>
      </section>
    </main>
  );
}
