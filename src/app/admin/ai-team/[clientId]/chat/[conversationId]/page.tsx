import Link from "next/link";
import { requireTeamMember } from "@/lib/ai-team/adapter";
import { BASE, clientPath } from "../../../paths";
import { notFound } from "next/navigation";
import { getCampaign, getClient, getConversation, listMessages } from "@/lib/ai-team/store";
import { claudeConfigured } from "@/lib/ai-team/claude";
import { SPECIALISTS, nextSpecialist, ALL_SPECIALISTS } from "@/lib/ai-team/specialists";
import { Avatar, SpecialistBadge } from "@/components/ai-team/Avatar";
import { ChatView } from "@/components/ai-team/ChatView";
import { saveHandoff } from "../../../actions";

/** Pull the "Handoff to …" section out of a reply, if the specialist wrote one. */
function handoffSection(text: string) {
  const m = text.match(/^(#{1,4}\s*|\*\*)?(handoff to|ready for human review)[^\n]*\n/im);
  return m && m.index !== undefined ? text.slice(m.index).trim() : text;
}

export default async function ChatPage({ params }: { params: Promise<{ clientId: string; conversationId: string }> }) {
  await requireTeamMember();
  const { clientId, conversationId: id } = await params;
  const client = await getClient(clientId);
  if (!client) notFound();
  const convo = await getConversation(client.id, id);
  if (!convo) notFound();
  const [messages, campaign] = await Promise.all([
    listMessages(convo.id),
    convo.campaign_id ? getCampaign(client.id, convo.campaign_id) : Promise.resolve(null),
  ]);
  const s = SPECIALISTS[convo.specialist_id];
  const next = nextSpecialist(s.id);

  return (
    <div className="chat">
      <div className="chat-head">
        <div className="crumbs" style={{ marginBottom: ".35rem" }}>
          <Link href={BASE}>AI Team</Link> / <Link href={`${clientPath(client.id)}`}>{client.name}</Link> /{" "}
          <Link href={`${clientPath(client.id)}/team/${s.id}`}>{s.name}</Link>
        </div>
        <div className="person">
          <Avatar s={s} size={36} />
          <div>
            <strong>{s.name}</strong> <SpecialistBadge /> <span className="small muted">{s.role}</span>
            <div className="small muted">
              {convo.title} · {campaign ? `Campaign: ${campaign.name}` : "No campaign"}
            </div>
          </div>
        </div>
      </div>
      <ChatView
        key={convo.id}
        clientId={client.id}
        conversationId={convo.id}
        specialist={{ id: s.id, name: s.name, color: s.color, starters: s.starters }}
        claudeReady={claudeConfigured()}
        initial={messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          author: m.author_name,
          at: m.created_at,
          declined: m.role === "user" && m.stop_reason === "refusal",
        }))}
        handoffForms={Object.fromEntries(
          messages
            .filter((m) => m.role === "assistant")
            .map((m) => [
              m.id,
              <details key={m.id}>
                <summary>Save as handoff</summary>
                <form action={saveHandoff} style={{ marginTop: ".5rem" }}>
                  <input type="hidden" name="client" value={client.id} />
                  <input type="hidden" name="message" value={m.id} />
                  <div className="field">
                    <label>Title</label>
                    <input name="title" defaultValue={`${s.name} → ${next ? next.name : "Review"}: ${convo.title}`} required />
                  </div>
                  <div className="field">
                    <label>Send to</label>
                    <select name="to" defaultValue={next ? next.id : "review"}>
                      {ALL_SPECIALISTS.filter((x) => x.id !== s.id).map((x) => (
                        <option key={x.id} value={x.id}>{x.name} ({x.role})</option>
                      ))}
                      <option value="review">Human review</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Content (edit before saving if needed)</label>
                    <textarea name="content" rows={8} defaultValue={handoffSection(m.content)} />
                  </div>
                  <p className="small muted">
                    Saved as a draft. It&apos;s only shared with other specialists after someone approves it on the Handoffs page.
                  </p>
                  <button type="submit" className="secondary">Save draft handoff</button>
                </form>
              </details>,
            ]),
        )}
      />
    </div>
  );
}
