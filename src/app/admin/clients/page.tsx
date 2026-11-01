import Link from "next/link";
import { ClientAvatar } from "@/components/admin/ClientAvatar";
import { requireAdmin } from "@/lib/auth";
import { listClients } from "@/lib/clients-data";
import { timeAgo } from "@/lib/format";

export default async function ClientsPage() {
  await requireAdmin();
  const clients = await listClients();

  return (
    <main>
      <p className="font-typewriter text-sm text-slate-500">Client accounts</p>
      <h1 className="font-display text-5xl uppercase leading-none text-ink">Clients</h1>
      <p className="mt-1 text-sm text-slate-500">
        Everyone who created an account from a room link. {clients.length} total.
      </p>

      {clients.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No client accounts yet. They appear here the moment a client signs up from a room link.
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          {clients.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/clients/${c.id}`} className="flex items-center gap-4 px-4 py-4 hover:bg-slate-50 active:bg-slate-100 sm:px-5">
                <ClientAvatar name={c.full_name ?? c.email ?? "?"} url={c.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{c.full_name ?? "No name"}</p>
                  <p className="truncate text-sm text-slate-500">{c.email}</p>
                  <p className="mt-0.5 text-xs text-slate-400 sm:hidden">
                    {c.roomCount} {c.roomCount === 1 ? "room" : "rooms"} · {c.approvals} approved · seen {timeAgo(c.last_seen_at)}
                  </p>
                </div>
                <div className="hidden text-right text-xs text-slate-500 sm:block">
                  <p>
                    {c.roomCount} {c.roomCount === 1 ? "room" : "rooms"} · {c.approvals} approvals · {c.comments} comments
                  </p>
                  <p>
                    {c.provider === "google" ? "Google" : "Email"} · last seen {timeAgo(c.last_seen_at)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
