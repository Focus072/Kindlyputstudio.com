import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { previewUrl } from "@/lib/storage";

export type ShowcaseShoot = {
  id: string;
  client: string;
  label: string;
  cover: string;
  coverLarge: string;
  photos: { thumb: string; full: string }[];
  photoCount: number;
};

/** Turns "10/30/2026 · Foreign Fleet · Day 2 (M3, AMG, M4)" into "Day 2 (M3, AMG, M4)". */
function shootLabel(title: string, client: string): string {
  const parts = title.split("·").map((p) => p.trim()).filter(Boolean);
  const rest = parts.filter((p) => !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(p) && p.toLowerCase() !== client.toLowerCase());
  return rest.join(" · ") || title;
}

/** Recent shoots for the public home page. Only rooms marked "showcase", photos only. */
export async function listShowcase(limit = 6): Promise<ShowcaseShoot[]> {
  try {
    const db = supabaseAdmin();
    const { data: rooms } = await db
      .from("rooms")
      .select("id, title, client_name, hero_file_id, created_at")
      .eq("showcase", true)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(24);
    if (!rooms?.length) return [];
    const { data: files } = await db
      .from("files")
      .select("id, room_id, thumb_path, preview_path, sort_order")
      .in("room_id", rooms.map((r) => r.id))
      .eq("kind", "image")
      .not("thumb_path", "is", null)
      .order("sort_order");

    const shoots: ShowcaseShoot[] = [];
    for (const r of rooms) {
      const own = (files ?? []).filter((f) => f.room_id === r.id);
      if (!own.length) continue;
      const hero = own.find((f) => f.id === r.hero_file_id) ?? own[0];
      shoots.push({
        id: r.id,
        client: r.client_name,
        label: shootLabel(r.title, r.client_name),
        cover: previewUrl(hero.thumb_path)!,
        coverLarge: previewUrl(hero.preview_path ?? hero.thumb_path)!,
        photos: own.slice(0, 12).map((f) => ({
          thumb: previewUrl(f.thumb_path)!,
          full: previewUrl(f.preview_path ?? f.thumb_path)!,
        })),
        photoCount: own.length,
      });
      if (shoots.length >= limit) break;
    }
    return shoots;
  } catch {
    // The home page should never fail because the showcase could not load.
    return [];
  }
}
