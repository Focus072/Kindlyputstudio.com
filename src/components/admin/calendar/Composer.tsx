"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, CircleAlert, Clapperboard, GripVertical, ImagePlus, Loader2, Play, Search, Send, Tag, Trash2, Type, X } from "lucide-react";
import {
  type ChannelResult,
  type ComposerMedia,
  type NetworkOptions,
  createSocialUpload,
  publishPosts,
  removeBufferPost,
  updateBufferPost,
} from "@/app/admin/calendar/buffer-actions";
import { CAPTION_LIMIT, type CalChannel, type CalClient, type CalPost, type CalTag, platformInfo } from "@/lib/calendar";
import { STUDIO_TZ_LABEL, addDays, dayKey, dayLabel, timeInput } from "@/lib/calendar-time";
import { uploadWithProgress } from "@/lib/media";
import { ChannelAvatar, PlatformIcon } from "./PlatformIcon";
import { PostPreview, type PreviewMedia } from "./Previews";

export type ComposerMode =
  | { kind: "new"; date?: string; clientId?: string | null; text?: string; media?: (ComposerMedia & { thumb?: string | null })[] }
  | { kind: "edit"; post: CalPost };

type Props = {
  mode: ComposerMode;
  clients: CalClient[];
  channels: CalChannel[];
  tags: CalTag[];
  today: string;
  onClose: () => void;
  /** Called once every chosen account accepted the new post (used to mark an idea as scheduled). */
  onPublished?: (info: { date: string; time: string; draft: boolean }) => void;
};

type Tile = {
  id: string;
  url: string | null;
  preview: string;
  poster?: string | null;
  isVideo: boolean;
  progress: number;
  error?: string;
  alt: string;
  coverMs: number | null;
  durationMs?: number;
};

type When = "schedule" | "queue" | "now" | "draft";

const DRAFT_KEY = "kp-composer-draft";

const field =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-ink focus:ring-4 focus:ring-ink/10 sm:text-sm";
const small = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base outline-none focus:border-ink focus:ring-4 focus:ring-ink/10 sm:text-sm";

