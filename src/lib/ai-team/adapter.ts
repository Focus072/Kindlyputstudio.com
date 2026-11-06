import "server-only";
/**
 * THE ONLY FILE THAT TOUCHES THE WEBSITE'S OWN HELPERS.
 *
 * Point these two functions at the website's existing pieces:
 *   - requireAdmin() from src/lib/auth.ts (studio login for G and Mohhamed)
 *   - the existing server-only Supabase client (service role)
 *
 * Everything else in src/lib/ai-team and src/app/admin/ai-team imports from
 * here, so nothing else needs to change if those helpers are named
 * differently. Check the two TODOs below against the real code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";
// TODO(adapt): replace with the website's real server-only Supabase helper.
import { getSupabaseAdmin } from "@/lib/supabase-server";

export interface TeamMember {
  /** admin_users.id */
  id: string;
  /** What other team members see on messages, e.g. "G" or "Mohhamed". */
  displayName: string;
}

/** Redirects or throws (as the website already does) when not signed in as an admin. */
export async function requireTeamMember(): Promise<TeamMember> {
  const admin = await requireAdmin();
  // TODO(adapt): map whatever requireAdmin() returns. admin_users has
  // id, username, display_name, role.
  const a = admin as unknown as { id: string; display_name?: string | null; username?: string | null };
  return { id: a.id, displayName: a.display_name || a.username || "Team member" };
}

export function db(): SupabaseClient {
  return getSupabaseAdmin();
}
