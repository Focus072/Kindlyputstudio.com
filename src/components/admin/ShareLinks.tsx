"use client";

import { Check, Copy, Eye, KeyRound, MessageSquare, Plus, Share2, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { createShareLink, revokeShareLink } from "@/app/admin/actions";
import { brand } from "@/config/brand";
import { timeAgo } from "@/lib/format";

export type ShareLinkItem = {
  id: string;
  path: string;
  label: string | null;
  canReview: boolean;
  expiresAt: string | null;
  openCount: number;
  lastOpenedAt: string | null;
  createdAt: string;
};

const EXPIRY = [
  { days: 0, label: "Never expires" },
  { days: 1, label: "Expires in 1 day" },
  { days: 7, label: "Expires in 7 days" },
  { days: 30, label: "Expires in 30 days" },
  { days: 90, label: "Expires in 90 days" },
];

function fullUrl(path: string) {
  // Always hand out the real domain, even when the admin is open on a preview URL.
  const origin = window.location.hostname === "localhost" ? window.location.origin : brand.siteUrl;
  return `${origin}${path}`;
}

async function copy(path: string) {
  const url = fullUrl(path);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    window.prompt("Copy this link", url);
    return false;
  }
}

const noop = () => () => {};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** No-account links: whoever has one sees the room right away, no sign-up. */
export function ShareLinks({ roomId, roomTitle, links }: { roomId: string; roomTitle: string; links: ShareLinkItem[] }) {
  const [pending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(0);
  const [canReview, setCanReview] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Phones get a "Send" button that opens the share sheet (Messages, WhatsApp, email).
  const canShare = useSyncExternalStore(
    noop,
    () => typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
  // Captured once on the client, so expiry badges don't shift between server and browser.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!copiedId) return;
    const t = setTimeout(() => setCopiedId(null), 1800);
    return () => clearTimeout(t);
  }, [copiedId]);

  async function share(path: string) {
    try {
      await navigator.share({ title: roomTitle, url: fullUrl(path) });
    } catch {
      /* closed the share sheet */
    }
  }

  return (
    <div className={`space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 ${pending ? "opacity-70" : ""}`}>
      <p className="text-sm text-slate-500">
        Whoever opens one of these links sees the room right away, no sign-up. Make one per person so you can turn it off later.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await createShareLink(roomId, { label, canReview, expiresInDays: days });
            if (!res.ok) {
              setNote(res.error);
              return;
            }
            setLabel("");
            const copied = await copy(res.path);
            setNote(copied ? "Link made and copied. Paste it in a text or email." : "Link made.");
          });
        }}
        className="space-y-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 sm:p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Who is this link for?</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              placeholder="Who is it for? e.g. Maria at Crema Cafe"
              className="w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-base outline-none focus:border-brand sm:text-sm"
            />
          </label>
          <label className="relative sm:w-48">
            <span className="sr-only">When the link stops working</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-4 pr-9 text-base text-slate-700 outline-none focus:border-brand sm:text-sm"
            >
              {EXPIRY.map((o) => (
                <option key={o.days} value={o.days}>
                  {o.label}
                </option>
              ))}
            </select>
            <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400">
              <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={canReview}
              onChange={(e) => setCanReview(e.target.checked)}
              className="size-4 rounded border-slate-300 accent-ink"
            />
            Can approve, decline, and leave notes
          </label>
          <button
            disabled={pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            <Plus className="size-4" /> {pending ? "Making link…" : "Make share link"}
          </button>
        </div>
        {note && <p className="text-xs text-slate-500" role="status">{note}</p>}
      </form>

      {links.length === 0 ? (
        <p className="text-sm text-slate-500">No share links yet. Clients can still sign up with the regular room link.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {links.map((link) => {
            const expired = !!link.expiresAt && new Date(link.expiresAt).getTime() <= now;
            return (
              <li key={link.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <KeyRound className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-ink [overflow-wrap:anywhere]">{link.label ?? "Guest link"}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {link.canReview ? <MessageSquare className="size-3" /> : <Eye className="size-3" />}
                        {link.canReview ? "Can review" : "View only"}
                      </span>
                      {expired && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Expired</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {link.openCount > 0
                        ? `Opened ${link.openCount} ${link.openCount === 1 ? "time" : "times"}, last ${timeAgo(link.lastOpenedAt)}`
                        : "Not opened yet"}
                      {" · "}
                      {link.expiresAt ? `${expired ? "Expired" : "Works until"} ${shortDate(link.expiresAt)}` : "No expiry"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
                  {confirmId === link.id ? (
                    <>
                      <span className="text-xs text-slate-500">Turn off this link?</span>
                      <button
                        type="button"
                        onClick={() => start(() => revokeShareLink(roomId, link.id).then(() => setConfirmId(null)))}
                        className="rounded-full bg-decline px-3.5 py-2 text-sm font-bold text-white"
                      >
                        Turn off
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-full border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700"
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      {!expired && (
                        <button
                          type="button"
                          onClick={async () => {
                            await copy(link.path);
                            setCopiedId(link.id);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                        >
                          {copiedId === link.id ? <Check className="size-4 text-approve" /> : <Copy className="size-4" />}
                          {copiedId === link.id ? "Copied" : "Copy"}
                        </button>
                      )}
                      {!expired && canShare && (
                        <button
                          type="button"
                          onClick={() => share(link.path)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700"
                        >
                          <Share2 className="size-4" /> Send
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmId(link.id)}
                        aria-label={`Turn off ${link.label ?? "guest link"}`}
                        title="Turn off this link"
                        className="inline-flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-ink"
                      >
                        <X className="size-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