const YT_CATEGORIES: [string, string][] = [
  ["22", "People & Blogs"],
  ["1", "Film & Animation"],
  ["2", "Autos & Vehicles"],
  ["10", "Music"],
  ["15", "Pets & Animals"],
  ["17", "Sports"],
  ["19", "Travel & Events"],
  ["20", "Gaming"],
  ["23", "Comedy"],
  ["24", "Entertainment"],
  ["25", "News & Politics"],
  ["26", "Howto & Style"],
  ["27", "Education"],
  ["28", "Science & Technology"],
  ["29", "Nonprofits & Activism"],
];
const WEEKDAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-2xl bg-slate-100 p-1 sm:w-auto">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-9 flex-1 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition sm:flex-none ${value === o.id ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm text-slate-700">
      <span>{children}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition ${checked ? "bg-ink" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-[1.125rem]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

function NetworkCard({ service, title, children }: { service: string; title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
        <PlatformIcon service={service} className="size-5" /> {title ?? platformInfo(service).label}
      </p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function to12h(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function Composer({ mode, clients, channels, tags, today, onClose, onPublished }: Props) {
  const router = useRouter();
  const editing = mode.kind === "edit" ? mode.post : null;
  const editChannel = editing ? (channels.find((c) => c.id === editing.channelId) ?? null) : null;
  const meta = editing?.meta;

  const initialClient = mode.kind === "new" ? (mode.clientId ?? null) : null;
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (editing?.channelId) return new Set([editing.channelId]);
    return new Set(initialClient ? channels.filter((c) => c.clientId === initialClient && !c.needsReconnect).map((c) => c.id) : []);
  });
  const [query, setQuery] = useState("");

  const startMedia: (ComposerMedia & { thumb?: string | null })[] = editing
    ? editing.media.map((m) => ({ url: m.url, isVideo: m.isVideo, thumb: m.thumb, alt: m.alt ?? undefined }))
    : mode.kind === "new"
      ? (mode.media ?? [])
      : [];
  const [tiles, setTiles] = useState<Tile[]>(() =>
    startMedia.map((m, i) => ({ id: `m${i}`, url: m.url, preview: m.url, poster: m.thumb ?? null, isVideo: m.isVideo, progress: 1, alt: m.alt ?? "", coverMs: null })),
  );
  const [mediaTouched, setMediaTouched] = useState(false);
  const [activeTile, setActiveTile] = useState<string | null>(null);
  const [text, setText] = useState(() => {
    if (editing) return editing.caption;
    if (mode.kind === "new" && mode.text) return mode.text;
    try {
      return localStorage.getItem(DRAFT_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<string>("all");

  const defaultDate = editing ? (dayKey(editing.at) >= today ? dayKey(editing.at) : today) : mode.kind === "new" && mode.date && mode.date >= today ? mode.date : today;
  const [when, setWhen] = useState<When>(editing?.status === "draft" ? "draft" : "schedule");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(() => {
    if (editing) return timeInput(editing.at);
    if (defaultDate !== today) return "10:00";
    // Today: the next whole hour that's at least 30 minutes away.
    const next = timeInput(new Date(Date.now() + 90 * 60_000).toISOString()).slice(0, 2);
    return Number(next) < 2 ? "23:30" : `${next}:00`;
  });

  const [ig, setIg] = useState({
    type: (meta?.type === "reel" || meta?.type === "story" || meta?.type === "post" ? meta.type : null) as "post" | "reel" | "story" | null,
    shareToFeed: meta?.shareToFeed ?? true,
    firstComment: editChannel?.service === "instagram" ? (meta?.firstComment ?? "") : "",
    link: editChannel?.service === "instagram" ? (meta?.link ?? "") : "",
    ai: false,
  });
  const [fb, setFb] = useState({
    type: (meta?.type === "reel" || meta?.type === "story" ? meta.type : "post") as "post" | "reel" | "story",
    firstComment: editChannel?.service === "facebook" ? (meta?.firstComment ?? "") : "",
  });
  const [li, setLi] = useState({ firstComment: editChannel?.service === "linkedin" ? (meta?.firstComment ?? "") : "" });
  const [g, setG] = useState({
    type: (meta?.type === "offer" || meta?.type === "event" ? meta.type : "whats_new") as "whats_new" | "offer" | "event",
    button: meta?.button ?? "none",
    link: editChannel?.service === "googlebusiness" ? (meta?.link ?? "") : "",
    title: editChannel?.service === "googlebusiness" ? (meta?.title ?? "") : "",
    start: today,
    end: addDays(today, 7),
    code: "",
    terms: "",
  });
  const [yt, setYt] = useState({ title: editChannel?.service === "youtube" ? (meta?.title ?? "") : "", privacy: (meta?.privacy as "public" | "unlisted" | "private") ?? "public", categoryId: "22", madeForKids: false, notify: true });
  const [tt, setTt] = useState({ title: editChannel?.service === "tiktok" ? (meta?.title ?? "") : "", ai: false });
  const [pin, setPin] = useState({ title: editChannel?.service === "pinterest" ? (meta?.title ?? "") : "", link: editChannel?.service === "pinterest" ? (meta?.link ?? "") : "" });
  const [boards, setBoards] = useState<Record<string, string>>({});
  const [optionsTouched, setOptionsTouched] = useState(false);
  const [tagIds, setTagIds] = useState<Set<string>>(new Set(editing?.tags?.map((t) => t.id) ?? []));
  const [tagsTouched, setTagsTouched] = useState(false);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ChannelResult[] | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragTile, setDragTile] = useState<string | null>(null);

  // Keep an unsent caption if the composer is closed by accident.
  useEffect(() => {
    if (editing) return;
    try {
      if (text) localStorage.setItem(DRAFT_KEY, text);
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* private mode */
    }
  }, [text, editing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, pending]);

  const opt = <T,>(set: (fn: (v: T) => T) => void) => (patch: Partial<T>) => {
    setOptionsTouched(true);
    set((v) => ({ ...v, ...patch }));
  };
  const setIgP = opt(setIg);
  const setFbP = opt(setFb);
  const setLiP = opt(setLi);
  const setGP = opt(setG);
  const setYtP = opt(setYt);
  const setTtP = opt(setTt);
  const setPinP = opt(setPin);

  const chosen = editChannel ? [editChannel] : channels.filter((c) => selected.has(c.id));
  const services = [...new Set((editing && !editChannel ? [editing.platform] : chosen.map((c) => c.service)).map((s) => platformInfo(s).id))];
  const hasVideo = tiles.some((t) => t.isVideo);
  const uploading = tiles.some((t) => !t.url && !t.error);
  const effectiveIg = ig.type ?? (hasVideo ? "reel" : "post");
  const textFor = (service: string) => captions[service] ?? text;
  // Keep the caption tab and preview pointed at something that's still selected.
  const activeTab = tab !== "all" && !services.includes(tab) ? "all" : tab;
  const tabText = activeTab === "all" ? text : textFor(activeTab);
  const tabLimit = activeTab === "all" ? Math.min(...services.filter((s) => captions[s] === undefined).map((s) => CAPTION_LIMIT[s] ?? Infinity), Infinity) : (CAPTION_LIMIT[activeTab] ?? Infinity);
  const hashtags = (tabText.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
  // Editing a Google offer/event or a YouTube video: Buffer doesn't hand back every
  // setting (offer dates, coupon, YouTube category...), so leave them as they are
  // in Buffer instead of overwriting them with defaults.
  const keepsMeta =
    !!editing?.bufferId && (services[0] === "youtube" || (services[0] === "googlebusiness" && (meta?.type === "offer" || meta?.type === "event")));
  const over = services.filter((s) => CAPTION_LIMIT[s] && textFor(s).length > CAPTION_LIMIT[s]);

  const previewChannel = chosen.find((c) => c.id === previewId) ?? chosen[0] ?? null;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (ch: CalChannel) => !q || ch.name.toLowerCase().includes(q) || (clients.find((c) => c.id === ch.clientId)?.name.toLowerCase().includes(q) ?? false);
    const out = clients.map((c) => ({ client: c as CalClient | null, items: channels.filter((ch) => ch.clientId === c.id && match(ch)) })).filter((x) => x.items.length);
    const loose = channels.filter((ch) => (!ch.clientId || !clients.some((c) => c.id === ch.clientId)) && match(ch));
    if (loose.length) out.push({ client: null, items: loose });
    return out;
  }, [clients, channels, query]);

  function toggleChannel(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setResults(null);
  }

  function toggleClient(ids: string[]) {
    setSelected((s) => {
      const all = ids.every((id) => s.has(id));
      const n = new Set(s);
      ids.forEach((id) => (all ? n.delete(id) : n.add(id)));
      return n;
    });
    setResults(null);
  }

  async function addFiles(list: FileList | File[]) {
    const files = [...list].filter((f) => /^(image|video)\//.test(f.type));
    if (!files.length) return;
    setMediaTouched(true);
    setError(null);
    const video = files.find((f) => f.type.startsWith("video/"));
    const picked = video ? [video] : files.slice(0, Math.max(0, 10 - (hasVideo ? 0 : tiles.length)));
    if (video && tiles.length) setError("A video post has one video, so the video replaced the photos.");
    if (!video && hasVideo) setError("A video post has one video, so the photos replaced it.");
    const fresh: Tile[] = picked.map((f) => ({ id: crypto.randomUUID(), url: null, preview: URL.createObjectURL(f), isVideo: f.type.startsWith("video/"), progress: 0, alt: "", coverMs: null }));
    setTiles((t) => (video || hasVideo ? fresh : [...t, ...fresh]));
    if (video) setActiveTile(fresh[0].id);
    await Promise.all(
      picked.map(async (file, i) => {
        const tile = fresh[i];
        const patch = (p: Partial<Tile>) => setTiles((all) => all.map((x) => (x.id === tile.id ? { ...x, ...p } : x)));
        try {
          const body = await socialReady(file);
          const target = await createSocialUpload(body === file ? file.name : "photo.jpg", body.type);
          if ("error" in target) throw new Error(target.error);
          await uploadWithProgress(target.uploadUrl, body, body.type, (f) => patch({ progress: f }));
          patch({ url: target.publicUrl, progress: 1 });
        } catch (e) {
          patch({ error: e instanceof Error ? e.message : "Upload failed" });
        }
      }),
    );
  }

  function moveTileTo(id: string, to: string) {
    if (id === to) return;
    setMediaTouched(true);
    setTiles((t) => {
      const from = t.findIndex((x) => x.id === id);
      const at = t.findIndex((x) => x.id === to);
      if (from < 0 || at < 0) return t;
      const n = [...t];
      const [it] = n.splice(from, 1);
      n.splice(at, 0, it);
      return n;
    });
  }

  function patchTile(id: string, p: Partial<Tile>) {
    setMediaTouched(true);
    setTiles((all) => all.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  function removeTile(id: string) {
    setMediaTouched(true);
    setTiles((t) => t.filter((x) => x.id !== id));
    if (activeTile === id) setActiveTile(null);
  }

  const media: ComposerMedia[] = tiles.filter((t) => t.url).map((t) => ({ url: t.url!, isVideo: t.isVideo, alt: t.alt || undefined, coverMs: t.coverMs }));
  const options: NetworkOptions = {
    instagram: { type: effectiveIg, shareToFeed: ig.shareToFeed, firstComment: ig.firstComment, link: ig.link, ai: ig.ai },
    facebook: { type: fb.type, firstComment: fb.firstComment },
    linkedin: { firstComment: li.firstComment },
    google: { type: g.type, button: g.button, link: g.link, title: g.title, start: g.start, end: g.end, code: g.code, terms: g.terms },
    youtube: yt,
    tiktok: tt,
    pinterest: pin,
  };

  function submit(whenOverride?: When) {
    const w = whenOverride ?? when;
    setError(null);
    if (uploading) return setError("Wait for the uploads to finish.");
    if (tiles.some((t) => t.error)) return setError("Remove the files that didn't upload first.");
    if (over.length) return setError(`The caption is too long for ${over.map((s) => platformInfo(s).label).join(", ")}.`);
    start(async () => {
      if (editing?.bufferId) {
        const r = await updateBufferPost({
          id: editing.bufferId,
          channelId: editing.channelId,
          text,
          media: mediaTouched ? media : null,
          when: w === "queue" ? "queue" : w,
          date,
          time,
          options: optionsTouched && !keepsMeta ? options : null,
          tagIds: tagsTouched ? [...tagIds] : null,
          boardId: editing.channelId ? boards[editing.channelId] : undefined,
        });
        if (r.error) return setError(r.error);
        router.refresh();
        onClose();
        return;
      }
      const r = await publishPosts({
        channelIds: [...selected],
        text,
        captions,
        media,
        when: w,
        date,
        time,
        options,
        tagIds: [...tagIds],
        boards,
      });
      if (r.error) return setError(r.error);
      const res = r.results ?? [];
      if (res.length && res.every((x) => x.ok)) {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
        onPublished?.({ date, time, draft: w === "draft" });
        router.refresh();
        onClose();
        return;
      }
      // Keep only the accounts that failed selected, so a retry doesn't double post.
      setResults(res);
      setSelected(new Set(res.filter((x) => !x.ok).map((x) => x.channelId)));
      if (res.some((x) => x.ok)) router.refresh();
    });
  }

  function remove() {
    if (!editing?.bufferId || !confirm("Delete this post from Buffer? It won't go out.")) return;
    start(async () => {
      const r = await removeBufferPost(editing.bufferId!);
      if (r.error) return setError(r.error);
      router.refresh();
      onClose();
    });
  }

  // Buffer posting slots for the chosen day, across the chosen accounts.
  const slotDay = WEEKDAY[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const slotSet = new Set<string>();
  for (const c of chosen) for (const s of c.schedule ?? []) if (s.day.toLowerCase().startsWith(slotDay) && !s.paused) s.times.forEach((t) => /^\d{2}:\d{2}$/.test(t) && slotSet.add(t));
  const slots = [...slotSet].sort();

  const count = editing ? 1 : selected.size;
  const action =
    when === "now" ? `Post now${count > 1 ? ` to ${count}` : ""}`
    : when === "queue" ? `Add to queue${count > 1 ? ` (${count})` : ""}`
    : when === "draft" ? (editing ? "Save draft" : `Save draft${count > 1 ? `s (${count})` : ""}`)
    : editing ? (editing.status === "error" ? "Retry" : editing.status === "draft" ? "Schedule" : "Save changes")
    : `Schedule${count > 1 ? ` ${count} posts` : ""}`;
  const whenLabel = when === "schedule" ? `${dayLabel(date, { weekday: "short", month: "short", day: "numeric" })} at ${to12h(time)}` : when === "queue" ? "next open slot" : when === "now" ? "right away" : "saved as a draft";

  const pv: PreviewMedia[] = tiles.map((t) => ({ id: t.id, src: t.preview, poster: t.poster, isVideo: t.isVideo, coverMs: t.coverMs, alt: t.alt }));
  const pService = previewChannel ? platformInfo(previewChannel.service).id : (services[0] ?? "instagram");
  const pType = pService === "instagram" ? effectiveIg : pService === "facebook" ? fb.type : pService === "googlebusiness" ? g.type : "post";
  const firstComment = pService === "instagram" && effectiveIg !== "story" ? ig.firstComment : pService === "facebook" ? fb.firstComment : pService === "linkedin" ? li.firstComment : "";
  const tileOpen = tiles.find((t) => t.id === activeTile) ?? null;

  const preview = (
    <div className="mx-auto w-full max-w-[340px]">
      {chosen.length > 1 && (
        <div className="mb-3 flex flex-wrap justify-center gap-1.5">
          {chosen.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setPreviewId(c.id)}
              aria-label={`Preview ${c.name}`}
              aria-pressed={previewChannel?.id === c.id}
              className={`rounded-full p-0.5 ring-2 transition ${previewChannel?.id === c.id ? "ring-ink" : "ring-transparent opacity-60 hover:opacity-100"}`}
            >
              <ChannelAvatar avatar={c.avatar} service={c.service} name={c.name} size="size-9" />
            </button>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-[2rem] border-[6px] border-ink bg-white shadow-xl">
        <div className="flex items-center justify-between bg-white px-5 pb-1 pt-2 text-[11px] font-semibold text-ink">
          <span>9:41</span>
          <span className="h-4 w-16 rounded-full bg-ink" />
          <span className="flex items-center gap-1">
            <PlatformIcon service={pService} className="size-3.5" />
          </span>
        </div>
        <div className="max-h-[min(640px,calc(94dvh-17rem))] overflow-y-auto max-lg:max-h-none">
          <PostPreview
            service={pService}
            type={pType}
            name={previewChannel?.name ?? "your.account"}
            avatar={previewChannel?.avatar ?? null}
            text={textFor(pService)}
            media={pv}
            firstComment={firstComment}
            title={pService === "youtube" ? yt.title : pService === "tiktok" ? tt.title : pService === "pinterest" ? pin.title : pService === "googlebusiness" ? g.title : undefined}
            button={pService === "googlebusiness" ? g.button : undefined}
            linkLabel={pService === "googlebusiness" && g.type === "offer" && g.start && g.end ? `${dayLabel(g.start, { month: "short", day: "numeric" })} – ${dayLabel(g.end, { month: "short", day: "numeric" })}` : undefined}
          />
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">
        {platformInfo(pService).label}
        {pService === "instagram" || pService === "facebook" ? ` ${pType}` : ""} preview · close to what followers will see
      </p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !pending && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit post" : "New post"}
        onClick={(e) => e.stopPropagation()}
        className="flex h-dvh w-full flex-col overflow-hidden bg-[#f6f7f8] shadow-2xl sm:h-[94dvh] sm:max-w-6xl sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:pt-3">
          <h2 className="mr-auto font-display text-3xl uppercase leading-none text-ink">{editing ? (editing.status === "error" ? "Fix post" : "Edit post") : "New post"}</h2>
          <div role="tablist" aria-label="Composer" className="flex rounded-full bg-slate-100 p-1 lg:hidden">
            {(["edit", "preview"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={mobileTab === t}
                onClick={() => setMobileTab(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${mobileTab === t ? "bg-white text-ink shadow-sm" : "text-slate-500"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <button onClick={onClose} disabled={pending} aria-label="Close" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-slate-100">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className={`min-h-0 space-y-6 overflow-y-auto p-5 ${mobileTab === "preview" ? "max-lg:hidden" : ""}`}>
            {/* Accounts */}
            <section>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-ink">Post to</h3>
                {!editing && selected.size > 0 && (
                  <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-semibold text-slate-500 hover:text-ink">
                    Clear ({selected.size})
                  </button>
                )}
              </div>
              {editing ? (
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                  <ChannelAvatar avatar={editChannel?.avatar} service={editChannel?.service ?? editing.platform} name={editChannel?.name ?? editing.channelName} size="size-10" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{editChannel?.name ?? editing.channelName ?? "Buffer account"}</span>
                    <span className="block text-xs text-slate-500">{platformInfo(editing.platform).label}</span>
                  </span>
                </div>
              ) : channels.length === 0 ? (
                <p className="mt-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">No Buffer accounts yet. Connect one in Buffer, then press Sync on the calendar.</p>
              ) : (
                <div className="mt-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                  {channels.length > 8 && (
                    <label className="relative mb-3 block">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a client or account" className={`${small} pl-9`} />
                    </label>
                  )}
                  <div className="space-y-3">
                    {groups.map(({ client, items }) => {
                      const ids = items.filter((i) => !i.needsReconnect).map((i) => i.id);
                      const all = ids.length > 0 && ids.every((id) => selected.has(id));
                      return (
                        <div key={client?.id ?? "none"} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <button type="button" onClick={() => toggleClient(ids)} className="flex min-w-0 items-center gap-2 text-left sm:w-44 sm:shrink-0" title={all ? "Unselect all" : "Select all"}>
                            <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${all ? "border-ink bg-ink" : "border-slate-300"}`}>{all && <Check className="size-3 text-white" strokeWidth={3} />}</span>
                            <span className="size-2.5 shrink-0 rounded-full" style={{ background: client?.color ?? "#cbd5e1" }} />
                            <span className="truncate text-sm font-semibold text-ink">{client?.name ?? "No client yet"}</span>
                          </button>
                          <div className="flex flex-wrap gap-2">
                            {items.map((ch) => {
                              const on = selected.has(ch.id);
                              return (
                                <button
                                  key={ch.id}
                                  type="button"
                                  aria-pressed={on}
                                  disabled={ch.needsReconnect}
                                  onClick={() => toggleChannel(ch.id)}
                                  title={ch.needsReconnect ? `${ch.name} needs reconnecting in Buffer` : `${ch.name} · ${platformInfo(ch.service).label}`}
                                  className={`relative flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-semibold transition disabled:cursor-not-allowed ${
                                    on ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                  }`}
                                >
                                  <ChannelAvatar avatar={ch.avatar} service={ch.service} name={ch.name} size="size-8" badge="size-3.5" dim={!!ch.needsReconnect} />
                                  <span className="max-w-[11rem] truncate">{ch.name}</span>
                                  {ch.needsReconnect && <CircleAlert className="size-3.5 text-amber-600" />}
                                  {on && (
                                    <span className="absolute -left-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-approve ring-2 ring-white">
                                      <Check className="size-2.5 text-white" strokeWidth={4} />
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Media */}
            <section>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold text-ink">Photos or video</h3>
                {tiles.length > 0 && <span className="text-xs text-slate-400">{hasVideo ? "Pick a cover frame below" : tiles.length > 1 ? "Drag to reorder · tap for alt text" : "Tap for alt text"}</span>}
              </div>
              <div
                onDragOver={(e) => {
                  if (dragTile) return;
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  if (dragTile) return;
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
                className={`mt-2 rounded-2xl border-2 border-dashed p-3 transition ${dragOver ? "border-ink bg-white" : "border-slate-300 bg-white/60"}`}
              >
                <div className="flex flex-wrap gap-2">
                  {tiles.map((t, i) => (
                    <div
                      key={t.id}
                      draggable={tiles.length > 1}
                      onDragStart={() => setDragTile(t.id)}
                      onDragEnd={() => setDragTile(null)}
                      onDragOver={(e) => {
                        if (!dragTile) return;
                        e.preventDefault();
                        moveTileTo(dragTile, t.id);
                      }}
                      className={`group relative size-24 overflow-hidden rounded-xl bg-slate-200 ring-1 ring-black/5 sm:size-28 ${activeTile === t.id ? "ring-2 ring-ink" : ""} ${dragTile === t.id ? "opacity-40" : ""}`}
                    >
                      <button type="button" onClick={() => setActiveTile(activeTile === t.id ? null : t.id)} aria-label={t.isVideo ? "Choose cover" : "Edit alt text"} className="block size-full">
                        <TileMedia t={t} />
                      </button>
                      {i === 0 && tiles.length > 1 && <span className="pointer-events-none absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-white">Cover</span>}
                      {t.isVideo && (
                        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-black/60 p-1">
                          <Play className="size-3 fill-white text-white" />
                        </span>
                      )}
                      {t.alt && !t.isVideo && <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[9px] font-bold text-white">ALT</span>}
                      {tiles.length > 1 && <GripVertical className="pointer-events-none absolute right-1 top-7 hidden size-4 text-white drop-shadow pointer-fine:group-hover:block" />}
                      {!t.url && !t.error && (
                        <span className="pointer-events-none absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-white/60">
                          <span className="block h-full bg-ink transition-[width]" style={{ width: `${Math.round(t.progress * 100)}%` }} />
                        </span>
                      )}
                      {t.error && <span className="absolute inset-0 flex items-center justify-center bg-red-600/80 p-2 text-center text-[11px] font-semibold text-white">{t.error}</span>}
                      <button type="button" onClick={() => removeTile(t.id)} aria-label="Remove" className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {!(hasVideo || tiles.length >= 10) && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex size-24 flex-col items-center justify-center gap-1 rounded-xl bg-white text-xs font-semibold text-slate-500 ring-1 ring-slate-200 hover:text-ink hover:ring-ink sm:size-28"
                    >
                      <ImagePlus className="size-6" />
                      Add
                    </button>
                  )}
                </div>
                {!tiles.length && <p className="mt-2 text-xs text-slate-500">Drop files here. Up to 10 photos for a carousel, or 1 video for a reel.</p>}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {tileOpen && (
                <div className="mt-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                  {tileOpen.isVideo ? (
                    <CoverPicker tile={tileOpen} onChange={(ms, dur) => patchTile(tileOpen.id, { coverMs: ms, ...(dur ? { durationMs: dur } : {}) })} />
                  ) : (
                    <label className="block">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
                        <Type className="size-4" /> Alt text
                      </span>
                      <span className="block text-xs text-slate-500">Describes the photo for people using screen readers. Instagram, Facebook and others use it.</span>
                      <textarea value={tileOpen.alt} onChange={(e) => patchTile(tileOpen.id, { alt: e.target.value.slice(0, 1000) })} rows={2} placeholder="e.g. Pumpkin latte with foam art on a wood table" className={`${small} mt-2`} />
                    </label>
                  )}
                </div>
              )}
            </section>

            {/* Caption */}
            <section>
              <div className="flex flex-wrap items-center gap-1.5">
                <label htmlFor="kp-caption" className="mr-auto text-sm font-bold text-ink">
                  Caption
                </label>
                {!editing && services.length > 1 && (
                  <div role="tablist" aria-label="Caption per network" className="flex flex-wrap gap-1">
                    <button type="button" role="tab" aria-selected={activeTab === "all"} onClick={() => setTab("all")} className={`rounded-full px-3 py-1 text-xs font-semibold ${activeTab === "all" ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
                      All networks
                    </button>
                    {services.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === s}
                        onClick={() => setTab(s)}
                        className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs font-semibold ${activeTab === s ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
                      >
                        <PlatformIcon service={s} className="size-5" />
                        {platformInfo(s).label}
                        {captions[s] !== undefined && <span className="size-1.5 rounded-full bg-amber-400" title="Custom caption" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {activeTab !== "all" && captions[activeTab] === undefined ? (
                <div className="mt-2 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm text-slate-600">
                  <p className="line-clamp-3 whitespace-pre-wrap">{text || <span className="text-slate-400">No caption yet.</span>}</p>
                  <button type="button" onClick={() => setCaptions((c) => ({ ...c, [activeTab]: text }))} className="mt-3 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white">
                    Write a different caption for {platformInfo(activeTab).label}
                  </button>
                </div>
              ) : (
                <>
                  <textarea
                    id="kp-caption"
                    value={tabText}
                    onChange={(e) => (activeTab === "all" ? setText(e.target.value) : setCaptions((c) => ({ ...c, [activeTab]: e.target.value })))}
                    rows={7}
                    placeholder={activeTab === "all" ? "Write the caption… #hashtags and @mentions work like they do in the app." : `Caption just for ${platformInfo(activeTab).label}…`}
                    className={`${field} mt-2 leading-relaxed`}
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className={`font-semibold ${tabText.length > tabLimit ? "text-decline" : "text-slate-400"}`}>
                      {tabText.length}
                      {Number.isFinite(tabLimit) ? ` / ${tabLimit.toLocaleString()}` : ""}
                    </span>
                    {hashtags > 0 && <span className={`font-semibold ${hashtags > 30 && services.includes("instagram") ? "text-decline" : "text-slate-400"}`}>{hashtags} hashtag{hashtags === 1 ? "" : "s"}</span>}
                    {services.includes("instagram") && hashtags > 30 && <span className="font-semibold text-decline">Instagram allows 30.</span>}
                    {activeTab !== "all" && (
                      <button
                        type="button"
                        onClick={() =>
                          setCaptions((c) => {
                            const n = { ...c };
                            delete n[activeTab];
                            return n;
                          })
                        }
                        className="ml-auto font-semibold text-slate-500 hover:text-ink"
                      >
                        Use the main caption instead
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>

            {/* Per network options */}
            {services.some((s) => ["instagram", "facebook", "googlebusiness", "youtube", "tiktok", "pinterest", "linkedin"].includes(s)) && (
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-ink">Network settings</h3>
                {services.includes("instagram") && (
                  <NetworkCard service="instagram">
                    <Segmented
                      label="Instagram post type"
                      value={effectiveIg}
                      onChange={(v) => setIgP({ type: v })}
                      options={[
                        { id: "post", label: tiles.length > 1 ? "Carousel" : "Post" },
                        { id: "reel", label: "Reel" },
                        { id: "story", label: "Story" },
                      ]}
                    />
                    {effectiveIg === "reel" && !hasVideo && <p className="text-xs font-semibold text-amber-700">Reels need a video.</p>}
                    {effectiveIg === "reel" && (
                      <Toggle checked={ig.shareToFeed} onChange={(v) => setIgP({ shareToFeed: v })}>
                        Also show on the profile grid
                      </Toggle>
                    )}
                    {effectiveIg !== "story" && (
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-500">First comment</span>
                        <textarea value={ig.firstComment} onChange={(e) => setIgP({ firstComment: e.target.value })} rows={2} placeholder="Posted as the first comment. Good for hashtags." className={`${small} mt-1`} />
                      </label>
                    )}
                    {effectiveIg === "post" && (
                      <label className="block">
                        <span className="text-xs font-semibold text-slate-500">Shop grid link (optional)</span>
                        <input value={ig.link} onChange={(e) => setIgP({ link: e.target.value })} type="url" placeholder="https://" className={`${small} mt-1`} />
                      </label>
                    )}
                    <Toggle checked={ig.ai} onChange={(v) => setIgP({ ai: v })}>
                      Label as made with AI
                    </Toggle>
                    {hasVideo && <p className="text-xs text-slate-500">The reel cover is the frame you pick on the video above.</p>}
                  </NetworkCard>
                )}
                {services.includes("facebook") && (
                  <NetworkCard service="facebook">
                    <Segmented
                      label="Facebook post type"
                      value={fb.type}
                      onChange={(v) => setFbP({ type: v })}
                      options={[
                        { id: "post", label: "Post" },
                        { id: "reel", label: "Reel" },
                        { id: "story", label: "Story" },
                      ]}
                    />
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">First comment</span>
                      <textarea value={fb.firstComment} onChange={(e) => setFbP({ firstComment: e.target.value })} rows={2} placeholder="Optional" className={`${small} mt-1`} />
                    </label>
                  </NetworkCard>
                )}
                {services.includes("googlebusiness") && (
                  <NetworkCard service="googlebusiness" title="Google Business Profile">
                    {keepsMeta ? (
                      <p className="text-xs text-slate-500">
                        This post&rsquo;s {g.type === "offer" ? "offer" : "event"} settings stay as they are in Buffer. Caption, media and time changes still save from here.
                      </p>
                    ) : (
                    <>
                    <Segmented
                      label="Google post type"
                      value={g.type}
                      onChange={(v) => setGP({ type: v })}
                      options={[
                        { id: "whats_new", label: "Update" },
                        { id: "offer", label: "Offer" },
                        { id: "event", label: "Event" },
                      ]}
                    />
                    {g.type !== "whats_new" && (
                      <>
                        <input value={g.title} onChange={(e) => setGP({ title: e.target.value })} maxLength={58} placeholder={g.type === "offer" ? "Offer title, e.g. 20% off sectionals" : "Event title"} className={small} />
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-xs font-semibold text-slate-500">
                            Starts
                            <input type="date" value={g.start} onChange={(e) => setGP({ start: e.target.value })} className={`${small} mt-1`} />
                          </label>
                          <label className="block text-xs font-semibold text-slate-500">
                            Ends
                            <input type="date" value={g.end} min={g.start} onChange={(e) => setGP({ end: e.target.value })} className={`${small} mt-1`} />
                          </label>
                        </div>
                      </>
                    )}
                    {g.type === "offer" ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input value={g.code} onChange={(e) => setGP({ code: e.target.value })} placeholder="Coupon code (optional)" className={small} />
                        <input value={g.link} onChange={(e) => setGP({ link: e.target.value })} type="url" placeholder="Redeem link (optional)" className={small} />
                        <input value={g.terms} onChange={(e) => setGP({ terms: e.target.value })} placeholder="Terms (optional)" className={`${small} sm:col-span-2`} />
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
                        <select value={g.button} onChange={(e) => setGP({ button: e.target.value })} aria-label="Google button" className={small}>
                          <option value="none">No button</option>
                          <option value="learn_more">Learn more</option>
                          <option value="book">Book</option>
                          <option value="order">Order online</option>
                          <option value="shop">Buy</option>
                          <option value="signup">Sign up</option>
                          <option value="call">Call now</option>
                        </select>
                        {g.button !== "none" && g.button !== "call" && <input value={g.link} onChange={(e) => setGP({ link: e.target.value })} type="url" placeholder="https://" aria-label="Button link" className={small} />}
                      </div>
                    )}
                    </>
                    )}
                  </NetworkCard>
                )}
                {services.includes("youtube") && (
                  <NetworkCard service="youtube">
                    {keepsMeta ? (
                      <p className="text-xs text-slate-500">
                        This post&rsquo;s YouTube settings stay as they are in Buffer. Caption, media and time changes still save from here.
                      </p>
                    ) : (
                    <>
                    <input value={yt.title} onChange={(e) => setYtP({ title: e.target.value })} maxLength={100} placeholder="Video title (required)" className={small} />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={yt.privacy} onChange={(e) => setYtP({ privacy: e.target.value as typeof yt.privacy })} aria-label="Visibility" className={small}>
                        <option value="public">Public</option>
                        <option value="unlisted">Unlisted</option>
                        <option value="private">Private</option>
                      </select>
                      <select value={yt.categoryId} onChange={(e) => setYtP({ categoryId: e.target.value })} aria-label="Category" className={small}>
                        {YT_CATEGORIES.map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Toggle checked={yt.notify} onChange={(v) => setYtP({ notify: v })}>
                      Notify subscribers
                    </Toggle>
                    <Toggle checked={yt.madeForKids} onChange={(v) => setYtP({ madeForKids: v })}>
                      Made for kids
                    </Toggle>
                    </>
                    )}
                  </NetworkCard>
                )}
                {services.includes("tiktok") && (
                  <NetworkCard service="tiktok">
                    {!hasVideo && <input value={tt.title} onChange={(e) => setTtP({ title: e.target.value })} maxLength={90} placeholder="Photo post title (optional)" className={small} />}
                    {hasVideo && (
                      <Toggle checked={tt.ai} onChange={(v) => setTtP({ ai: v })}>
                        Label as AI-generated
                      </Toggle>
                    )}
                    {hasVideo && <p className="text-xs text-slate-500">The cover is the frame you pick on the video above.</p>}
                  </NetworkCard>
                )}
                {services.includes("pinterest") && (
                  <NetworkCard service="pinterest">
                    {chosen
                      .filter((c) => platformInfo(c.service).id === "pinterest")
                      .map((c) => (
                        <label key={c.id} className="block text-xs font-semibold text-slate-500">
                          Board for {c.name}
                          <select value={boards[c.id] ?? ""} onChange={(e) => (setOptionsTouched(true), setBoards((b) => ({ ...b, [c.id]: e.target.value })))} className={`${small} mt-1`}>
                            <option value="">Pick a board</option>
                            {(c.boards ?? []).map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    <input value={pin.title} onChange={(e) => setPinP({ title: e.target.value })} maxLength={100} placeholder="Pin title" className={small} />
                    <input value={pin.link} onChange={(e) => setPinP({ link: e.target.value })} type="url" placeholder="Destination link https://" className={small} />
                  </NetworkCard>
                )}
                {services.includes("linkedin") && (
                  <NetworkCard service="linkedin">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-500">First comment</span>
                      <textarea value={li.firstComment} onChange={(e) => setLiP({ firstComment: e.target.value })} rows={2} placeholder="Optional. Good for links." className={`${small} mt-1`} />
                    </label>
                  </NetworkCard>
                )}
              </section>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
                  <Tag className="size-4" /> Tags
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tags.map((t) => {
                    const on = tagIds.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setTagsTouched(true);
                          setTagIds((s) => {
                            const n = new Set(s);
                            if (on) n.delete(t.id);
                            else n.add(t.id);
                            return n;
                          });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition"
                        style={on ? { background: t.color || "#1d2b32", color: "#fff", boxShadow: "none" } : { background: "#fff", color: "#475569", boxShadow: "inset 0 0 0 1px #e2e8f0" }}
                      >
                        <span className="size-2 rounded-full" style={{ background: on ? "#fff" : t.color || "#64748b" }} />
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* When */}
            <section>
              <h3 className="text-sm font-bold text-ink">When</h3>
              <div className="mt-2 space-y-3">
                <Segmented
                  label="When to post"
                  value={when}
                  onChange={setWhen}
                  options={[
                    { id: "schedule", label: "Pick a time" },
                    { id: "queue", label: "Next free slot" },
                    { id: "now", label: "Now" },
                    { id: "draft", label: "Draft" },
                  ]}
                />
                {(when === "schedule" || when === "draft") && (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                      <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} aria-label="Date" className={field} />
                      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" className={field} />
                    </div>
                    {slots.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-500">Buffer slots:</span>
                        {slots.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setTime(s)}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${time === s ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-ink"}`}
                          >
                            {to12h(s)}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <p className="text-xs text-slate-500">
                  {when === "schedule" && `Times are ${STUDIO_TZ_LABEL}.`}
                  {when === "queue" && "Goes into the next open slot in each account's Buffer posting schedule."}
                  {when === "now" && "Publishes right away."}
                  {when === "draft" && "Saved as a draft in Buffer and shown on that day here. Nothing goes out until you schedule it."}
                </p>
              </div>
            </section>
          </div>

          {/* Preview */}
          <aside className={`min-h-0 overflow-y-auto border-l border-slate-200 bg-[#eceef0] p-5 ${mobileTab === "preview" ? "" : "max-lg:hidden"}`}>
            {chosen.length === 0 && !editing ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
                <Clapperboard className="size-8 text-slate-300" />
                Pick an account to see how the post will look there.
              </div>
            ) : (
              preview
            )}
          </aside>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-white px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          {error && <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {results && (
            <ul className="mb-2 space-y-1 rounded-xl bg-slate-50 px-3 py-2 text-sm">
              {results.map((r) => (
                <li key={r.channelId} className="flex items-start gap-2">
                  {r.ok ? <Check className="mt-0.5 size-4 shrink-0 text-approve" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-decline" />}
                  <span>
                    <span className="font-semibold text-ink">{r.name}</span>
                    <span className="text-slate-500">{r.ok ? " is set." : ` didn't go: ${r.error}`}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            {editing && (
              <button type="button" onClick={remove} disabled={pending} aria-label="Delete post" className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-decline hover:text-decline">
                <Trash2 className="size-5" />
              </button>
            )}
            <p className="hidden min-w-0 flex-1 truncate text-sm text-slate-500 sm:block">
              {count ? (
                <>
                  <span className="font-semibold text-ink">
                    {count} account{count === 1 ? "" : "s"}
                  </span>{" "}
                  · {whenLabel}
                </>
              ) : (
                "Pick at least one account."
              )}
            </p>
            {!editing && when === "schedule" && (
              <button
                type="button"
                onClick={() => submit("draft")}
                disabled={pending || uploading || selected.size === 0}
                className="hidden h-12 shrink-0 items-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-600 hover:border-ink hover:text-ink disabled:opacity-40 sm:inline-flex"
              >
                Save as draft
              </button>
            )}
            <button
              type="button"
              onClick={() => submit()}
              disabled={pending || uploading || (!editing && selected.size === 0)}
              className="ml-auto inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white hover:bg-slate-brand disabled:opacity-40 sm:ml-0 sm:flex-none"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : when === "now" ? <Send className="size-4" /> : null}
              {uploading ? "Uploading…" : action}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Scrub through the video to pick the frame used as its cover. */
function CoverPicker({ tile, onChange }: { tile: Tile; onChange: (ms: number, durationMs?: number) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [dur, setDur] = useState(tile.durationMs ?? 0);
  const [at, setAt] = useState(tile.coverMs ?? 0);
  useEffect(() => {
    const v = ref.current;
    if (v && v.readyState >= 1) v.currentTime = at / 1000;
  }, [at]);
  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
        <Clapperboard className="size-4" /> Cover frame
      </p>
      <p className="text-xs text-slate-500">Slide to pick the frame people see before they tap play. Used on Instagram, TikTok and Pinterest.</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative aspect-[9/16] w-20 shrink-0 overflow-hidden rounded-lg bg-black">
          <video
            ref={ref}
            src={tile.preview}
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={(e) => {
              const d = Math.floor(e.currentTarget.duration * 1000) || 0;
              setDur(d);
              e.currentTarget.currentTime = at / 1000 || 0.05;
              if (!tile.durationMs) onChange(tile.coverMs ?? 0, d);
            }}
            className="size-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={Math.max(dur - 50, 0)}
            step={50}
            value={at}
            disabled={!dur}
            onChange={(e) => {
              const v = Number(e.target.value);
              setAt(v);
              onChange(v);
            }}
            aria-label="Cover frame"
            className="w-full accent-ink"
          />
          <p className="mt-1 text-xs font-semibold text-slate-500">{(at / 1000).toFixed(1)}s{dur ? ` of ${(dur / 1000).toFixed(1)}s` : ""}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Networks (Instagram most of all) only take JPEGs of a sane size, so PNG,
 * WebP, HEIC and huge photos are turned into a JPEG first. Videos go as is.
 */
async function socialReady(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (file.type === "image/jpeg" && file.size < 8_000_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2160 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    return blob ?? file;
  } catch {
    return file;
  }
}

function TileMedia({ t }: { t: Tile }) {
  if (t.isVideo && t.poster && t.coverMs == null) return <img src={t.poster} alt="" className="size-full object-cover" />;
  if (t.isVideo) return <video src={t.preview} muted playsInline preload="metadata" className="size-full object-cover" />;
  return <img src={t.preview} alt={t.alt} className="size-full object-cover" />;
}

/** Opens a fresh composer with the same caption and media. */
export function duplicateMode(post: CalPost, today: string): ComposerMode {
  return { kind: "new", date: today, clientId: post.clientId, text: post.caption, media: post.media.map((m) => ({ url: m.url, isVideo: m.isVideo, thumb: m.thumb, alt: m.alt ?? undefined })) };
}
