import "server-only";
/**
 * THE ONLY FILE THAT TOUCHES THE WEBSITE'S OWN HELPERS.
 *
 * Connects the AI Team to the site's existing pieces:
 *   - the studio login from src/lib/auth.ts (admin_users: G and Mohhamed)
 *   - the server-only Supabase client from src/lib/supabase/admin.ts (secret key)
 *
 * Everything else in src/lib/ai-team and src/app/admin/ai-team imports from here.
 */
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminSession, requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface TeamMember {
  /** admin_users.id */
  id: string;
  /** What other team members see on messages, e.g. "G" or "Mohhamed". */
  displayName: string;
}

/**
 * The signed-in studio admin, or null. Never redirects, so API routes can
 * answer 401 instead of sending the browser to the login page. Cached per
 * request, so the layout and page share one lookup.
 */
export const getTeamMember = cache(async (): Promise<TeamMember | null> => {
  const session = await getAdminSession();
  if (!session) return null;
  const { data } = await supabaseAdmin()
    .from("admin_users")
    .select("id, username, display_name")
    .eq("id", session.userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    displayName: (data.display_name as string | null)?.trim() || (data.username as string | null) || "Team member",
  };
});

/**
 * Sends anyone who isn't signed in as a studio admin to /login, as the rest of
 * /admin does. Call at the top of every AI Team page and server action.
 */
export async function requireTeamMember(): Promise<TeamMember> {
  await requireAdmin();
  const member = await getTeamMember();
  // A valid cookie for an admin row that no longer exists.
  if (!member) redirect("/login");
  return member;
}

export function db(): SupabaseClient {
  return supabaseAdmin();
}
