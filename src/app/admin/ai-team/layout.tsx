import { requireTeamMember } from "@/lib/ai-team/adapter";
import "./ai-team.css";

export const dynamic = "force-dynamic";

/** Sits inside the existing /admin layout. requireAdmin() still guards every page. */
export default async function AiTeamLayout({ children }: { children: React.ReactNode }) {
  await requireTeamMember();
  return <div className="ait">{children}</div>;
}
