"use client";

/**
 * Runs in your browser while you upload: makes a web sized preview and a
 * small grid thumbnail for each photo, and a poster frame for each video.
 * The original file is uploaded untouched for downloads.
 */

export const PREVIEW_MAX = 2400; // hero and full screen viewer
export const THUMB_MAX = 900; // grid tiles (sharp on retina phones)

export type Processed = {
  kind: "image" | "video";
  width: number | null;
  height: number | null;
  duration: number | null;
  preview: Blob | null;
  thumb: Blob | null;
  poster: Blob | null;
};

export function fileKind(file: File): "image" | "video" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif", "tif", "tiff"].includes(ext)) return "image";
  if (["mp4", "mov", "m4v", "webm"].includes(ext)) return "video";
  return null;
}

function fit(w: number, h: number, max: number) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

async function toWebp(source: CanvasImageSource, w: number, h: number, max: number, quality: number) {
  const size = fit(w, h, max);
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, size.w, size.h);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encode failed"))), "image/webp", quality),
  );
}

async function processImage(file: File): Promise<Processed> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = bitmap;
    const [preview, thumb] = await Promise.all([
      toWebp(bitmap, width, height, PREVIEW_MAX, 0.85),
      toWebp(bitmap, width, height, THUMB_MAX, 0.8),
    ]);
    return { kind: "image", width, height, duration: null, preview, thumb, poster: null };
  } finally {
    bitmap.close();
  }
}

function processVideo(file: File): Promise<Processed> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    const cleanup = () => URL.revokeObjectURL(url);
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Video took too long to read"));
    }, 20000);

    video.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error("Browser cannot read this video"));
    };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 0) * 0.1);
    };
    video.onseeked = async () => {
      clearTimeout(timer);
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        const [poster, thumb] = await Promise.all([
          toWebp(video, w, h, 1920, 0.82),
          toWebp(video, w, h, THUMB_MAX, 0.8),
        ]);
        resolve({
          kind: "video",
          width: w,
          height: h,
          duration: Number.isFinite(video.duration) ? Math.round(video.duration * 10) / 10 : null,
          preview: null,
          thumb,
          poster,
        });
      } catch (e) {
        reject(e);
      } finally {
        cleanup();
      }
    };
  });
}

/** Never throws: files the browser cannot read still upload, just without previews. */
export async function processFile(file: File, kind: "image" | "video"): Promise<Processed> {
  try {
    return kind === "image" ? await processImage(file) : await processVideo(file);
  } catch {
    return { kind, width: null, height: null, duration: null, preview: null, thumb: null, poster: null };
  }
}

/** PUT a file to a Supabase signed upload URL, reporting progress (0 to 1). */
export function uploadWithProgress(
  url: string,
  body: Blob,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType || "application/octet-stream");
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed?.message) message = parsed.message;
        } catch {
          /* keep default */
        }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(body);
  });
}
