import { Mail, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { setLeadStatus } from "./actions";

export const metadata = { title: "Leads" };

type Lead = {
  id: string;
  name: string;
  business: string | null;
  email: string;
  phone: string | null;
  service: string | null;
  message: string | null;
  status: "new" | "contacted" | "won" | "closed";
  created_at: string;
};

const tone: Record<Lead["status"], string> = {
  new: "bg-approve text-white",
  contacted: "bg-steel text-ink",
  won: "bg-ink text-white",
  closed: "bg-slate-100 text-slate-500",
};

export default async function LeadsPage() {
  await requireAdmin();
  const { data } = await supabaseAdmin().from("leads").select("*").order("created_at", { ascending: false }).limit(200);
  const leads = (data ?? []) as Lead[];
  const fresh = leads.filter((l) => l.status === "new").length;

  return (
    <main>
      <p className="font-typewriter text-sm text-slate-500">From the home page</p>
      <h1 className="font-display text-5xl uppercase leading-none text-ink">Leads</h1>
      <p className="mt-1 text-sm text-slate-500">
        {leads.length} total{fresh ? ` · ${fresh} new` : ""}. People who filled in &ldquo;Start a project&rdquo;.
      </p>

      {leads.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No leads yet. They show up here the moment someone sends the form on kindlyputstudio.com.
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {leads.map((l) => (
            <li key={l.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-ink [overflow-wrap:anywhere]">{l.name}</h2>
                  <p className="text-sm text-slate-500">
                    {[l.business, l.service].filter(Boolean).join(" · ") || "No details"}{" "}
                    <time dateTime={l.created_at} className="whitespace-nowrap">· {timeAgo(l.created_at)}</time>
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${tone[l.status]}`}>{l.status}</span>
              </div>
              {l.message && <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 [overflow-wrap:anywhere]">{l.message}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a href={`mailto:${l.email}`} className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-1.5 rounded-2xl bg-ink px-3.5 py-2 text-sm font-semibold text-white">
                  <Mail className="size-4 shrink-0" /> <span className="min-w-0 [overflow-wrap:anywhere]">{l.email}</span>
                </a>
                {l.phone && (
                  <a href={`tel:${l.phone}`} className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700">
                    <Phone className="size-4 shrink-0" /> <span className="[overflow-wrap:anywhere]">{l.phone}</span>
                  </a>
                )}
                <form action={setLeadStatus} aria-label={`Set status for ${l.name}`} className="flex w-full flex-wrap items-center gap-2 border-t border-slate-100 pt-3 sm:ml-auto sm:w-auto sm:border-0 sm:pt-0">
                  <span className="basis-full text-xs font-semibold text-slate-600 sm:basis-auto">Mark as</span>
                  <input type="hidden" name="id" value={l.id} />
                  {(["contacted", "won", "closed"] as const)
                    .filter((s) => s !== l.status)
                    .map((s) => (
                      <button key={s} name="status" value={s} aria-label={`Mark ${l.name} as ${s}`} className="min-h-11 rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold capitalize text-slate-600 transition-colors hover:border-ink hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                        {s}
                      </button>
                    ))}
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
