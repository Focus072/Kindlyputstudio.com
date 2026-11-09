"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Ellipsis, Globe, Heart, MessageCircle, Music2, Play, Repeat2, Send, Share2, ThumbsUp } from "lucide-react";
import { platformInfo } from "@/lib/calendar";

// Look-alike previews of how a post will appear on each network. They're
// close, not pixel copies: the point is to catch crops, cut-off captions and
// missing covers before anything goes out.

export type PreviewMedia = { id: string; src: string; poster?: string | null; isVideo: boolean; coverMs?: number | null; alt?: string };

export type PreviewProps = {
  service: string;
  type: string;
  name: string;
  avatar: string | null;
  text: string;
  media: PreviewMedia[];
  firstComment?: string;
  title?: string;
  button?: string;
  linkLabel?: string;
};

function Avatar({ src, name, className = "size-8" }: { src: string | null; name: string; className?: string }) {
  return src ? (
    <img src={src} alt="" className={`${className} shrink-0 rounded-full bg-slate-200 object-cover`} />
  ) : (
    <span className={`${className} flex shrink-0 items-center justify-center rounded-full bg-slate-300 text-[10px] font-bold uppercase text-slate-600`}>{name.replace(/[^a-z0-9]/gi, "").slice(0, 2)}</span>
  );
}

/** A photo, or a video frozen on its chosen cover frame. */
function Frame({ m, className = "", fit = "cover" }: { m: PreviewMedia; className?: string; fit?: "cover" | "contain" }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || !m.isVideo) return;
    const seek = () => {
      try {
        v.currentTime = Math.max(0, (m.coverMs ?? 0) / 1000) || 0.05;
      } catch {
        /* not seekable yet */
      }
    };
    if (v.readyState >= 1) seek();
    v.addEventListener("loadedmetadata", seek);
    return () => v.removeEventListener("loadedmetadata", seek);
  }, [m.isVideo, m.coverMs, m.src]);
  const cls = `size-full ${fit === "cover" ? "object-cover" : "object-contain"} ${className}`;
  if (!m.isVideo) return <img src={m.src} alt={m.alt || ""} className={cls} />;
  if (m.coverMs == null && m.poster) return <img src={m.poster} alt="" className={cls} />;
  return <video ref={ref} src={m.src} muted playsInline preload="auto" className={cls} />;
}

function Carousel({ media, aspect, dots = true }: { media: PreviewMedia[]; aspect: string; dots?: boolean }) {
  const [i, setI] = useState(0);
  const at = Math.min(i, media.length - 1);
  if (!media.length) return <div className={`${aspect} flex items-center justify-center bg-slate-100 text-xs text-slate-400`}>Add a photo or video</div>;
  return (
    <div className={`relative ${aspect} overflow-hidden bg-black`}>
      <Frame m={media[at]} />
      {media[at].isVideo && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/40 p-3">
            <Play className="size-6 fill-white text-white" />
          </span>
        </span>
      )}
      {media.length > 1 && (
        <>
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
            {at + 1}/{media.length}
          </span>
          {at > 0 && (
            <button type="button" onClick={() => setI(at - 1)} aria-label="Previous photo" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 text-ink shadow">
              <ChevronLeft className="size-4" />
            </button>
          )}
          {at < media.length - 1 && (
            <button type="button" onClick={() => setI(at + 1)} aria-label="Next photo" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 text-ink shadow">
              <ChevronRight className="size-4" />
            </button>
          )}
        </>
      )}
      {dots && media.length > 1 && (
        <span className="absolute inset-x-0 -bottom-5 flex justify-center gap-1">
          {media.map((m, k) => (
            <span key={m.id} className={`size-1.5 rounded-full ${k === at ? "bg-[#0095f6]" : "bg-slate-300"}`} />
          ))}
        </span>
      )}
    </div>
  );
}

