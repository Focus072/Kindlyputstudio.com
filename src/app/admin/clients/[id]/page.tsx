import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientAvatar } from "@/components/admin/ClientAvatar";
import { requireAdmin } from "@/lib/auth";
import { getClientDetail } from "@/lib/clients-data";
import { timeAgo } from "@/lib/format";

const verbs: Record<string, string> = {
  view: "Opened",
  approve: "Approved",
  decline: "Requested changes on",
  reset: "Undid review on",
  comment: "Commented on",
  download: "Downloaded from",
};

export default async function ClientDetailPage({ params }: PageProps<"/admin/clients/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const detail = await getClientDetail(id);
  if (!detail) notFound();
  const { client, rooms, activity } = detail;

  return (
    <main className="space-y-10">
      <div>
        <Link href="/admin/clients" className="text-sm text-slate-500 hover:text-ink max-sm:-my-2.5 max-sm:inline-block max-sm:py-2.5">← All clients</Link>
        <div className="mt-3 flex items-center gap-4">
          <ClientAvatar name={client.full_name ?? client.email ?? "?"} url={client.avatar_url} size="size-14" />
          <div className="min-w-0">
            <h1 className="break-words font-display text-4xl uppercase leading-none text-ink">{client.full_name ?? "No name"}</h1>
            <p className="mt-1 break-all text-sm text-slate-500">
              {client.email} · {client.provider === "google" ? "Google account" : "Email account"} · joined{" "}
              {timeAgo(client.created_at)}
            </p>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Rooms ({rooms.length})</h2>
        {rooms.length === 0 ? (
          <p className="text-sm text-slate-500">This client has not opened any rooms yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            {rooms.map(({ room, firstOpened, lastOpened }) => (
              <li key={room!.id}>
                <Link href={`/admin/rooms/${room!.id}`} className="flex flex-col gap-1.5 px-4 py-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink max-sm:line-clamp-2 max-sm:[overflow-wrap:anywhere] sm:truncate">{room!.title}</p>
                    <p className="text-xs text-slate-500">Prepared for {room!.client_name}</p>
                  </div>
                  <p className="text-xs text-slate-500 sm:shrink-0 sm:text-right">
                    First opened {timeAgo(firstOpened)}
                    <br />
                    Last opened {timeAgo(lastOpened)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-slate-500">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {activity.map((a) => (
              <li key={a.id} className="flex justify-between gap-4 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-slate-200">
                <span className="min-w-0 text-slate-700 max-sm:line-clamp-2 max-sm:[overflow-wrap:anywhere] sm:truncate">
                  {verbs[a.type] ?? a.type} {a.file ? <strong>{a.file}</strong> : null}
                  {a.file && a.room ? " in " : ""}
                  {a.room ? <span className="text-slate-500">{a.room}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
