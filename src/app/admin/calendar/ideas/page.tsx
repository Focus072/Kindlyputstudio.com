import type { Metadata } from "next";
import Link from "next/link";
import { AdminClientPlan } from "@/components/client-calendar/AdminClientPlan";
import { requireAdmin } from "@/lib/auth";
import { dayKey, gridRange, isMonthKey } from "@/lib/calendar-time";
import { loadComposerChannels } from "@/lib/calendar-data";
import { loadBufferMeta } from "@/lib/calendar-sync";
import { loadClientPosts, loadIdeas, loadSharedClients } from "@/lib/client-calendar";
import { getStudioSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Client plans" };

export default async function ClientPlansPage({ searchParams }: PageProps<"/admin/calendar/ideas">) {
  await requireAdmin();
  const sp = await searchParams;
  const clients = await loadSharedClients();
  const client = clients.find((c) => c.id === sp.c) ?? clients[0];

  if (!client) {
    return (
      <main className="max-w-3xl">
        <h1 className="font-display text-5xl uppercase leading-none text-ink">Client plans</h1>
        <p className="mt-4 text-sm text-slate-500">
          Add a client in{" "}
          <Link href="/admin/calendar/settings" className="font-semibold text-ink underline underline-offset-2">
            calendar settings
          </Link>{" "}
          first. Then you can share their calendar and ideas board here.
        </p>
      </main>
    );
  }

  const today = dayKey(new Date());
  const month = isMonthKey(sp.m) ? sp.m : today.slice(0, 7);
  const range = gridRange(month);
  const [studio, postsData, ideasData, channels, meta] = await Promise.all([
    getStudioSettings(),
    loadClientPosts(client.id, range.start, range.end),
    loadIdeas(client.id),
    loadComposerChannels(),
    loadBufferMeta(),
  ]);

  return (
    <AdminClientPlan
      clients={clients}
      client={client}
      channels={channels}
      tags={meta.tags}
      posts={postsData.posts}
      ideas={ideasData.ideas}
      postComments={ideasData.postComments}
      month={month}
      today={today}
      tab={sp.tab === "ideas" ? "ideas" : "calendar"}
      studioName={studio.name}
      postsOk={postsData.ok}
      ideasReady={ideasData.ready}
    />
  );
}
