import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getClientUser } from "@/lib/client-auth";
import { clientMayOpen } from "@/lib/access";
import { shareGuestFor } from "@/lib/share-links";
import { canDownload, getRoomBySlug, isRoomOpen } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORIGINALS_BUCKET } from "@/lib/storage";

/**
 * Sends the client to a 2 minute signed link for the full resolution original.
 * With ?as=json it returns that link instead, so phones can fetch the file and
 * hand it to the share sheet ("Save Image" / "Save Video" straight to Photos).
 */
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/r/[slug]/download/[fileId]">,
) {
  const { slug, fileId } = await ctx.params;
  const room = await getRoomBySlug(slug);
  if (!room || !isRoomOpen(room)) return new Response("Not found", { status: 404 });
  const client = await getClientUser();
  const admin = await isAdmin();
  const asJson = req.nextUrl.searchParams.get("as") === "json";
  const member = admin || (client ? await clientMayOpen(room, client) : false);
  // No account, or not on the guest list: a live share link still lets them download.
  const guest = member ? null : await shareGuestFor(room);
  if (!member && !guest) return Response.redirect(new URL(`/r/${slug}`, req.url), 302);

  const db = supabaseAdmin();
  const { data: file } = await db
    .from("files")
    .select("id, original_path, file_name, mime_type, review_status")
    .eq("id", fileId)
    .eq("room_id", room.id)
    .maybeSingle();
  if (!file) return new Response("Not found", { status: 404 });
  if (!admin && !canDownload(room, file)) {
    return new Response(
      room.payment_status === "due"
        ? "Downloads open once the invoice is paid."
        : "The studio has not opened this file for download yet.",
      { status: 403 },
    );
  }

  const { data, error } = await db.storage
    .from(ORIGINALS_BUCKET)
    .createSignedUrl(file.original_path, 120, { download: file.file_name });
  if (error || !data) return new Response("Could not create download", { status: 500 });

  if (client && !guest) {
    await db.from("activity").insert({ room_id: room.id, file_id: file.id, type: "download", client_id: client.id, actor_name: client.name });
  } else if (guest) {
    await db.from("activity").insert({ room_id: room.id, file_id: file.id, type: "download", actor_name: `${guest.name} (guest link)`, viewer_id: `share:${guest.linkId}` });
  }
  if (asJson) {
    return Response.json(
      { url: data.signedUrl, name: file.file_name, type: file.mime_type },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.redirect(data.signedUrl, 302);
}
