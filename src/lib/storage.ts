import "server-only";
import { supabaseUrl } from "@/lib/env";

export const PREVIEWS_BUCKET = "previews";
export const ORIGINALS_BUCKET = "originals";

/** CDN URL for a file in the public previews bucket. */
export function previewUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${supabaseUrl()}/storage/v1/object/public/${PREVIEWS_BUCKET}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
