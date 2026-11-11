"use client";

import { Check, ClipboardList, Copy, Mail, MessageSquare, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { brand } from "@/config/brand";

type Props = {
  roomId: string;
  slug: string;
  title: string;
  clientName: string;
  deliveredBy: string;
  total: number;
  pending: number;
  changes: number;
  /** Already formatted, for example "Fri, Nov 14". */
  reviewBy: string | null;
};

/** A ready-to-send reminder in G's voice. Nothing is sent from the site: it opens Messages or Mail. */
function draft(p: Props, url: string) {
  const hi = `Hi ${p.clientName.trim()}!`;
  if (p.total === 0) return `${hi} Your ${p.title} room is set up. Files are on the way: ${url}`;
  if (p.pending === 0) {
    return `${hi} Thanks for reviewing ${p.title}. Everything you approved is ready to download here: ${url}`;
  }
  const due = p.reviewBy ? ` by ${p.reviewBy}` : "";
  const left = p.pending === p.total ? `all ${p.total} files are` : `${p.pending} of ${p.total} files are still`;
  return `${hi} Quick reminder from ${p.deliveredBy}: ${left} waiting for your review on ${p.title}. Tap a file to approve it or leave a note${due ? `, ideally${due}` : ""}. ${url}`;
}

/** "Feedback report" and "Remind client" for one room. */
export function FollowUp(props: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  function start() {
    const origin = window.location.hostname === "localhost" ? window.location.origin : brand.siteUrl;
    setMessage(draft(props, `${origin}/r/${props.slug}`));
    setOpen(true);
  }

  const body = encodeURIComponent(message);
  const subject = encodeURIComponent(`${props.title}: ready for your review`);
  const btn =
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300 sm:px-4";

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {props.changes > 0
            ? `${props.changes} ${props.changes === 1 ? "file needs" : "files need"} changes. The report lists every note for your editor.`
            : props.pending > 0
              ? `${props.pending} ${props.pending === 1 ? "file is" : "files are"} waiting on ${props.clientName}.`
              : props.total > 0
                ? `${props.clientName} has reviewed every file.`
                : "Upload files, then send the client the link."}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Link href={`/admin/rooms/${props.roomId}/report`} className={btn}>
            <ClipboardList className="size-4" /> Feedback report
          </Link>
          <button type="button" onClick={open ? () => setOpen(false) : start} className={btn} aria-expanded={open}>
            {open ? <X className="size-4" /> : <MessageSquare className="size-4" />}
            {open ? "Close" : "Remind client"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={1000}
              className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 sm:text-sm"
            />
          </label>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:flex">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message);
                } catch {
                  window.prompt("Copy the message", message);
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className={btn}
            >
              {copied ? <Check className="size-4 text-approve" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <a href={`sms:?&body=${body}`} className={btn}>
              <MessageSquare className="size-4" /> Text
            </a>
            <a href={`mailto:?subject=${subject}&body=${body}`} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white">
              <Mail className="size-4" /> Email
            </a>
          </div>
          <p className="mt-2 text-xs text-slate-400">Opens Messages or your mail app with the text filled in. Nothing is sent until you press send there.</p>
        </div>
      )}
    </div>
  );
}
