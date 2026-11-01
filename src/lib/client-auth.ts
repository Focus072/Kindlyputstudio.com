import "server-only";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseForRequest } from "@/lib/supabase/server";

export type ClientUser = {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  provider: string | null;
};

function toClient(user: User): ClientUser {
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const name =
    meta.full_name?.trim() ||
    meta.name?.trim() ||
    (user.email ? user.email.split("@")[0] : "Client");
  return {
    id: user.id,
    email: user.email ?? null,
    name: name.slice(0, 80),
    avatarUrl: meta.avatar_url || meta.picture || null,
    provider: (user.app_metadata?.provider as string | undefined) ?? null,
  };
}

/** The signed-in client for this request, or null. Verified with Supabase Auth. */
export async function getClientUser(): Promise<ClientUser | null> {
  try {
    const supabase = await supabaseForRequest();
    const { data } = await supabase.auth.getUser();
    return data.user ? toClient(data.user) : null;
  } catch {
    return null;
  }
}

/** Saves the client's profile and remembers that they opened this room. */
export async function recordClientVisit(client: ClientUser, roomId?: string) {
  const db = supabaseAdmin();
  const now = new Date().toISOString();
  await db.from("clients").upsert(
    {
      id: client.id,
      email: client.email,
      full_name: client.name,
      avatar_url: client.avatarUrl,
      provider: client.provider,
      last_seen_at: now,
    },
    { onConflict: "id" },
  );
  if (roomId) {
    const { data: existing } = await db
      .from("room_clients")
      .select("room_id")
      .eq("room_id", roomId)
      .eq("client_id", client.id)
      .maybeSingle();
    if (existing) {
      await db
        .from("room_clients")
        .update({ last_opened_at: now })
        .eq("room_id", roomId)
        .eq("client_id", client.id);
    } else {
      await db.from("room_clients").insert({ room_id: roomId, client_id: client.id });
    }
  }
}
