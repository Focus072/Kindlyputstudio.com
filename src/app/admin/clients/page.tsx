import Link from "next/link";
import { ClientAvatar } from "@/components/admin/ClientAvatar";
import { requireAdmin } from "@/lib/auth";
import { listClients } from "@/lib/clients-data";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  await requireAdmin();
  const [clients, params] = await Promise.all([listClients(), searchParams]);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 160) : "";
  const order = params.sort === "name" ? "name" : "recent";
  const term = query.toLowerCase();
  const matching = clients.filter((client) =>
    !term || [client.full_name, client.email].some((value) => value?.toLowerCase().includes(term)),
  );
  if (order === "name") {
    matching.sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""));
  }

  return (
    <main>
      <p className="font-typewriter text-sm text-slate-500">Client accounts</p>
      <h1 className="font-display text-5xl uppercase leading-none text-ink">Clients</h1>
      <p className="mt-1 text-sm text-slate-500">
        Everyone who created an account from a room link. {clients.length} total.
      </p>

      {(clients.length > 0 || query) && (
        <form action="/admin/clients" className="mt-6 grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <label className="min-w-0 text-sm font-semibold text-ink">
            Search by name or email
            <input type="search" name="q" defaultValue={query} maxLength={160} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-400 px-3 text-base sm:text-sm" />
          </label>
          <label className="text-sm font-semibold text-ink">
            Sort by
            <select name="sort" defaultValue={order} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-400 bg-white px-3 text-base sm:text-sm">
              <option value="recent">Last seen</option>
              <option value="name">Name</option>
            </select>
          </label>
          <button className="min-h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-white">Apply</button>
        </form>
      )}
      {clients.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No client accounts yet. They appear here the moment a client signs up from a room link.
        </div>
      ) : matching.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white p-5 text-sm text-slate-700 ring-1 ring-slate-200">
          No clients match your search. <Link href="/admin/clients" className="font-semibold underline">Clear search</Link>
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          {matching.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/clients/${c.id}`} className="flex items-center gap-4 px-4 py-4 hover:bg-slate-50 active:bg-slate-100 sm:px-5">
                <ClientAvatar name={c.full_name ?? c.email ?? "?"} url={c.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink [overflow-wrap:anywhere]">{c.full_name ?? "No name"}</p>
                  <p className="text-sm text-slate-600 [overflow-wrap:anywhere]">{c.email}</p>
                  <p className="mt-0.5 text-xs text-slate-600 sm:hidden">
                    {c.roomCount} {c.roomCount === 1 ? "room" : "rooms"} · {c.approvals} approved · last seen{" "}
                    {c.last_seen_at ? <time dateTime={c.last_seen_at}>{timeAgo(c.last_seen_at)}</time> : "never"}
                  </p>
                </div>
                <div className="hidden text-right text-xs text-slate-500 sm:block">
                  <p>
                    {c.roomCount} {c.roomCount === 1 ? "room" : "rooms"} · {c.approvals} {c.approvals === 1 ? "approval" : "approvals"} · {c.comments} {c.comments === 1 ? "comment" : "comments"}
                  </p>
                  <p>
                    {c.provider === "google" ? "Google" : "Email"} · last seen{" "}
                    {c.last_seen_at ? <time dateTime={c.last_seen_at}>{timeAgo(c.last_seen_at)}</time> : "never"}
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
