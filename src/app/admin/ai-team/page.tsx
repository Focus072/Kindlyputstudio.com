import Link from "next/link";
import { listClients } from "@/lib/ai-team/store";
import { claudeConfigured } from "@/lib/ai-team/claude";
import { ALL_SPECIALISTS } from "@/lib/ai-team/specialists";
import { Avatar, SpecialistBadge } from "@/components/ai-team/Avatar";
import { clientPath } from "./paths";

export default async function AiTeamHome() {
  const clients = await listClients();
  return (
    <main className="page stack">
      {!claudeConfigured() && (
        <p className="notice">
          Claude isn&apos;t connected yet. Add <code>ANTHROPIC_API_KEY</code> to the website&apos;s environment variables and the
          specialists will start replying.
        </p>
      )}
      <section>
        <h1>AI Team</h1>
        <p className="muted">
          Pick a client to work with the team. Each client&apos;s chats, brand guidelines, and handoffs are kept separate. Clients come
          from the studio&apos;s existing client list.
        </p>
        <div className="grid">
          {clients.map((c) => (
            <Link key={c.id} href={clientPath(c.id)} className="card link">
              <h3>
                {c.color && <span className="avatar" style={{ width: 10, height: 10, background: c.color, marginRight: 6 }} />}
                {c.name}
              </h3>
            </Link>
          ))}
          {clients.length === 0 && <p className="muted">No clients yet. Add one in the studio calendar first.</p>}
        </div>
      </section>
      <section>
        <h2>Your AI team</h2>
        <div className="grid">
          {ALL_SPECIALISTS.map((s) => (
            <div key={s.id} className="card">
              <div className="person">
                <Avatar s={s} />
                <div>
                  <strong>{s.name}</strong> <SpecialistBadge />
                  <div className="small muted">{s.role}</div>
                </div>
              </div>
              <p className="small" style={{ marginTop: ".6rem" }}>{s.summary}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
