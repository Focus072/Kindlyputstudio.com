import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
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

export default async function AdminRoomPage({ params }: PageProps<"/admin/rooms/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const room = await getRoomById(id);
  if (!room) notFound();
  const [{ files, stats, hero }, roomClients] = await Promise.all([loadRoomBundle(room), clientsForRoom(room.id)]);

  return (
    <main className="space-y-10">
      <div>
        <Link href="/admin" className="text-sm text-slate-500 hover:text-ink">← All rooms</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-typewriter text-sm text-slate-500">Prepared for {room.client_name}</p>
            <h1 className="truncate font-display text-4xl uppercase text-ink sm:text-5xl">{room.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyLink path={`/r/${room.slug}`} label="Copy client link" />
            <a
              href={`/r/${room.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white"
            >
              Open room <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
          <div><dt className="inline">Views </dt><dd className="inline font-bold text-ink">{stats.views}</dd></div>
          <div><dt className="inline">Comments </dt><dd className="inline font-bold text-ink">{stats.comments}</dd></div>
          <div><dt className="inline">Approved </dt><dd className="inline font-bold text-approve">{stats.approved}</dd></div>
          <div><dt className="inline">Changes </dt><dd className="inline font-bold text-decline">{stats.changes}</dd></div>
          <div><dt className="inline">Pending </dt><dd className="inline font-bold text-ink">{stats.pending}</dd></div>
        </dl>
      </div>

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
        <AdminFileGrid roomId={room.id} files={files} heroId={hero?.id ?? null} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Room settings</h2>
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <RoomForm action={updateRoom.bind(null, room.id)} room={room} submitLabel="Save changes" />
        </div>
        <div className="mt-4">
          <DeleteRoomButton roomId={room.id} title={room.title} />
        </div>
      </section>
    </main>
  );
}
