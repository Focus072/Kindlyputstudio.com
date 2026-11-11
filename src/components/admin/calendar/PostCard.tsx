"use client";

import { useState } from "react";
import { CircleAlert, Copy, ExternalLink, MessageCircle, Pencil, Play, RotateCcw } from "lucide-react";
import { type CalPost, STATUS_LABEL, TYPE_LABEL, platformInfo } from "@/lib/calendar";
import { timeLabel } from "@/lib/calendar-time";
import { ChannelAvatar } from "./PlatformIcon";

export const statusTone: Record<CalPost["status"], string> = {
  idea: "border border-dashed border-slate-300 text-slate-500",
  draft: "border border-dashed border-slate-400 text-slate-600",
  scheduled: "bg-steel/60 text-ink",
  posted: "bg-sage-soft text-sage",
  error: "bg-clay-soft text-clay",
};

const btn =
  "inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-ink hover:text-ink max-sm:h-9 max-sm:px-3.5 max-sm:text-[13px]";

export function PostCard({
  post,
  color,
  clientName,
  onEdit,
  onDuplicate,
}: {
  post: CalPost;
  color: string;
  clientName: string;
  onEdit?: () => void;
  onDuplicate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const long = post.caption.length > 160;
  const platform = platformInfo(post.platform);
  // A reminder post is "sent" once Buffer pings the phone, even if nobody finished it.
  const reminded = post.status === "posted" && post.reminder;
  const type = post.meta?.type && post.meta.type !== "post" ? TYPE_LABEL[post.meta.type] ?? null : post.media.length > 1 ? "Carousel" : null;

  return (
    <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200" style={{ boxShadow: `inset 4px 0 0 ${color}` }}>
      <div className="flex gap-3 p-3 pl-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              {post.source === "buffer" ? (
                <ChannelAvatar avatar={post.channelAvatar} service={post.platform} name={post.channelName} size="size-9" badge="size-4" />
              ) : (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: color }}>
                  {platform.short}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-ink">{post.channelName ?? clientName}</span>
                <span className="flex min-w-0 items-center gap-1 text-xs text-slate-500">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="truncate">
                    {clientName} · {timeLabel(post.at)}
                    {post.source === "manual" ? " · Plan" : ""}
                  </span>
                </span>
              </span>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${reminded ? "bg-amber-100 text-amber-800" : statusTone[post.status]}`}>
              {reminded ? "Reminder sent" : STATUS_LABEL[post.status]}
            </span>
          </div>
        </div>
      </div>

      {post.media.length > 0 || post.thumb ? (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-3">
          {(post.media.length ? post.media : [{ url: post.thumb!, thumb: post.thumb, isVideo: post.isVideo }]).slice(0, 6).map((m, i) => (
            <div key={i} className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
              {m.thumb || !m.isVideo ? (
                <img src={m.thumb || m.url} alt={("alt" in m && m.alt) || ""} loading="lazy" className="size-full object-cover" />
              ) : (
                <video src={m.url} muted playsInline preload="metadata" className="size-full object-cover" />
              )}
              {m.isVideo && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Play className="size-5 fill-white text-white" />
                </span>
              )}
            </div>
          ))}
          {post.media.length > 6 && <span className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">+{post.media.length - 6}</span>}
        </div>
      ) : null}

      {(!!type || !!post.tags?.length) && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {type && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{platform.label} {type}</span>}
          {post.tags?.map((t) => (
            <span key={t.id} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${t.color || "#64748b"}22`, color: t.color || "#475569" }}>
              {t.name}
            </span>
          ))}
        </div>
      )}

      {post.caption && (
        <div className="px-4 pb-3">
          <p className={`whitespace-pre-wrap break-words text-sm text-slate-700 ${!open && long ? "line-clamp-3" : ""}`}>{post.caption}</p>
          {long && (
            <button onClick={() => setOpen(!open)} className="mt-1 text-xs font-semibold text-slate-500 hover:text-ink">
              {open ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
      {post.meta?.firstComment && (
        <p className="mx-4 mb-3 flex items-start gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <MessageCircle className="mt-px size-3.5 shrink-0" />
          <span className="line-clamp-2 break-words">First comment: {post.meta.firstComment}</span>
        </p>
      )}
      {post.notes && <p className="mx-4 mb-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{post.notes}</p>}
      {post.status === "error" && (
        <p className="mx-4 mb-3 flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-decline">
          <CircleAlert className="mt-px size-3.5 shrink-0" />
          <span>{post.errorMessage ? `${platform.label} said: ${post.errorMessage}` : "This one didn't publish."} Edit it to try again.</span>
        </p>
      )}

      {reminded && (
        <p className="mx-4 mb-3 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <CircleAlert className="mt-px size-3.5 shrink-0" />
          <span>Buffer only sent a phone reminder for this one. It&rsquo;s live only if someone finished posting it in the {platform.label} app.</span>
        </p>
      )}

      {(onEdit || onDuplicate || post.link || post.author) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5">
          {onEdit && (
            <button onClick={onEdit} className={btn}>
              {post.status === "error" ? <RotateCcw className="size-3.5" /> : <Pencil className="size-3.5" />} {post.status === "error" ? "Fix & retry" : "Edit"}
            </button>
          )}
          {onDuplicate && (
            <button onClick={onDuplicate} className={btn}>
              <Copy className="size-3.5" /> Duplicate
            </button>
          )}
          {post.link && (
            <a href={post.link} target="_blank" rel="noreferrer" className={btn}>
              <ExternalLink className="size-3.5" /> {reminded ? `Check on ${platform.label}` : "View post"}
            </a>
          )}
          {post.author && <span className="ml-auto text-[11px] text-slate-400">by {post.author.split(" ")[0]}</span>}
        </div>
      )}
    </article>
  );
}
