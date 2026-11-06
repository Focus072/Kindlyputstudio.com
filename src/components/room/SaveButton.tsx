"use client";

import { Check, Download, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  /** The download route, e.g. /r/slug/download/fileId. */
  href: string;
  className: string;
};

type State =
  | { step: "idle" }
  | { step: "loading"; progress: number | null }
  | { step: "ready"; file: File }
  | { step: "saved" };

/**
 * Phones that can share files (iPhone, Android) save the original straight to
 * Photos through the share sheet: tap once to fetch it with a progress ring,
 * tap "Save" to open the sheet. Everything else keeps the plain download link.
 */
function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  if (!navigator.canShare || !window.matchMedia("(pointer: coarse)").matches) return false;
  try {
    return navigator.canShare({ files: [new File([""], "check.jpg", { type: "image/jpeg" })] });
  } catch {
    return false;
  }
}

export function SaveButton({ href, className }: Props) {
  const [state, setState] = useState<State>({ step: "idle" });
  const abort = useRef<AbortController | null>(null);

  // Stop a fetch still running when the viewer moves on (the parent keys this by file).
  useEffect(() => () => abort.current?.abort(), []);

  async function fetchFile() {
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState({ step: "loading", progress: null });
    try {
      const meta = await fetch(`${href}?as=json`, { signal: ctrl.signal, cache: "no-store" });
      if (!meta.ok || !meta.headers.get("content-type")?.includes("json")) throw new Error("link");
      const { url, name, type } = (await meta.json()) as { url: string; name: string; type: string };
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok || !res.body) throw new Error("file");
      const total = Number(res.headers.get("content-length")) || 0;
      const reader = res.body.getReader();
      const parts: BlobPart[] = [];
      let got = 0;
      let shown = -1;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        got += value.length;
        const pct = total ? Math.min(99, Math.floor((got / total) * 100)) : -1;
        if (pct !== shown) {
          shown = pct;
          setState({ step: "loading", progress: pct });
        }
      }
      const file = new File(parts, name, { type: type || res.headers.get("content-type") || "application/octet-stream" });
      if (!navigator.canShare({ files: [file] })) throw new Error("type");
      setState({ step: "ready", file });
      // Most phones still count the first tap and open the sheet right away.
      // If too much time passed, the button now reads "Save" for a second tap.
      await share(file, true);
    } catch {
      if (ctrl.signal.aborted) return;
      // Anything unexpected: fall back to the normal download.
      setState({ step: "idle" });
      window.location.href = href;
    }
  }

  async function share(file: File, auto = false) {
    try {
      await navigator.share({ files: [file] });
      setState({ step: "saved" });
    } catch (e) {
      const name = (e as Error).name;
      // Closing the sheet, or the first tap expiring while the file loaded:
      // keep the file ready so the next tap opens the sheet.
      if (name === "AbortError" || (auto && name === "NotAllowedError")) return;
      window.location.href = href;
    }
  }

  return (
    <a
      href={href}
      onClick={(e) => {
        if (state.step === "loading") {
          e.preventDefault();
          return;
        }
        if (state.step === "ready") {
          e.preventDefault();
          share(state.file);
          return;
        }
        if (!canShareFiles()) return;
        e.preventDefault();
        fetchFile();
      }}
      aria-label={state.step === "ready" ? "Save to your phone" : "Download"}
      className={`${className} ${state.step === "ready" ? "border-transparent bg-white font-semibold text-black hover:bg-white" : ""}`}
    >
      {state.step === "loading" ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          <span className="font-typewriter text-xs tabular-nums">{state.progress != null ? `${state.progress}%` : "…"}</span>
        </>
      ) : state.step === "ready" ? (
        <>
          <Download className="size-4" />
          <span>Save</span>
        </>
      ) : state.step === "saved" ? (
        <>
          <Check className="size-4" />
          <span className="hidden sm:inline">Download</span>
        </>
      ) : (
        <>
          <Download className="size-4" />
          <span className="hidden sm:inline">Download</span>
        </>
      )}
    </a>
  );
}
