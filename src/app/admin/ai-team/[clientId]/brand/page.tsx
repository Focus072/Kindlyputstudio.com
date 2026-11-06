import Link from "next/link";
import { requireTeamMember } from "@/lib/ai-team/adapter";
import { BASE, clientPath } from "../../paths";
import { notFound } from "next/navigation";
import { getClient, listGuidelines } from "@/lib/ai-team/store";
import { upsertGuideline } from "../../actions";
import { when } from "@/lib/ai-team/format";

function GuidelineForm({ client, g }: { client: string; g?: { id: string; title: string; body: string; status: string } }) {
  return (
    <form action={upsertGuideline}>
      <input type="hidden" name="client" value={client} />
      {g && <input type="hidden" name="id" value={g.id} />}
      <div className="field">
        <label>Title</label>
        <input name="title" defaultValue={g?.title} placeholder="e.g. Voice and tone, Colors and type, Photo style" required />
      </div>
      <div className="field">
        <label>Guideline</label>
        <textarea name="body" rows={g ? 10 : 6} defaultValue={g?.body} required
          placeholder="Write it the way you'd brief a new team member. Include do's and don'ts and real examples." />
      </div>
      <div className="row">
        <select name="status" defaultValue={g?.status ?? "draft"} style={{ width: "auto" }}>
          <option value="draft">Draft (not shared with specialists)</option>
          <option value="approved">Approved (shared with all specialists)</option>
          {g && <option value="archived">Archive</option>}
        </select>
        <button type="submit">{g ? "Save changes" : "Add guideline"}</button>
      </div>
    </form>
  );
}

export default async function BrandPage({ params }: { params: Promise<{ clientId: string }> }) {
  await requireTeamMember();
  const { clientId } = await params;
  const client = await getClient(clientId);
  if (!client) notFound();
  const guidelines = await listGuidelines(client.id);

  return (
    <main className="page stack">
      <div className="crumbs">
        <Link href={BASE}>AI Team</Link> / <Link href={`${clientPath(client.id)}`}>{client.name}</Link> / Brand guidelines
      </div>
      <h1>Brand guidelines for {client.name}</h1>
      <p className="muted">
        Approved guidelines are included in every specialist&apos;s context for this client only. Drafts stay private until
        you approve them. File uploads for logos and reference images are planned for a later stage; for now, describe them
        in text.
      </p>

      {guidelines.map((g) => (
        <section key={g.id} className="card">
          <div className="row between">
            <h2 style={{ margin: 0 }}>{g.title}</h2>
            <span className={`badge ${g.status}`}>{g.status}</span>
          </div>
          <p className="small muted">
            Updated {when(g.updated_at)}{g.updated_by_name ? ` by ${g.updated_by_name}` : ""}
          </p>
          <div className="pre" style={{ marginBottom: ".75rem" }}>{g.body}</div>
          <details>
            <summary>Edit</summary>
            <div style={{ marginTop: ".75rem" }}><GuidelineForm client={client.id} g={g} /></div>
          </details>
        </section>
      ))}

      <section className="card">
        <h2>Add a guideline</h2>
        <GuidelineForm client={client.id} />
      </section>
    </main>
  );
}
