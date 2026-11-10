import type { NextRequest } from "next/server";
import { downloadZip } from "client-zip";
import { isAdmin } from "@/lib/auth";
import { getClientUser } from "@/lib/client-auth";
import { clientMayOpen } from "@/lib/access";
import { shareGuestFor } from "@/lib/share-links";
import { canDownload, currentFiles, getFiles, getRoomBySlug, isRoomOpen } from "@/lib/data";
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
  const member = admin || (client ? await clientMayOpen(room, client) : false);
  // No account, or not on the guest list: a live share link still lets them download.
  const guest = member ? null : await shareGuestFor(room);
  if (!member && !guest) return Response.redirect(new URL(`/r/${slug}`, _req.url), 302);

  const files = currentFiles(await getFiles(room.id)).filter((f) => admin || canDownload(room, f));
  if (files.length === 0) return new Response("No files are open for download yet.", { status: 404 });

  const db = supabaseAdmin();
  const { data: signed, error } = await db.storage
    .from(ORIGINALS_BUCKET)
    .createSignedUrls(files.map((f) => f.original_path), 60 * 30);
  if (error || !signed) return new Response("Could not prepare download", { status: 500 });

  if (client && !guest) {
    await db.from("activity").insert({ room_id: room.id, type: "download", client_id: client.id, actor_name: client.name });
  } else if (guest) {
    await db.from("activity").insert({ room_id: room.id, type: "download", actor_name: `${guest.name} (guest link)`, viewer_id: `share:${guest.linkId}` });
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

  // Start each file's request a few files ahead, so the zip never waits on a
  // fresh connection between files. Bodies are pulled one at a time, in order.
  const AHEAD = 4;
  const pending = new Map<number, Promise<Response | null>>();
  function request(i: number) {
    const url = signed![i]?.signedUrl;
    if (!url || pending.has(i)) return;
    pending.set(i, fetch(url).catch(() => null));
  }

  async function* entries() {
    for (let i = 0; i < files.length; i++) {
      for (let j = i; j < Math.min(files.length, i + AHEAD); j++) request(j);
      const res = await (pending.get(i) ?? Promise.resolve(null));
      pending.delete(i);
      if (!res || !res.ok || !res.body) {
        await res?.body?.cancel().catch(() => {});
        continue;
      }
      // Files in a set go into a folder named after it.
      const folder = files[i].category?.trim().replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60);
      yield { name: uniqueName(folder ? `${folder}/${files[i].file_name}` : files[i].file_name), input: res };
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