function Caption({ name, text, lines = 2 }: { name: string; text: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 125 || text.split("\n").length > lines;
  return (
    <p className={`whitespace-pre-wrap break-words text-[13px] leading-snug text-[#0c1014] ${!open && long ? "line-clamp-2" : ""}`}>
      <span className="font-semibold">{name}</span> {text ? linkify(text) : <span className="text-slate-400">Your caption shows here.</span>}
      {!open && long && (
        <button type="button" onClick={() => setOpen(true)} className="ml-1 text-slate-500">
          … more
        </button>
      )}
    </p>
  );
}

/** Hashtags and mentions in network blue. */
function linkify(text: string) {
  return text.split(/([#@][\p{L}\p{N}_.]+)/u).map((part, i) =>
    /^[#@]/.test(part) ? (
      <span key={i} className="text-[#00376b]">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function InstagramFeed(p: PreviewProps) {
  return (
    <div className="bg-white pb-3">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="rounded-full bg-gradient-to-tr from-[#f9a825] via-[#e1306c] to-[#833ab4] p-[2px]">
          <span className="block rounded-full bg-white p-[1.5px]">
            <Avatar src={p.avatar} name={p.name} className="size-7" />
          </span>
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#0c1014]">{p.name}</span>
        <Ellipsis className="size-4 text-[#0c1014]" />
      </div>
      <Carousel media={p.media} aspect={p.media[0]?.isVideo ? "aspect-[4/5]" : "aspect-[4/5]"} />
      <div className="mt-2 flex items-center gap-3.5 px-3 pt-1 text-[#0c1014]">
        <Heart className="size-6" />
        <MessageCircle className="size-6 -scale-x-100" />
        <Send className="size-6" />
        <Bookmark className="ml-auto size-6" />
      </div>
      <p className="px-3 pt-2 text-[13px] font-semibold text-[#0c1014]">0 likes</p>
      <div className="px-3 pt-0.5">
        <Caption name={p.name} text={p.text} />
      </div>
      {p.firstComment && (
        <div className="px-3 pt-1">
          <p className="text-[13px] text-slate-500">View 1 comment</p>
          <p className="line-clamp-2 text-[13px] text-[#0c1014]">
            <span className="font-semibold">{p.name}</span> {linkify(p.firstComment)}
          </p>
        </div>
      )}
      <p className="px-3 pt-1 text-[11px] uppercase tracking-wide text-slate-400">Just now</p>
    </div>
  );
}

function Vertical({ p, kind }: { p: PreviewProps; kind: "reel" | "story" | "tiktok" | "fbreel" }) {
  const m = p.media[0];
  return (
    <div className="relative aspect-[9/16] overflow-hidden bg-black text-white">
      {m ? <Frame m={m} /> : <span className="flex size-full items-center justify-center text-xs text-white/60">Add a vertical video</span>}
      {kind === "story" && (
        <>
          <span className="absolute inset-x-2 top-2 flex gap-1">
            {(p.media.length ? p.media : [null]).map((_, i) => (
              <span key={i} className={`h-0.5 flex-1 rounded-full ${i === 0 ? "bg-white" : "bg-white/40"}`} />
            ))}
          </span>
          <span className="absolute left-3 top-5 flex items-center gap-2">
            <Avatar src={p.avatar} name={p.name} className="size-7" />
            <span className="text-[13px] font-semibold drop-shadow">{p.name}</span>
            <span className="text-[12px] text-white/70">1m</span>
          </span>
          <span className="absolute inset-x-3 bottom-3 flex items-center gap-2">
            <span className="flex-1 rounded-full border border-white/60 px-3 py-2 text-[12px] text-white/80">Send message</span>
            <Heart className="size-6" />
            <Send className="size-6" />
          </span>
        </>
      )}
      {kind !== "story" && (
        <>
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
          <span className="absolute bottom-16 right-2.5 flex flex-col items-center gap-4 text-[11px] font-semibold">
            {kind === "tiktok" ? (
              <>
                <Avatar src={p.avatar} name={p.name} className="size-9 ring-2 ring-white" />
                <span className="flex flex-col items-center gap-0.5">
                  <Heart className="size-7 fill-white" />0
                </span>
                <span className="flex flex-col items-center gap-0.5">
                  <MessageCircle className="size-7 fill-white" />0
                </span>
                <span className="flex flex-col items-center gap-0.5">
                  <Bookmark className="size-7 fill-white" />0
                </span>
                <span className="flex flex-col items-center gap-0.5">
                  <Share2 className="size-7" />
                  Share
                </span>
              </>
            ) : (
              <>
                <span className="flex flex-col items-center gap-0.5">
                  <Heart className="size-7" />0
                </span>
                <span className="flex flex-col items-center gap-0.5">
                  <MessageCircle className="size-7 -scale-x-100" />0
                </span>
                <Repeat2 className="size-7" />
                <Send className="size-7" />
                <Ellipsis className="size-6" />
              </>
            )}
          </span>
          <span className="absolute inset-x-3 bottom-3 pr-12">
            <span className="flex items-center gap-2">
              {kind !== "tiktok" && <Avatar src={p.avatar} name={p.name} className="size-7" />}
              <span className="text-[13px] font-semibold">{kind === "tiktok" ? `@${p.name}` : p.name}</span>
              {kind !== "tiktok" && <span className="rounded-md border border-white/70 px-2 py-0.5 text-[11px] font-semibold">Follow</span>}
            </span>
            <span className="mt-1.5 line-clamp-2 block whitespace-pre-wrap break-words text-[12px] leading-snug">{p.title && kind === "tiktok" ? `${p.title} · ` : ""}{p.text || "Your caption shows here."}</span>
            <span className="mt-1.5 flex items-center gap-1 text-[11px] text-white/80">
              <Music2 className="size-3" /> Original audio · {p.name}
            </span>
          </span>
        </>
      )}
    </div>
  );
}

function Facebook(p: PreviewProps) {
  return (
    <div className="bg-white pb-1">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Avatar src={p.avatar} name={p.name} className="size-9" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-[#050505]">{p.name}</span>
          <span className="flex items-center gap-1 text-[12px] text-[#65676b]">
            Just now · <Globe className="size-3" />
          </span>
        </span>
        <Ellipsis className="size-5 text-[#65676b]" />
      </div>
      <p className="whitespace-pre-wrap break-words px-3 pb-2 text-[14px] leading-snug text-[#050505]">{p.text ? linkify(p.text) : <span className="text-slate-400">Your caption shows here.</span>}</p>
      {p.media.length > 0 && (
        <div className={`grid gap-0.5 ${p.media.length > 1 ? "grid-cols-2" : ""}`}>
          {p.media.slice(0, 4).map((m, i) => (
            <div key={m.id} className={`relative overflow-hidden bg-slate-100 ${p.media.length === 1 ? "aspect-[4/5]" : "aspect-square"}`}>
              <Frame m={m} />
              {i === 3 && p.media.length > 4 && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-bold text-white">+{p.media.length - 4}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="mx-3 mt-1 flex justify-around border-t border-slate-200 py-1.5 text-[13px] font-semibold text-[#65676b]">
        <span className="flex items-center gap-1.5">
          <ThumbsUp className="size-4" /> Like
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="size-4" /> Comment
        </span>
        <span className="flex items-center gap-1.5">
          <Share2 className="size-4" /> Share
        </span>
      </div>
      {p.firstComment && (
        <div className="mx-3 mb-2 flex gap-2">
          <Avatar src={p.avatar} name={p.name} className="size-7" />
          <span className="rounded-2xl bg-[#f0f2f5] px-3 py-1.5 text-[13px]">
            <span className="block font-semibold">{p.name}</span>
            <span className="line-clamp-2">{p.firstComment}</span>
          </span>
        </div>
      )}
    </div>
  );
}

const GOOGLE_BUTTON: Record<string, string> = { learn_more: "Learn more", book: "Book", order: "Order online", shop: "Buy", signup: "Sign up", call: "Call now" };

function GoogleBusiness(p: PreviewProps) {
  return (
    <div className="bg-white p-3">
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Avatar src={p.avatar} name={p.name} className="size-8" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium text-[#202124]">{p.name}</span>
            <span className="block text-[12px] text-[#70757a]">Just now</span>
          </span>
        </div>
        {p.media[0] && (
          <div className="aspect-[4/3] bg-slate-100">
            <Frame m={p.media[0]} />
          </div>
        )}
        <div className="px-3 py-3">
          {p.title && <p className="mb-1 text-[15px] font-medium text-[#202124]">{p.title}</p>}
          {p.type === "offer" && p.linkLabel && <p className="mb-1 text-[12px] font-medium text-[#188038]">{p.linkLabel}</p>}
          <p className="line-clamp-4 whitespace-pre-wrap break-words text-[13px] leading-snug text-[#3c4043]">{p.text || <span className="text-slate-400">Your update shows here.</span>}</p>
          {p.button && p.button !== "none" && (
            <span className="mt-3 inline-flex rounded-full border border-slate-300 px-4 py-1.5 text-[13px] font-medium text-[#1a73e8]">{GOOGLE_BUTTON[p.button] ?? "Learn more"}</span>
          )}
          {p.type === "offer" && <span className="mt-3 inline-flex rounded-full border border-slate-300 px-4 py-1.5 text-[13px] font-medium text-[#1a73e8]">View offer</span>}
        </div>
      </div>
    </div>
  );
}

function YouTube(p: PreviewProps) {
  return (
    <div className="bg-white pb-3">
      <div className="relative aspect-video bg-black">
        {p.media[0] ? <Frame m={p.media[0]} fit="contain" /> : <span className="flex size-full items-center justify-center text-xs text-white/60">Add a video</span>}
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1 text-[11px] font-semibold text-white">0:30</span>
      </div>
      <div className="flex gap-3 px-3 pt-3">
        <Avatar src={p.avatar} name={p.name} className="size-9" />
        <span className="min-w-0">
          <span className="line-clamp-2 text-[14px] font-medium leading-snug text-[#0f0f0f]">{p.title || <span className="text-slate-400">Video title</span>}</span>
          <span className="mt-0.5 block text-[12px] text-[#606060]">{p.name} · 0 views · Just now</span>
        </span>
      </div>
    </div>
  );
}

function TextFirst(p: PreviewProps) {
  const label = platformInfo(p.service).label;
  return (
    <div className="bg-white p-3">
      <div className="flex gap-2.5">
        <Avatar src={p.avatar} name={p.name} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px]">
            <span className="font-bold text-[#0f1419]">{p.name}</span> <span className="text-slate-500">· now</span>
          </p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-snug text-[#0f1419]">{p.text ? linkify(p.text) : <span className="text-slate-400">Your post shows here.</span>}</p>
          {p.media.length > 0 && (
            <div className={`mt-2 grid gap-0.5 overflow-hidden rounded-2xl border border-slate-200 ${p.media.length > 1 ? "grid-cols-2" : ""}`}>
              {p.media.slice(0, 4).map((m) => (
                <div key={m.id} className={`${p.media.length === 1 ? "aspect-[4/3]" : "aspect-square"} bg-slate-100`}>
                  <Frame m={m} />
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 flex gap-6 text-slate-500">
            <MessageCircle className="size-4" />
            <Repeat2 className="size-4" />
            <Heart className="size-4" />
          </p>
          {p.firstComment && <p className="mt-2 border-t border-slate-100 pt-2 text-[12px] text-slate-500">First comment: {p.firstComment}</p>}
        </div>
      </div>
      <p className="mt-2 text-right text-[10px] uppercase tracking-wider text-slate-300">{label}</p>
    </div>
  );
}

function Pinterest(p: PreviewProps) {
  return (
    <div className="bg-white p-3">
      <div className="mx-auto max-w-[220px]">
        <div className="overflow-hidden rounded-2xl bg-slate-100">{p.media[0] ? <Frame m={p.media[0]} className="!h-auto" /> : <div className="aspect-[2/3]" />}</div>
        <p className="mt-2 line-clamp-2 text-[13px] font-semibold text-[#111]">{p.title || p.text || "Pin title"}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-600">
          <Avatar src={p.avatar} name={p.name} className="size-5" /> {p.name}
        </p>
      </div>
    </div>
  );
}

export function PostPreview(p: PreviewProps) {
  const s = platformInfo(p.service).id;
  if (s === "instagram") {
    if (p.type === "reel") return <Vertical p={p} kind="reel" />;
    if (p.type === "story") return <Vertical p={p} kind="story" />;
    return <InstagramFeed {...p} />;
  }
  if (s === "facebook") {
    if (p.type === "reel") return <Vertical p={p} kind="fbreel" />;
    if (p.type === "story") return <Vertical p={p} kind="story" />;
    return <Facebook {...p} />;
  }
  if (s === "tiktok") return <Vertical p={p} kind="tiktok" />;
  if (s === "googlebusiness") return <GoogleBusiness {...p} />;
  if (s === "youtube") return <YouTube {...p} />;
  if (s === "pinterest") return <Pinterest {...p} />;
  return <TextFirst {...p} />;
}
