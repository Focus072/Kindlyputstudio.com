"use client";

import { createUploadTarget, registerFile } from "@/app/admin/actions";
import { fileKind, processFile, uploadWithProgress } from "@/lib/media";

/** Files above this go up in resumable 6 MB chunks that survive Wi-Fi drops. */
const RESUMABLE_OVER = 6 * 1024 * 1024;

async function withRetry<T>(run: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await run();
    } catch (e) {
      last = e;
      // Size limits and bad requests will not fix themselves.
      if (e instanceof Error && /maximum allowed size|too large|413|400|already exists/i.test(e.message)) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

async function resumableUpload(
  file: File,
  target: { endpoint: string; apiKey: string; bucket: string; path: string; token: string },
  onProgress: (f: number) => void,
) {
  const { Upload } = await import("tus-js-client");
  return new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: target.endpoint,
      retryDelays: [0, 2000, 5000, 10000, 20000, 30000],
      headers: { "x-signature": target.token, apikey: target.apiKey, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: target.bucket,
        objectName: target.path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "31536000",
      },
      // Supabase requires exactly 6 MB chunks.
      chunkSize: 6 * 1024 * 1024,
      onError: (err) => reject(err),
      onProgress: (sent, total) => onProgress(total ? sent / total : 0),
      onSuccess: () => resolve(),
    });
    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(() => upload.start());
  });
}

/**
 * Makes previews in the browser, uploads the original (resumable for big
 * files, with retries), then saves the file record. Pass replaceOf to upload
 * a new version of an existing file.
 */
export async function uploadToRoom(
  roomId: string,
  file: File,
  opts: { onStage?: (s: "processing" | "uploading") => void; onProgress?: (f: number) => void; replaceOf?: string | null } = {},
) {
  const kind = fileKind(file);
  if (!kind) throw new Error("Only photos and videos are supported.");
  opts.onStage?.("processing");
  const processed = await processFile(file, kind);
  const target = await createUploadTarget(roomId, { name: file.name, kind, withPreviews: !!processed.thumb });

  opts.onStage?.("uploading");
  const progress = opts.onProgress ?? (() => {});
  const extras: Promise<void>[] = [];
  if (target.thumb && processed.thumb) extras.push(withRetry(() => uploadWithProgress(target.thumb!.url, processed.thumb!, "image/webp")));
  if (target.preview && processed.preview) extras.push(withRetry(() => uploadWithProgress(target.preview!.url, processed.preview!, "image/webp")));
  if (target.poster && processed.poster) extras.push(withRetry(() => uploadWithProgress(target.poster!.url, processed.poster!, "image/webp")));

  async function original() {
    if (file.size > RESUMABLE_OVER) {
      try {
        await resumableUpload(
          file,
          { ...target.resumable, bucket: target.original.bucket, path: target.original.path, token: target.original.token },
          progress,
        );
        return;
      } catch (e) {
        // If the resumable endpoint refuses outright, fall back to one plain upload.
        const message = e instanceof Error ? e.message : String(e);
        if (/maximum allowed size|too large|413/i.test(message)) throw new Error("File is bigger than your Supabase upload limit.");
        progress(0);
      }
    }
    await withRetry(() => uploadWithProgress(target.original.url, file, file.type, progress));
  }

  await Promise.all([original(), ...extras]);

  return registerFile(roomId, {
    key: target.key,
    name: file.name,
    mimeType: file.type,
    kind,
    size: file.size,
    width: processed.width,
    height: processed.height,
    duration: processed.duration,
    hasPreview: !!(target.preview && processed.preview),
    hasThumb: !!(target.thumb && processed.thumb),
    hasPoster: !!(target.poster && processed.poster),
    replaceOf: opts.replaceOf ?? null,
  });
}
