"use client";

import { CheckCircle2, CloudUpload, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { refreshRoom } from "@/app/admin/actions";
import { uploadToRoom } from "@/lib/upload-client";

type Item = {
  id: string;
  name: string;
  size: number;
  progress: number;
  state: "queued" | "processing" | "uploading" | "done" | "error";
  error?: string;
};

const CONCURRENCY = 3;

function formatSize(bytes: number) {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

export function Uploader({ roomId }: { roomId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const busy = items.some((i) => i.state !== "done" && i.state !== "error");

  function patch(id: string, p: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }

  async function uploadOne(file: File, id: string) {
    try {
      await uploadToRoom(roomId, file, {
        onStage: (stage) => patch(id, { state: stage }),
        onProgress: (f) => patch(id, { progress: f }),
      });
      patch(id, { state: "done", progress: 1 });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      patch(id, {
        state: "error",
        error: /maximum allowed size|too large|413/i.test(message)
          ? "File is bigger than your Supabase upload limit."
          : message,
      });
    }
  }

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (files.length === 0) return;
    const queued = files.map((file) => ({
      file,
      item: {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        progress: 0,
        state: "queued" as const,
      },
    }));
    setItems((prev) => [...queued.map((q) => q.item), ...prev.filter((p) => p.state !== "done")]);

    // Upload in order with a few at a time, so the grid order matches your selection.
    let next = 0;
    async function worker() {
      while (next < queued.length) {
        const q = queued[next++];
        await uploadOne(q.file, q.item.id);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queued.length) }, worker));
    await refreshRoom(roomId);
    router.refresh();
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? "border-brand bg-brand/5" : "border-slate-300 bg-white hover:border-slate-400"
        }`}
      >
        <CloudUpload className="size-8 text-slate-400" />
        <p className="mt-3 font-bold text-ink">Drop photos and videos here</p>
        <p className="mt-1 text-sm text-slate-500">or <span className="pointer-fine:hidden">tap</span><span className="hidden pointer-fine:inline">click</span> to choose files. JPG, PNG, HEIC, WebP, MP4, MOV. Big files resume if the connection drops.</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-200">
              {item.state === "done" ? (
                <CheckCircle2 className="size-4 shrink-0 text-approve" />
              ) : item.state === "error" ? (
                <XCircle className="size-4 shrink-0 text-red-500" />
              ) : (
                <Loader2 className="size-4 shrink-0 animate-spin text-slate-400" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3">
                  <span className="truncate font-medium text-slate-800">{item.name}</span>
                  <span className="shrink-0 text-slate-400">{formatSize(item.size)}</span>
                </div>
                {item.state === "error" ? (
                  <p className="text-xs text-red-600">{item.error}</p>
                ) : (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand transition-[width] duration-300"
                      style={{ width: `${Math.round((item.state === "processing" ? 0.02 : item.progress) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {busy && <p className="mt-3 text-xs text-slate-500">Keep this tab open until uploads finish.</p>}
    </div>
  );
}
