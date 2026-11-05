"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, ImagePlus, Loader2, Play, Send, Trash2, X } from "lucide-react";
import {
  type ChannelResult,
  type ComposerMedia,
  type ComposerPayload,
  createSocialUpload,
  publishPosts,
  removeBufferPost,
  updateBufferPost,
} from "@/app/admin/calendar/buffer-actions";
import { CAPTION_LIMIT, type CalChannel, type CalClient, type CalPost, platformInfo } from "@/lib/calendar";
import { STUDIO_TZ_LABEL, dayKey, timeInput } from "@/lib/calendar-time";
import { uploadWithProgress } from "@/lib/media";

export type ComposerMode =
  | { kind: "new"; date?: string; clientId?: string | null; text?: string; media?: (ComposerMedia & { thumb?: string | null })[] }
  | { kind: "edit"; post: CalPost };

type Props = { mode: ComposerMode; clients: CalClient[]; channels: CalChannel[]; today: string; onClose: () => void };

type Tile = { id: string; url: string | null; preview: string; poster?: string | null; isVideo: boolean; progress: number; error?: string };

type When = ComposerPayload["when"];

const DRAFT_KEY = "kp-composer-draft";

const field =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-ink focus:ring-4 focus:ring-ink/10 sm:text-sm";

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
          className={`min-h-9 flex-1 rounded-xl px-3 text-sm font-semibold transition sm:flex-none ${value === o.id ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ChannelAvatar({ ch, size = "size-9" }: { ch: Pick<CalChannel, "avatar" | "service">; size?: string }) {
  return ch.avatar ? (
    <img src={ch.avatar} alt="" className={`${size} shrink-0 rounded-full bg-slate-100 object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500`}>{platformInfo(ch.service).short}</span>
  );
}

export function Composer({ mode, clients, channels, today, onClose }: Props) {
  const router = useRouter();
  const editing = mode.kind === "edit" ? mode.post : null;
  const editChannel = editing ? channels.find((c) => c.id === editing.channelId) : null;

  const initialClient = mode.kind === "new" ? (mode.clientId ?? null) : null;
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (editing?.channelId) return new Set([editing.channelId]);
    return new Set(initialClient ? channels.filter((c) => c.clientId === initialClient).map((c) => c.id) : []);
  });

  const startMedia: (ComposerMedia & { thumb?: string | null })[] = editing ? editing.media : mode.kind === "new" ? (mode.media ?? []) : [];
  const [tiles, setTiles] = useState<Tile[]>(() =>
    startMedia.map((m, i) => ({ id: `m${i}`, url: m.url, preview: m.url, poster: m.thumb ?? null, isVideo: m.isVideo, progress: 1 })),
  );
  const [mediaTouched, setMediaTouched] = useState(false);
  const [text, setText] = useState(() => {
    if (editing) return editing.caption;
    if (mode.kind === "new" && mode.text) return mode.text;
    try {
      return localStorage.getItem(DRAFT_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const defaultDate = editing ? dayKey(editing.at) : mode.kind === "new" && mode.date && mode.date >= today ? mode.date : today;
  const [when, setWhen] = useState<When>(editing ? "schedule" : "schedule");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(editing ? timeInput(editing.at) : "10:00");

  const [igType, setIgType] = useState<"post" | "reel" | "story" | null>(null);
  const [igFeed, setIgFeed] = useState(true);
  const [igComment, setIgComment] = useState("");
  const [fbType, setFbType] = useState<"post" | "reel" | "story">("post");
  const [gButton, setGButton] = useState("none");
  const [gLink, setGLink] = useState("");
  const [ytTitle, setYtTitle] = useState("");
  const [ttTitle, setTtTitle] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ChannelResult[] | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

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

  const chosen = channels.filter((c) => selected.has(c.id));
  const services = new Set((editing && !editChannel ? [editing.platform] : chosen.map((c) => c.service)).map((s) => platformInfo(s).id));
  const hasVideo = tiles.some((t) => t.isVideo);
  const uploading = tiles.some((t) => !t.url && !t.error);
  const limit = Math.min(...[...services].map((s) => CAPTION_LIMIT[s] ?? Infinity), Infinity);
  const hashtags = (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
  const effectiveIg = igType ?? (hasVideo ? "reel" : "post");

  const byClient = useMemo(() => {
    const groups = clients.map((c) => ({ client: c as CalClient | null, items: channels.filter((ch) => ch.clientId === c.id) })).filter((g) => g.items.length);
    const loose = channels.filter((ch) => !ch.clientId || !clients.some((c) => c.id === ch.clientId));
    if (loose.length) groups.push({ client: null, items: loose });
    return groups;
  }, [clients, channels]);

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
    const picked = video ? [video] : files.slice(0, 10 - tiles.filter((t) => !t.isVideo).length);
    if (video && tiles.length) setError("A video post has one video, so the video replaced the photos.");
    if (!video && hasVideo) setError("A video post has one video, so the photos replaced it.");
    const fresh: Tile[] = picked.map((f) => ({ id: crypto.randomUUID(), url: null, preview: URL.createObjectURL(f), isVideo: f.type.startsWith("video/"), progress: 0 }));
    setTiles((t) => (video || hasVideo ? fresh : [...t, ...fresh]));
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

  function moveTile(i: number, dir: -1 | 1) {
    setMediaTouched(true);
    setTiles((t) => {
      const n = [...t];
      const j = i + dir;
      if (j < 0 || j >= n.length) return t;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  function removeTile(id: string) {
    setMediaTouched(true);
    setTiles((t) => t.filter((x) => x.id !== id));
  }

  const media: ComposerMedia[] = tiles.filter((t) => t.url).map((t) => ({ url: t.url!, isVideo: t.isVideo }));

  function submit() {
    setError(null);
    if (uploading) return setError("Wait for the uploads to finish.");
    if (tiles.some((t) => t.error)) return setError("Remove the files that didn't upload first.");
    start(async () => {
      if (editing?.bufferId) {
        const r = await updateBufferPost({
          id: editing.bufferId,
          text,
          media: mediaTouched ? media : null,
          when: when === "now" ? "now" : "schedule",
          date,
          time,
        });
        if (r.error) return setError(r.error);
        router.refresh();
        onClose();
        return;
      }
      const r = await publishPosts({
        channelIds: [...selected],
        text,
        media,
        when,
        date,
        time,
        instagram: { type: effectiveIg, shareToFeed: igFeed, firstComment: igComment },
        facebook: { type: fbType },
        google: { button: gButton, link: gLink },
        youtube: { title: ytTitle },
        tiktok: { title: ttTitle },
      });
      if (r.error) return setError(r.error);
      const res = r.results ?? [];
      if (res.length && res.every((x) => x.ok)) {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
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

  const count = selected.size;
  const action =
    when === "now" ? (editing ? "Post now" : `Post now${count > 1 ? ` to ${count}` : ""}`)
    : when === "queue" ? `Add to queue${count > 1 ? ` (${count})` : ""}`
    : when === "draft" ? `Save draft${count > 1 ? `s (${count})` : ""}`
    : editing ? "Save changes"
    : `Schedule${count > 1 ? ` ${count} posts` : ""}`;

  const previewChannel = editChannel ?? chosen[0] ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => !pending && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit post" : "New post"}
        onClick={(e) => e.stopPropagation()}
        className="flex h-dvh w-full flex-col overflow-hidden bg-[#f6f7f8] shadow-2xl sm:h-auto sm:max-h-[94dvh] sm:max-w-5xl sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:pt-3">
          <h2 className="font-display text-3xl uppercase leading-none text-ink">{editing ? "Edit post" : "New post"}</h2>
          <button onClick={onClose} disabled={pending} aria-label="Close" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-slate-100">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6 p-5">
            {/* Accounts */}
            <section>
              <h3 className="text-sm font-bold text-ink">Post to</h3>
              {editing ? (
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                  <ChannelAvatar ch={editChannel ?? { avatar: null, service: editing.platform }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{editChannel?.name ?? editing.channelName ?? "Buffer account"}</span>
                    <span className="block text-xs text-slate-500">{platformInfo(editing.platform).label}</span>
                  </span>
                </div>
              ) : channels.length === 0 ? (
                <p className="mt-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
                  No Buffer accounts yet. Connect Buffer and press Refresh channels in calendar settings.
                </p>
              ) : (
                <div className="mt-2 space-y-3">
                  {byClient.map(({ client, items }) => {
                    const ids = items.map((i) => i.id);
                    const all = ids.every((id) => selected.has(id));
                    return (
                      <div key={client?.id ?? "none"} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                        <button type="button" onClick={() => toggleClient(ids)} className="flex w-full items-center gap-2 text-left">
                          <span className="size-3 rounded-full" style={{ background: client?.color ?? "#cbd5e1" }} />
                          <span className="flex-1 truncate text-sm font-bold text-ink">{client?.name ?? "No client yet"}</span>
                          <span className="text-xs font-semibold text-slate-500">{all ? "Clear" : "Select all"}</span>
                        </button>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {items.map((ch) => {
                            const on = selected.has(ch.id);
                            return (
                              <button
                                key={ch.id}
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggleChannel(ch.id)}
                                className={`relative flex min-w-0 max-w-full items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-semibold transition ${
                                  on ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                              >
                                <ChannelAvatar ch={ch} size="size-7" />
                                <span className="truncate">{ch.name}</span>
                                <span className={`text-[10px] font-bold ${on ? "text-mist" : "text-slate-400"}`}>{platformInfo(ch.service).short}</span>
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
              )}
            </section>

            {/* Media */}
            <section>
              <h3 className="text-sm font-bold text-ink">Photos or video</h3>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
                className={`mt-2 rounded-2xl border-2 border-dashed p-3 transition ${dragOver ? "border-ink bg-white" : "border-slate-300 bg-white/60"}`}
              >
                <div className="flex flex-wrap gap-2">
                  {tiles.map((t, i) => (
                    <div key={t.id} className="group relative size-24 overflow-hidden rounded-xl bg-slate-200 ring-1 ring-black/5 sm:size-28">
                      <TileMedia t={t} />
                      {t.isVideo && (
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 p-1">
                          <Play className="size-3 fill-white text-white" />
                        </span>
                      )}
                      {!t.url && !t.error && (
                        <span className="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-white/60">
                          <span className="block h-full bg-ink transition-[width]" style={{ width: `${Math.round(t.progress * 100)}%` }} />
                        </span>
                      )}
                      {t.error && (
                        <span className="absolute inset-0 flex items-center justify-center bg-red-600/80 p-2 text-center text-[11px] font-semibold text-white">{t.error}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeTile(t.id)}
                        aria-label="Remove"
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black"
                      >
                        <X className="size-3.5" />
                      </button>
                      {tiles.length > 1 && (
                        <span className="absolute inset-x-1 bottom-1 hidden justify-between group-hover:flex">
                          <button type="button" onClick={() => moveTile(i, -1)} aria-label="Move left" className="rounded-full bg-black/60 p-1 text-white disabled:opacity-0" disabled={i === 0}>
                            <ArrowLeft className="size-3" />
                          </button>
                          <button type="button" onClick={() => moveTile(i, 1)} aria-label="Move right" className="rounded-full bg-black/60 p-1 text-white disabled:opacity-0" disabled={i === tiles.length - 1}>
                            <ArrowRight className="size-3" />
                          </button>
                        </span>
                      )}
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
                <p className="mt-2 text-xs text-slate-500">Drop files here. Up to 10 photos for a carousel, or 1 video.</p>
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
            </section>

            {/* Caption */}
            <section>
              <div className="flex items-baseline justify-between">
                <label htmlFor="kp-caption" className="text-sm font-bold text-ink">
                  Caption
                </label>
                <span className={`text-xs font-semibold ${text.length > limit ? "text-decline" : "text-slate-400"}`}>
                  {text.length}
                  {Number.isFinite(limit) ? ` / ${limit}` : ""}
                  {hashtags ? ` · ${hashtags} hashtag${hashtags === 1 ? "" : "s"}` : ""}
                </span>
              </div>
              <textarea id="kp-caption" value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Write the caption…" className={`${field} mt-2`} />
              {services.has("instagram") && hashtags > 30 && <p className="mt-1 text-xs font-semibold text-decline">Instagram allows up to 30 hashtags.</p>}
            </section>

            {/* Per network options */}
            {!editing && (services.has("instagram") || services.has("facebook") || services.has("googlebusiness") || services.has("youtube") || (services.has("tiktok") && !hasVideo)) && (
              <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                {services.has("instagram") && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-ink">Instagram</p>
                    <Segmented
                      label="Instagram post type"
                      value={effectiveIg}
                      onChange={setIgType}
                      options={[
                        { id: "post", label: "Post" },
                        { id: "reel", label: "Reel" },
                        { id: "story", label: "Story" },
                      ]}
                    />
                    {effectiveIg === "reel" && (
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={igFeed} onChange={(e) => setIgFeed(e.target.checked)} className="size-4 accent-ink" />
                        Also show the reel on the main grid
                      </label>
                    )}
                    {effectiveIg !== "story" && <input value={igComment} onChange={(e) => setIgComment(e.target.value)} placeholder="First comment (optional, good for hashtags)" className={field} />}
                  </div>
                )}
                {services.has("facebook") && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-ink">Facebook</p>
                    <Segmented
                      label="Facebook post type"
                      value={fbType}
                      onChange={setFbType}
                      options={[
                        { id: "post", label: "Post" },
                        { id: "reel", label: "Reel" },
                        { id: "story", label: "Story" },
                      ]}
                    />
                  </div>
                )}
                {services.has("googlebusiness") && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-ink">Google Business</p>
                    <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
                      <select value={gButton} onChange={(e) => setGButton(e.target.value)} aria-label="Google button" className={field}>
                        <option value="none">No button</option>
                        <option value="learn_more">Learn more</option>
                        <option value="book">Book</option>
                        <option value="order">Order online</option>
                        <option value="shop">Shop</option>
                        <option value="signup">Sign up</option>
                        <option value="call">Call now</option>
                      </select>
                      {gButton !== "none" && gButton !== "call" && (
                        <input value={gLink} onChange={(e) => setGLink(e.target.value)} type="url" placeholder="https://" aria-label="Button link" className={field} />
                      )}
                    </div>
                  </div>
                )}
                {services.has("youtube") && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-ink">YouTube</p>
                    <input value={ytTitle} onChange={(e) => setYtTitle(e.target.value)} maxLength={100} placeholder="Video title" className={field} />
                  </div>
                )}
                {services.has("tiktok") && !hasVideo && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-ink">TikTok</p>
                    <input value={ttTitle} onChange={(e) => setTtTitle(e.target.value)} maxLength={90} placeholder="Photo post title (optional)" className={field} />
                  </div>
                )}
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
                  options={
                    editing
                      ? [
                          { id: "schedule", label: "Scheduled" },
                          { id: "now", label: "Post now" },
                        ]
                      : [
                          { id: "schedule", label: "Pick a time" },
                          { id: "queue", label: "Next in queue" },
                          { id: "now", label: "Now" },
                          { id: "draft", label: "Draft" },
                        ]
                  }
                />
                {when === "schedule" && (
                  <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                    <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} aria-label="Date" className={field} />
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" className={field} />
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  {when === "schedule" && `Times are ${STUDIO_TZ_LABEL}.`}
                  {when === "queue" && "Goes into the next open slot in each account's Buffer posting schedule."}
                  {when === "now" && "Publishes right away."}
                  {when === "draft" && "Saved as a draft in Buffer. Nothing goes out until you schedule it."}
                </p>
              </div>
            </section>
          </div>

          {/* Preview */}
          <aside className="hidden border-l border-slate-200 bg-white p-5 lg:block">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Preview</p>
            <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-slate-200">
              <div className="flex items-center gap-2 px-3 py-2.5">
                {previewChannel ? <ChannelAvatar ch={previewChannel} size="size-8" /> : <span className="size-8 rounded-full bg-slate-100" />}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{previewChannel?.name ?? "Pick an account"}</span>
              </div>
              <div className="relative aspect-[4/5] bg-slate-100">
                {tiles[0] ? (
                  <TileMedia t={tiles[0]} />
                ) : (
                  <span className="flex size-full items-center justify-center text-xs text-slate-400">No media</span>
                )}
                {tiles.length > 1 && (
                  <span className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
                    {tiles.map((t, i) => (
                      <span key={t.id} className={`size-1.5 rounded-full ${i === 0 ? "bg-white" : "bg-white/50"}`} />
                    ))}
                  </span>
                )}
              </div>
              <p className="line-clamp-6 whitespace-pre-wrap px-3 py-3 text-sm text-slate-700">
                {previewChannel && <span className="font-semibold text-ink">{previewChannel.name} </span>}
                {text || <span className="text-slate-400">Your caption shows here.</span>}
              </p>
            </div>
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
              <>
                <button type="button" onClick={remove} disabled={pending} aria-label="Delete post" className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-decline hover:text-decline">
                  <Trash2 className="size-5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={pending || uploading || (!editing && selected.size === 0)}
              className="ml-auto inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white hover:bg-slate-brand disabled:opacity-40 sm:flex-none"
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
  if (t.isVideo && t.poster) return <img src={t.poster} alt="" className="size-full object-cover" />;
  if (t.isVideo) return <video src={t.preview} muted playsInline preload="metadata" className="size-full object-cover" />;
  return <img src={t.preview} alt="" className="size-full object-cover" />;
}

/** Opens a fresh composer with the same caption and media. */
export function duplicateMode(post: CalPost, today: string): ComposerMode {
  return { kind: "new", date: today, clientId: post.clientId, text: post.caption, media: post.media };
}
