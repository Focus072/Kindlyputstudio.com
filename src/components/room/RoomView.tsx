"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, Play, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { addComment, recordView, setReview } from "@/app/r/[slug]/actions";
import { themeVars } from "@/config/themes";
import type { RoomFile, RoomStats } from "@/lib/types";
import { VerifiedDot } from "@/components/ui/VerifiedDot";
import { CommentSheet } from "./CommentSheet";
import { FileTile } from "./FileTile";
import { Lightbox } from "./Lightbox";
import { AuthModal } from "@/components/auth/AuthModal";
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
  brand: { name: string; mark: string; poweredByLabel: string };
  /** Admin preview: shows the room exactly as the client sees it, without tracking. */
  preview?: boolean;
  /** Signed-in client, or null when nobody is signed in. */
  viewer: { name: string; avatarUrl: string | null } | null;
  /** When set, the room is locked behind the create-account popup. */
  gate?: {
    supabaseUrl: string;
    supabaseKey: string;
    fileCount: number;
    teaserUrl: string | null;
    authError?: boolean;
  };
};

const ease = [0.22, 1, 0.36, 1] as const;

export function RoomView({ room, files: initialFiles, heroId, initialViews, brand, preview, viewer, gate }: RoomViewProps) {
  const [files, setFiles] = useState(initialFiles);
  const [sheetFileId, setSheetFileId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (preview || !viewer) return;
    const key = `kp:viewed:${room.slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    recordView(room.slug).catch(() => {});
  }, [room.slug, preview, viewer]);

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

  function patchFile(id: string, patch: Partial<RoomFile>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  async function review(file: RoomFile, status: "approved" | "changes") {
    const next = file.status === status ? "pending" : status;
    const before = { status: file.status, reviewedBy: file.reviewedBy };
    patchFile(file.id, { status: next, reviewedBy: next === "pending" ? null : viewer?.name ?? null });
    const res = await setReview({ slug: room.slug, fileId: file.id, status: next }).catch(() => ({
      ok: false as const,
      error: "Connection lost. Please try again.",
    }));
    if (!res.ok) {
      patchFile(file.id, before);
      setToast(res.error);
    }
  }

  function openComments(file: RoomFile) {
    setSheetFileId(file.id);
  }

  async function sendComment(body: string): Promise<boolean> {
    if (!sheetFile) return false;
    const res = await addComment({ slug: room.slug, fileId: sheetFile.id, body }).catch(() => ({ ok: false as const, error: "Connection lost. Please try again." }));
    if (!res.ok || !res.data) {
      setToast(res.ok ? "Could not post." : res.error);
      return false;
    }
    const { id, createdAt, author, fromAgency } = res.data;
    patchFile(sheetFile.id, {
      comments: [...sheetFile.comments, { id, author, body, fromAgency, createdAt }],
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
        <div className="flex items-center gap-3" aria-label={brand.name}>
          <img src={brand.mark} alt="" className="h-8 w-auto sm:h-9" />
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.28em] sm:inline">
            {brand.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-room-border bg-white/5 px-3 py-1.5 font-typewriter text-[11px] text-room-muted backdrop-blur-md sm:inline-flex">
            <span className="size-1.5 rounded-full bg-room-accent" />
            Powered by <span className="text-room-fg">{brand.poweredByLabel}</span>
          </span>
          {viewer && (
            <a
              href="/account"
              title="My rooms"
              className="inline-flex items-center gap-2 rounded-full border border-room-border bg-white/5 py-1 pl-1 pr-3 text-xs font-semibold backdrop-blur-md hover:bg-white/10"
            >
              {viewer.avatarUrl ? (
                <img src={viewer.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-6 rounded-full" />
              ) : (
                <span className="flex size-6 items-center justify-center rounded-full bg-room-accent text-room-accent-fg">
                  <UserRound className="size-3.5" />
                </span>
              )}
              My rooms
            </a>
          )}
        </div>
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
                className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-room-accent px-6 py-3.5 text-sm font-bold text-room-accent-fg shadow-[0_10px_40px_-10px_var(--room-accent)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
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
                    <span className="flex size-16 items-center justify-center rounded-full bg-room-accent text-room-accent-fg shadow-[0_0_40px_var(--room-accent)]">
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
        name={viewer?.name ?? room.deliveredBy}
        deliveredBy={room.deliveredBy}
        onClose={() => setSheetFileId(null)}
        onSend={sendComment}
      />

      {gate && (
        <>
          {gate.teaserUrl && (
            <img
              src={gate.teaserUrl}
              alt=""
              aria-hidden
              className="pointer-events-none fixed inset-0 -z-[5] size-full scale-110 object-cover opacity-25 blur-2xl"
            />
          )}
          <AuthModal
            supabaseUrl={gate.supabaseUrl}
            supabaseKey={gate.supabaseKey}
            next={`/r/${room.slug}`}
            brandMark={brand.mark}
            heading="Create your account"
            subheading={`${room.deliveredBy} has ${gate.fileCount} ${gate.fileCount === 1 ? "file" : "files"} ready for ${room.clientName}. Create your free account to view, approve, and download them. One account opens all your rooms.`}
            initialError={gate.authError}
          />
        </>
      )}

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
