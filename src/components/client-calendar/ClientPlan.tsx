"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Lightbulb } from "lucide-react";
import { type Ctx, recordCalendarView } from "@/app/cal/actions";
import type { ClientPost } from "@/lib/client-calendar";
import type { CalComment, Idea, Role } from "@/lib/ideas";
import { IdeasBoard } from "./IdeasBoard";
import { PostsCalendar } from "./PostsCalendar";

export type PlanTab = "calendar" | "ideas";

/** Calendar + Ideas tabs, shared by the client's link and the admin page. */
export function ClientPlan({
  ctx,
  role,
  tab: initialTab,
  posts,
  ideas,
  postComments,
  month,
  today,
  color,
  studioName,
  basePath,
  postsOk,
  ideasReady,
  openIdea,
  onSchedule,
}: {
  ctx: Ctx;
  role: Role;
  tab: PlanTab;
  posts: ClientPost[];
  ideas: Idea[];
  postComments: CalComment[];
  month: string;
  today: string;
  color: string;
  studioName: string;
  basePath: string;
  postsOk: boolean;
  ideasReady: boolean;
  openIdea?: string | null;
  onSchedule?: (idea: Idea) => void;
}) {
  const [tab, setTab] = useState<PlanTab>(initialTab);
  const open = ideas.filter((i) => i.status !== "archived" && i.status !== "done").length;

  useEffect(() => {
    if (role === "client" && ctx.token) {
      let seen = false;
      try {
        seen = sessionStorage.getItem(`kp-cal-seen:${ctx.token}`) === "1";
        sessionStorage.setItem(`kp-cal-seen:${ctx.token}`, "1");
      } catch {
        /* ignore */
      }
      if (!seen) void recordCalendarView(ctx.token);
    }
  }, [role, ctx.token]);

  function pick(t: PlanTab) {
    setTab(t);
    const u = new URL(window.location.href);
    if (t === "ideas") u.searchParams.set("tab", "ideas");
    else u.searchParams.delete("tab");
    window.history.replaceState(null, "", u.toString());
  }

  return (
    <div>
      <div role="tablist" aria-label="Sections" className="inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200">
        <TabButton active={tab === "calendar"} onClick={() => pick("calendar")} icon={<CalendarDays className="size-4" />} label="Calendar" />
        <TabButton active={tab === "ideas"} onClick={() => pick("ideas")} icon={<Lightbulb className="size-4" />} label="Ideas" count={open} />
      </div>
      <div className="mt-4">
        {tab === "calendar" ? (
          <PostsCalendar ctx={ctx} role={role} posts={posts} month={month} today={today} color={color} comments={postComments} studioName={studioName} basePath={basePath} ok={postsOk} />
        ) : (
          <IdeasBoard ctx={ctx} role={role} ideas={ideas} studioName={studioName} ready={ideasReady} onSchedule={onSchedule} openId={openIdea} />
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${active ? "bg-ink text-white" : "text-slate-600 hover:text-ink"}`}
    >
      {icon} {label}
      {!!count && <span className={`rounded-full px-1.5 text-[11px] leading-5 ${active ? "bg-white/15" : "bg-slate-100"}`}>{count}</span>}
    </button>
  );
}
