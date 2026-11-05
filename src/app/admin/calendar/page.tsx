import type { Metadata } from "next";
import { ContentCalendar } from "@/components/admin/calendar/ContentCalendar";
import { requireAdmin } from "@/lib/auth";
import { loadClients, loadComposerChannels, loadMonth } from "@/lib/calendar-data";
import { dayKey, isMonthKey } from "@/lib/calendar-time";

export const metadata: Metadata = { title: "Content calendar" };

export default async function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  await requireAdmin();
  const sp = await searchParams;
  const today = dayKey(new Date());
  const month = isMonthKey(sp.m) ? sp.m : today.slice(0, 7);
  const [{ clients, ready }, { posts, buffer }, channels] = await Promise.all([loadClients(), loadMonth(month), loadComposerChannels()]);

  return <ContentCalendar month={month} today={today} clients={clients} channels={channels} posts={posts} buffer={buffer} dbReady={ready} />;
}
