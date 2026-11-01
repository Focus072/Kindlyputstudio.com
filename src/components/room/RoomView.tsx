"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addComment, recordView, setReview } from "@/app/r/[slug]/actions";
import { themeVars } from "@/config/themes";
import type { RoomFile, RoomStats } from "@/lib/types";
import { getViewerId, useViewerName } from "@/lib/viewer";
import { VerifiedDot } from "@/components/ui/VerifiedDot";
import { CommentSheet } from "./CommentSheet";
import { FileTile } from "./FileTile";
import { Lightbox } from "./Lightbox";
import { NamePrompt } from "./NamePrompt";
import { RoomBackdrop } from "./RoomBackdrop";
import { StatsLine } from "./StatsLine";

export type RoomViewProps = {
  room: {
    slug: string;
    title: string;
    clientName: string;
    deliveredBy: string;
    themePreset: string;
    accentColor: string | null;
  };
  files: RoomFile[];
  heroId: string | null;
  initialViews: number;
  brand: { name: string; logo: string | null; poweredByLabel: string };
  /** Admin preview: shows the room exactly as the client sees it, without tracking. */
  preview?: boolean;
};

const ease = [0.22, 1, 0.36, 1] as const;

export function RoomView({ room, files: initialFiles, heroId, initialViews, brand, preview }: RoomViewProps) {
  const [files, setFiles] = useState(initialFiles);
  const [name, setName] = useViewerName();
  const [askName, setAskName] = useState(false);
  const pendingAction = useRef<((name: string) => void) | null>(null);
  const [sheetFileId, setSheetFileId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (preview) return;
    const key = `kp:viewed:${room.slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    recordView(room.slug, getViewerId()).catch(() => {});
  }, [room.slug, preview]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const stats: RoomStats = useMemo(() => {
    const s: RoomStats = { views: initialViews, comments: 0, approved: 0, changes: 0, pending: 0 };
    for (const f of files) {
      s.comments += f.comments.length;
      if (f.status === "approved") s.approved++;
      else if (f.status === "changes") s.changes++;
      else s.pending++;
    }
    return s;
  }, [files, initialViews]);

  const hero = files.find((f) => f.id === heroId) ?? files.find((f) => f.kind === "image") ?? files[0];
  const sheetFile = files.find((f) => f.id === sheetFileId) ?? null;

  const withName = useCallback(
    (action: (name: string) => void) => {
      if (name) return action(name);
      pendingAction.current = action;
      setAskName(true);
    },
    [name],
  );

  function patchFile(id: string, patch: Partial<RoomFile>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function review(file: RoomFile, status: "approved" | "changes") {
    withName(async (who) => {
      const next = file.status === status ? "pending" : status;
      const before = { status: file.status, reviewedBy: file.reviewedBy };
      patchFile(file.id, { status: next, reviewedBy: next === "pending" ? null : who });
      const res = await setReview({
        slug: room.slug,
        fileId: file.id,
        status: next,
        name: who,
        viewerId: getViewerId(),
      }).catch(() => ({ ok: false as const, error: "Connection lost. Please try again." }));
      if (!res.ok) {
        patchFile(file.id, before);
        setToast(res.error);
      }
    });
  }

  function openComments(file: RoomFile) {
    withName(() => setSheetFileId(file.id));
  }

  async function sendComment(body: string): Promise<boolean> {
    if (!sheetFile || !name) return false;
    const res = await addComment({
      slug: room.slug,
      fileId: sheetFile.id,
      name,
      body,
      viewerId: getViewerId(),
    }).catch(() => ({ ok: false as const, error: "Connection lost. Please try again." }));
    if (!res.ok || !res.data) {
      setToast(res.ok ? "Could not post." : res.error);
      return false;
    }
    const { id, createdAt } = res.data;
    patchFile(sheetFile.id, {
      comments: [...sheetFile.comments, { id, author: name, body, fromAgency: false, createdAt }],
    });
    return true;
  }

  const heroIndex = hero ? files.findIndex((f) => f.id === hero.id) : -1;
  const heroImage = hero ? hero.previewUrl ?? hero.posterUrl ?? hero.thumbUrl : null;

  return (
    <div
      className="room-root relative min-h-dvh overflow-x-hidden text-room-fg"
      style={themeVars(room.themePreset, room.accentColor)}
    >
      <RoomBackdrop />

      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 pt-5 sm:px-8 sm:pt-7">
        <div className="flex items-center gap-2">
          {brand.logo ? (
            <img src={brand.logo} alt={brand.name} className="h-6 w-auto sm:h-7" />
          ) : (
            <span className="font-display text-lg uppercase tracking-wide">{brand.name}</span>
          )}
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-room-border bg-white/5 px-3 py-1.5 font-typewriter text-[11px] text-room-muted backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-room-accent" />
          Powered by <span className="text-room-fg">{brand.poweredByLabel}</span>
        </span>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <section className="grid gap-10 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end lg:gap-14 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
            className="min-w-0"
          >
            <div className="space-y-1.5 font-typewriter text-sm text-room-muted">
              <p>
                Prepared for <span className="font-bold uppercase text-room-fg">{room.clientName}</span>
              </p>
              <p className="flex items-center gap-2">
                Delivered by <span className="font-bold text-room-fg">{room.deliveredBy}</span>
                <VerifiedDot />
              </p>
            </div>

            <h1 className="mt-6 break-words font-display text-[clamp(3.75rem,14vw,9.5rem)] uppercase leading-[0.9] tracking-[-0.01em]">
              {room.title}
            </h1>

            {files.length > 0 && (
              <a
                href={`/r/${room.slug}/download-all`}
                className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-room-accent px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_40px_-10px_var(--room-accent)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Download className="size-4" />
                Download all {files.length} {files.length === 1 ? "file" : "files"}
              </a>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.15, ease }}
            className="min-w-0"
          >
            {heroImage ? (
              <button
                type="button"
                onClick={() => setLightboxIndex(heroIndex)}
                className="group relative block aspect-[4/3] w-full overflow-hidden rounded-[28px] border border-room-border bg-room-surface shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]"
                aria-label={`Open ${hero!.fileName}`}
              >
                <img
                  src={heroImage}
                  alt={hero!.fileName}
                  fetchPriority="high"
                  className="absolute inset-0 size-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
                />
                <span className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/10" />
                {hero!.kind === "video" && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex size-16 items-center justify-center rounded-full bg-room-accent text-white shadow-[0_0_40px_var(--room-accent)]">
                      <Play className="ml-1 size-7 fill-current" />
                    </span>
                  </span>
                )}
              </button>
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[28px] border border-dashed border-room-border font-typewriter text-sm text-room-muted">
                Your files are on the way.
              </div>
            )}
            <div className="mt-5">
              <StatsLine stats={stats} />
            </div>
          </motion.div>
        </section>

        <section className="mt-20 sm:mt-28" aria-labelledby="deliverables">
          <div className="mb-6 flex items-end justify-between gap-4 border-b border-room-border pb-4">
            <h2 id="deliverables" className="font-display text-3xl uppercase tracking-wide sm:text-4xl">
              Deliverables
            </h2>
            <p className="font-typewriter text-xs text-room-muted">
              {files.length} {files.length === 1 ? "file" : "files"}
              <span className="hidden sm:inline"> · tap ✓ to approve</span>
            </p>
          </div>

          {files.length === 0 ? (
            <p className="py-16 text-center font-typewriter text-sm text-room-muted">
              Nothing here yet. We will let you know when your files are ready.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
              {files.map((file, i) => (
                <FileTile
                  key={file.id}
                  file={file}
                  index={i}
                  onOpen={() => setLightboxIndex(i)}
                  onReview={(status) => review(file, status)}
                  onComment={() => openComments(file)}
                />
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-7xl px-5 pb-10 font-typewriter text-xs text-room-muted sm:px-8">
        Delivered with care by {room.deliveredBy}.
      </footer>

      <Lightbox
        files={files}
        index={lightboxIndex}
        slug={room.slug}
        onIndex={setLightboxIndex}
        onReview={review}
        onComment={openComments}
      />

      <CommentSheet
        file={sheetFile}
        name={name}
        deliveredBy={room.deliveredBy}
        onClose={() => setSheetFileId(null)}
        onSend={sendComment}
      />

      <NamePrompt
        open={askName}
        deliveredBy={room.deliveredBy}
        onClose={() => {
          setAskName(false);
          pendingAction.current = null;
        }}
        onSubmit={(value) => {
          setName(value);
          setAskName(false);
          const action = pendingAction.current;
          pendingAction.current = null;
          action?.(value);
        }}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-6 z-[60] mx-auto w-fit max-w-[90vw] rounded-full bg-white px-5 py-3 text-sm font-semibold text-black shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
