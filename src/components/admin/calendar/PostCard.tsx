"use client";

import { useState } from "react";
import { CircleAlert, ExternalLink, Pencil, Play } from "lucide-react";
import { type CalPost, STATUS_LABEL, platformInfo } from "@/lib/calendar";
import { timeLabel } from "@/lib/calendar-time";

const statusTone: Record<CalPost["status"], string> = {
  idea: "border border-dashed border-slate-300 text-slate-500",
  draft: "border border-dashed border-slate-400 text-slate-600",
  scheduled: "bg-steel/60 text-ink",
  posted: "bg-approve text-white",
  error: "bg-decline text-white",
};

export function PostCard({ post, color, clientName, onEdit }: { post: CalPost; color: string; clientName: string; onEdit?: () => void }) {
  const [open, setOpen] = useState(false);
  const long = post.caption.length > 160;
  const platform = platformInfo(post.platform);

  return (
    <article className="overflow-hidden rounded-2xl ring-1 ring-slate-200" style={{ boxShadow: `inset 4px 0 0 ${color}` }}>
      <div className="flex gap-3 p-3 pl-4">
        {post.thumb && (
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
            <img src={post.thumb} alt="" loading="lazy" className="size-full object-cover" />
            {post.isVideo && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                <Play className="size-5 fill-white text-white" />
              </span>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-ink">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
              <span className="truncate">{clientName}</span>
            </p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone[post.status]}`}>{STATUS_LABEL[post.status]}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {timeLabel(post.at)} · {platform.label}
            {post.channelName ? ` · ${post.channelName}` : ""}
            {post.source === "buffer" ? " · Buffer" : ""}
          </p>
        </div>
      </div>

      {post.caption && (
        <div className="px-4 pb-3">
          <p className={`whitespace-pre-wrap text-sm text-slate-700 ${!open && long ? "line-clamp-3" : ""}`}>{post.caption}</p>
          {long && (
            <button onClick={() => setOpen(!open)} className="mt-1 text-xs font-semibold text-slate-500 hover:text-ink">
              {open ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
      {post.notes && <p className="mx-4 mb-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{post.notes}</p>}
      {post.status === "error" && (
        <p className="mx-4 mb-3 flex items-center gap-1.5 text-xs font-semibold text-decline">
          <CircleAlert className="size-3.5" /> Buffer couldn&rsquo;t publish this one. Check it in Buffer.
        </p>
      )}

      {(onEdit || post.link || post.source === "buffer") && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-2.5">
          {onEdit && (
            <button onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-ink hover:text-ink">
              <Pencil className="size-3.5" /> Edit
            </button>
          )}
          {post.link && (
            <a href={post.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-ink hover:text-ink">
              <ExternalLink className="size-3.5" /> View post
            </a>
          )}
          {post.source === "buffer" && !post.link && (
            <a href="https://publish.buffer.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-ink hover:text-ink">
              <ExternalLink className="size-3.5" /> Open Buffer
            </a>
          )}
        </div>
      )}
    </article>
  );
}
