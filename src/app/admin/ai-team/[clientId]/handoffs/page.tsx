import Link from "next/link";
import { requireTeamMember } from "@/lib/ai-team/adapter";
import { BASE, clientPath } from "../../paths";
import { notFound } from "next/navigation";
import { getClient, listHandoffs } from "@/lib/ai-team/store";
import { SPECIALISTS, getSpecialist } from "@/lib/ai-team/specialists";
import { Avatar } from "@/components/ai-team/Avatar";
import { reviewHandoff } from "../../actions";
import { day } from "@/lib/ai-team/format";

const STATUS_LABEL: Record<string, string> = {
  draft: "Waiting for approval",
  approved: "Approved",
  changes_requested: "Changes requested",
};

export default async function HandoffsPage({
  params, searchParams,
}: { params: Promise<{ clientId: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireTeamMember();
  const { clientId } = await params;
  const sp = await searchParams;
  const client = await getClient(clientId);
  if (!client) notFound();
  const handoffs = await listHandoffs(client.id);

  return (
    <main className="page stack">
      <div className="crumbs">
        <Link href={BASE}>AI Team</Link> / <Link href={`${clientPath(client.id)}`}>{client.name}</Link> / Handoffs
      </div>
      <h1>Handoffs and review queue</h1>
      <p className="muted">
        Specialists don&apos;t share memory. Work moves forward only through handoffs saved here. Once approved, a handoff is
        included in the context of later specialists working on the same campaign for {client.name}.
      </p>
      {sp.saved && <p className="notice">Draft handoff saved. Approve it below to share it with the next specialist.</p>}
      {handoffs.length === 0 && <p className="muted">No handoffs yet. Use &ldquo;Save as handoff&rdquo; under any specialist reply.</p>}

      {handoffs.map((h) => {
        const from = SPECIALISTS[h.from_specialist];
        const to = getSpecialist(h.to_stage);
        return (
          <section key={h.id} className="card">
            <div className="row between">
              <div className="person">
                <Avatar s={from} size={32} />
                <div>
                  <strong>{h.title}</strong>
                  <div className="small muted">
                    {from.name} → {to ? to.name : "Human review"}
                    {h.campaign_name ? ` · ${h.campaign_name}` : " · no campaign"} · saved by {h.created_by_name ?? "unknown"} on{" "}
                    {day(h.created_at)}
                    {h.approved_at && ` · approved by ${h.approved_by_name ?? "unknown"} on ${day(h.approved_at)}`}
                  </div>
                </div>
              </div>
              <span className={`badge ${h.status}`}>{STATUS_LABEL[h.status] ?? h.status}</span>
            </div>
            <details style={{ marginTop: ".6rem" }}>
              <summary>Read handoff</summary>
              <div className="pre" style={{ marginTop: ".5rem" }}>{h.content}</div>
              {h.source_conversation_id && (
                <p className="small"><Link href={`${clientPath(client.id)}/chat/${h.source_conversation_id}`}>Open the source conversation</Link></p>
              )}
            </details>
            <div className="row" style={{ marginTop: ".6rem" }}>
              {h.status !== "approved" && (
                <form action={reviewHandoff}>
                  <input type="hidden" name="client" value={client.id} />
                  <input type="hidden" name="id" value={h.id} />
                  <input type="hidden" name="status" value="approved" />
                  <button type="submit">Approve and share</button>
                </form>
              )}
              {h.status !== "changes_requested" && (
                <form action={reviewHandoff}>
                  <input type="hidden" name="client" value={client.id} />
                  <input type="hidden" name="id" value={h.id} />
                  <input type="hidden" name="status" value="changes_requested" />
                  <button type="submit" className="secondary">{h.status === "approved" ? "Withdraw approval" : "Request changes"}</button>
                </form>
              )}
              <form action={reviewHandoff}>
                <input type="hidden" name="client" value={client.id} />
                <input type="hidden" name="id" value={h.id} />
                <input type="hidden" name="status" value="archived" />
                <button type="submit" className="secondary">Archive</button>
              </form>
            </div>
          </section>
        );
      })}
    </main>
  );
}
