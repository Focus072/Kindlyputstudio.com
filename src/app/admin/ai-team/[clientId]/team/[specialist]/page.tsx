import Link from "next/link";
import { requireTeamMember } from "@/lib/ai-team/adapter";
import { BASE, clientPath } from "../../../paths";
import { notFound } from "next/navigation";
import { getClient, listCampaigns, listConversations } from "@/lib/ai-team/store";
import { getSpecialist, nextSpecialist } from "@/lib/ai-team/specialists";
import { Avatar, SpecialistBadge } from "@/components/ai-team/Avatar";
import { startConversation } from "../../../actions";
import { when } from "@/lib/ai-team/format";

export default async function SpecialistPage({ params }: { params: Promise<{ clientId: string; specialist: string }> }) {
  await requireTeamMember();
  const { clientId, specialist } = await params;
  const s = getSpecialist(specialist);
  const client = await getClient(clientId);
  if (!s || !client) notFound();
  const [conversations, campaigns] = await Promise.all([listConversations(client.id, s.id), listCampaigns(client.id)]);
  const next = nextSpecialist(s.id);

  return (
    <main className="page stack">
      <div className="crumbs">
        <Link href={BASE}>AI Team</Link> / <Link href={`${clientPath(client.id)}`}>{client.name}</Link> / {s.name}
      </div>
      <div className="person">
        <Avatar s={s} size={56} />
        <div>
          <h1 style={{ marginBottom: 0 }}>{s.name} <SpecialistBadge /></h1>
          <div className="muted">{s.role} · AI team member</div>
        </div>
      </div>
      <p>{s.summary}</p>

      <div className="cols">
        <section className="stack">
          <form action={startConversation} className="card">
            <h2>Start a conversation</h2>
            <input type="hidden" name="client" value={client.id} />
            <input type="hidden" name="specialist" value={s.id} />
            <div className="field">
              <label htmlFor="campaign">Campaign</label>
              <select id="campaign" name="campaign" defaultValue="">
                <option value="">No campaign (general chat)</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="small muted" style={{ marginTop: ".3rem" }}>
                {s.name} sees approved handoffs from the campaign you pick, plus this client&apos;s approved brand guidelines.
              </p>
            </div>
            <button type="submit">New chat with {s.name}</button>
          </form>

          <div>
            <h2>Saved conversations</h2>
            {conversations.length === 0 && <p className="muted">No conversations with {s.name} for {client.name} yet.</p>}
            <div className="stack">
              {conversations.map((c) => (
                <Link key={c.id} href={`${clientPath(client.id)}/chat/${c.id}`} className="card link">
                  <strong>{c.title}</strong>
                  <div className="small muted">
                    {c.message_count} messages
                    {c.campaign_id ? ` · ${campaigns.find((x) => x.id === c.campaign_id)?.name ?? "campaign"}` : ""} · started by{" "}
                    {c.created_by_name ?? "unknown"} · last active {when(c.updated_at)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <aside className="card small stack">
          <div>
            <h3>What {s.name} needs from you</h3>
            <ul>{s.needs.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
          <div>
            <h3>What {s.name} delivers</h3>
            <ul>{s.deliverables.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
          <div>
            <h3>Hands off to</h3>
            <p>{next ? `${next.name} (${next.role})` : "Human review by the Kindly Put team"}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
