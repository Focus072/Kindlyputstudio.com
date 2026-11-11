"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ChevronLeft, Eye, Link2Off, RefreshCw, Share2 } from "lucide-react";
import { createShareLink, markIdeaScheduled, turnOffShareLink } from "@/app/cal/actions";
import { CopyLink } from "@/components/admin/CopyLink";
import { Composer, type ComposerMode } from "@/components/admin/calendar/Composer";
import type { CalChannel, CalClient, CalTag } from "@/lib/calendar";
import { studioToUtc } from "@/lib/calendar-time";
import type { ClientPost, SharedClient } from "@/lib/client-calendar";
import type { CalComment, Idea } from "@/lib/ideas";
import { ClientPlan, type PlanTab } from "./ClientPlan";

function ago(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AdminClientPlan({
  clients,
  client,
  channels,
  tags,
  posts,
  ideas,
  postComments,
  month,
  today,
  tab,
  studioName,
  postsOk,
  ideasReady,
}: {
  clients: SharedClient[];
  client: SharedClient;
  channels: CalChannel[];
  tags: CalTag[];
  posts: ClientPost[];
  ideas: Idea[];
  postComments: CalComment[];
  month: string;
  today: string;
  tab: PlanTab;
  studioName: string;
  postsOk: boolean;
  ideasReady: boolean;
}) {
  const router = useRouter();
  const [composer, setComposer] = useState<{ mode: ComposerMode; idea: Idea } | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const path = client.shareToken ? `/cal/${client.shareToken}` : null;
  const hasAccounts = channels.some((c) => c.clientId === client.id);

  // Keep the chosen client's chip in view on phones.
  useEffect(() => {
    document.querySelector('nav[aria-label="Client"] [aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [client.id]);

  function share() {
    setError(null);
    start(async () => {
      const r = await createShareLink(client.id);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  function turnOff() {
    if (!confirm(`Turn off ${client.name}'s calendar link? Anyone using it will see "link turned off".`)) return;
    start(async () => {
      const r = await turnOffShareLink(client.id);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  function schedule(idea: Idea) {
    const text = [idea.title, idea.body].filter(Boolean).join("\n\n");
    setComposer({ idea, mode: { kind: "new", clientId: client.id, text, date: idea.targetDate && idea.targetDate >= today ? idea.targetDate : today } });
  }

  return (
    <main className="max-w-6xl">
      <Link href="/admin/calendar" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink max-sm:-my-2.5 max-sm:py-2.5">
        <ChevronLeft className="size-4" /> Calendar
      </Link>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-typewriter text-sm text-slate-500 max-sm:hidden">What the client sees</p>
          <h1 className="font-display text-[2.375rem] uppercase leading-none text-ink sm:text-5xl">Client plans</h1>
        </div>
      </div>

      {/* Client picker */}
      <nav aria-label="Client" className="-mx-4 mt-5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/admin/calendar/ideas?c=${c.id}${tab === "ideas" ? "&tab=ideas" : ""}`}
              scroll={false}
              aria-current={c.id === client.id ? "page" : undefined}
              className={`inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ring-1 ${
                c.id === client.id ? "bg-ink text-white ring-ink" : "bg-white text-slate-600 ring-slate-200 hover:ring-ink"
              }`}
            >
              <span className="size-2.5 rounded-full" style={{ background: c.color }} />
              {c.name}
              {c.shareToken && <Share2 className={`size-3.5 ${c.id === client.id ? "text-mist" : "text-slate-400"}`} aria-label="Shared" />}
            </Link>
          ))}
        </div>
      </nav>

      {/* Share link */}
      <section className="mt-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-xl">
            <h2 className="font-display text-2xl uppercase leading-none text-ink">Share with {client.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {path
                ? `${client.name} can open their calendar and ideas board with this link. No account needed. Drafts, internal notes and failed posts stay hidden.`
                : `Make a private link so ${client.name} can see what's scheduled and add ideas. No account needed.`}
            </p>
            {path && (
              <p className="mt-1.5 text-xs text-slate-400">
                Link made {client.shareCreatedAt ? ago(client.shareCreatedAt) : "earlier"} · {client.shareViewedAt ? `last opened ${ago(client.shareViewedAt)}` : "not opened yet"}
              </p>
            )}
            {!hasAccounts && <p className="mt-1.5 text-xs text-amber-800">No Buffer accounts belong to {client.name} yet, so only hand-added plans show. Assign accounts in calendar settings.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {path ? (
              <>
                <CopyLink path={path} label="Copy link" className="h-11" />
                <a href={path} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-full border border-slate-200 px-3.5 text-sm font-semibold text-slate-700 hover:border-ink">
                  <Eye className="size-4" /> Open
                </a>
                <button onClick={share} disabled={pending} title="Make a new link (the old one stops working)" aria-label="Make a new link" className="inline-flex size-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-ink hover:text-ink">
                  <RefreshCw className="size-4" />
                </button>
                <button onClick={turnOff} disabled={pending} title="Turn off the link" aria-label="Turn off the link" className="inline-flex size-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-[#9a4a3c] hover:text-[#9a4a3c]">
                  <Link2Off className="size-4" />
                </button>
              </>
            ) : (
              <button onClick={share} disabled={pending} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-brand disabled:opacity-40">
                <Share2 className="size-4" /> {pending ? "Making link…" : "Make a share link"}
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-[#9a4a3c]">{error}</p>}
      </section>

      <div className="mt-5">
        <ClientPlan
          key={client.id}
          ctx={{ clientId: client.id }}
          role="studio"
          tab={tab}
          posts={posts}
          ideas={ideas}
          postComments={postComments}
          month={month}
          today={today}
          color={client.color}
          studioName={studioName}
          basePath={`/admin/calendar/ideas?c=${client.id}`}
          postsOk={postsOk}
          ideasReady={ideasReady}
          onSchedule={schedule}
        />
      </div>

      {composer && (
        <Composer
          mode={composer.mode}
          clients={clients.map(({ id, name, color }) => ({ id, name, color }) as CalClient)}
          channels={channels}
          tags={tags}
          today={today}
          onClose={() => setComposer(null)}
          onPublished={({ date, time, when }) => {
            // Drafts stay ideas. Queued posts get their slot from Buffer, so no date is recorded.
            if (when === "draft") return;
            const at = when === "schedule" ? studioToUtc(date, time).toISOString() : when === "now" ? new Date().toISOString() : null;
            void markIdeaScheduled(client.id, composer.idea.id, at, when === "now" ? "done" : "scheduled");
          }}
        />
      )}
    </main>
  );
}
