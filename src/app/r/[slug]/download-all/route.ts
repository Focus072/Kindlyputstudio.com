import type { NextRequest } from "next/server";
import { downloadZip } from "client-zip";
import { isAdmin } from "@/lib/auth";
import { getClientUser } from "@/lib/client-auth";
import { getFiles, getRoomBySlug, isRoomOpen } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORIGINALS_BUCKET } from "@/lib/storage";
import { slugify } from "@/lib/slug";

// Large galleries take a while to stream. Vercel allows up to 300s on every plan.
export const maxDuration = 300;

/** Streams every original in the room as one zip, without holding it in memory. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/r/[slug]/download-all">,
) {
  const { slug } = await ctx.params;
  const room = await getRoomBySlug(slug);
  if (!room || !isRoomOpen(room)) return new Response("Not found", { status: 404 });
  const client = await getClientUser();
  const admin = await isAdmin();
  if (!client && !admin) return Response.redirect(new URL(`/r/${slug}`, _req.url), 302);

  const files = await getFiles(room.id);
  if (files.length === 0) return new Response("No files yet", { status: 404 });

  const db = supabaseAdmin();
  const { data: signed, error } = await db.storage
    .from(ORIGINALS_BUCKET)
    .createSignedUrls(files.map((f) => f.original_path), 60 * 30);
  if (error || !signed) return new Response("Could not prepare download", { status: 500 });

  if (client) {
    await db.from("activity").insert({ room_id: room.id, type: "download", client_id: client.id, actor_name: client.name });
  }

  const usedNames = new Set<string>();
  function uniqueName(name: string) {
    let candidate = name;
    let i = 2;
    while (usedNames.has(candidate.toLowerCase())) {
      const dot = name.lastIndexOf(".");
      candidate = dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`;
      i++;
    }
    usedNames.add(candidate.toLowerCase());
    return candidate;
  }

  async function* entries() {
    for (let i = 0; i < files.length; i++) {
      const url = signed![i]?.signedUrl;
      if (!url) continue;
      const res = await fetch(url);
      if (!res.ok || !res.body) continue;
      yield { name: uniqueName(files[i].file_name), input: res };
    }
  }

  const zipName = `${slugify(room.title) || "delivery"}-kindly-put.zip`;
  const zip = downloadZip(entries());
  return new Response(zip.body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "no-store",
    },
  });
}
