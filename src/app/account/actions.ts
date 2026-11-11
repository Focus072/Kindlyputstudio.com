"use server";

import { redirect } from "next/navigation";
import { getClientUser } from "@/lib/client-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseForRequest } from "@/lib/supabase/server";

/**
 * "Delete my account" on /account. Removes the client's login and profile and
 * their link to every room. Notes they left stay with the studio's project
 * record under their name, as the privacy policy describes.
 */
export async function deleteMyAccount(): Promise<{ error: string } | undefined> {
  const client = await getClientUser();
  if (!client) return { error: "Please sign in again first." };
  const db = supabaseAdmin();
  const { error } = await db.from("clients").delete().eq("id", client.id);
  if (error) return { error: "Could not delete your account. Please try again." };
  const { error: authError } = await db.auth.admin.deleteUser(client.id);
  if (authError) return { error: "Could not delete your login. Please try again or contact the studio." };
  try {
    const supabase = await supabaseForRequest();
    await supabase.auth.signOut();
  } catch {
    /* the session is already gone */
  }
  redirect("/");
}
