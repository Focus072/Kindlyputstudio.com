import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getRoomBySlug, isRoomOpen } from "@/lib/data";
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

  const db = supabaseAdmin();
  const { data: file } = await db
    .from("files")
    .select("id, original_path, file_name")
    .eq("id", fileId)
    .eq("room_id", room.id)
    .maybeSingle();
  if (!file) return new Response("Not found", { status: 404 });

  const { data, error } = await db.storage
    .from(ORIGINALS_BUCKET)
    .createSignedUrl(file.original_path, 120, { download: file.file_name });
  if (error || !data) return new Response("Could not create download", { status: 500 });

  if (!(await isAdmin())) {
    await db.from("activity").insert({ room_id: room.id, file_id: file.id, type: "download" });
  }
  return Response.redirect(data.signedUrl, 302);
}
