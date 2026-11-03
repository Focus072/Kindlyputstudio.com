import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getClientUser } from "@/lib/client-auth";
import { clientMayOpen } from "@/lib/access";
import { canDownload, getRoomBySlug, isRoomOpen } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORIGINALS_BUCKET } from "@/lib/storage";

/** Sends the client to a 2 minute signed link for the full resolution original. */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/r/[slug]/download/[fileId]">,
) {
  const { slug, fileId } = await ctx.params;
  const room = await getRoomBySlug(slug);
  if (!room || !isRoomOpen(room)) return new Response("Not found", { status: 404 });
  const client = await getClientUser();
  const admin = await isAdmin();
  if (!client && !admin) return Response.redirect(new URL(`/r/${slug}`, _req.url), 302);
  if (!admin && client && !(await clientMayOpen(room, client))) return Response.redirect(new URL(`/r/${slug}`, _req.url), 302);

  const db = supabaseAdmin();
  const { data: file } = await db
    .from("files")
    .select("id, original_path, file_name, review_status")
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

  if (client) {
    await db.from("activity").insert({ room_id: room.id, file_id: file.id, type: "download", client_id: client.id, actor_name: client.name });
  }
  return Response.redirect(data.signedUrl, 302);
}
