import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ContentCalendar, type CalView } from "@/components/admin/calendar/ContentCalendar";
import { requireAdmin } from "@/lib/auth";
import { getBufferKey } from "@/lib/buffer";
import type { CalPost } from "@/lib/calendar";
import { loadClients, loadComposerChannels, loadRange } from "@/lib/calendar-data";
import { type SyncResult, loadBufferMeta, syncBuffer } from "@/lib/calendar-sync";
import { addDays, dayKey, daysRange, gridRange, isDayKey, isMonthKey, weekDays } from "@/lib/calendar-time";

export const metadata: Metadata = { title: "Calendar" };

const VIEWS: CalView[] = ["week", "month", "list"];

export default async function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  await requireAdmin();
  const sp = await searchParams;
  const today = dayKey(new Date());
  const saved = (await cookies()).get("kp-cal-view")?.value;
  const view: CalView = VIEWS.includes(sp.view as CalView) ? (sp.view as CalView) : VIEWS.includes(saved as CalView) ? (saved as CalView) : "week";
  const anchor = isDayKey(sp.d) ? sp.d : isMonthKey(sp.m) ? (today.startsWith(sp.m) ? today : `${sp.m}-01`) : today;
  const month = view === "week" ? anchor.slice(0, 7) : isMonthKey(sp.m) ? sp.m : anchor.slice(0, 7);
  const week = weekDays(anchor);

  // New Buffer accounts land here on their own: sync (at most every few minutes) before loading.
  const key = await getBufferKey();
  let synced: SyncResult | null = null;
  let syncError: string | null = null;
  if (key) {
    try {
      synced = await syncBuffer(key.key);
    } catch (e) {
      syncError = e instanceof Error ? e.message : "Couldn't reach Buffer.";
    }
  }

  const main = view === "week" ? daysRange(week[0], week[6]) : gridRange(month);
  // The "right now" summary always covers last week through next week.
  const now = daysRange(addDays(today, -7), addDays(today, 7));
  const needsNow = now.start < main.start || now.end > main.end;

  const [{ clients, ready }, mainData, nowData, channels, meta] = await Promise.all([
    loadClients(),
    loadRange(main.start, main.end),
    needsNow ? loadRange(now.start, now.end) : null,
    loadComposerChannels(),
    loadBufferMeta(),
  ]);
  const merged = new Map<string, CalPost>();
  for (const p of [...mainData.posts, ...(nowData?.posts ?? [])]) merged.set(p.id, p);
  const posts = [...merged.values()].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <ContentCalendar
      view={view}
      month={month}
      anchor={anchor}
      today={today}
      clients={clients}
      channels={channels}
      tags={meta.tags}
      posts={posts}
      buffer={mainData.buffer.state === "error" ? mainData.buffer : syncError && mainData.buffer.state !== "ok" ? { state: "error", message: syncError } : mainData.buffer}
      dbReady={ready}
      added={synced?.added ?? []}
      initialClient={typeof sp.c === "string" ? sp.c : null}
    />
  );
}
