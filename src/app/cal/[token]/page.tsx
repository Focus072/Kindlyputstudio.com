import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientPlan } from "@/components/client-calendar/ClientPlan";
import { gridRange, dayKey, isMonthKey } from "@/lib/calendar-time";
import { clientByToken, isShareToken, loadClientPosts, loadIdeas } from "@/lib/client-calendar";
import { getStudioSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/cal/[token]">): Promise<Metadata> {
  const { token } = await params;
  const client = isShareToken(token) ? await clientByToken(token) : null;
  const studio = await getStudioSettings();
  const title = client ? `Content calendar · ${client.name}` : "Content calendar";
  const description = `What's going out for ${client?.name ?? "you"}, plus a shared space for post ideas. From ${studio.name}.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
    openGraph: { title, description, type: "website" },
  };
}

export default async function SharedCalendarPage({ params, searchParams }: PageProps<"/cal/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const client = await clientByToken(token);
  if (!client) notFound();

  const today = dayKey(new Date());
  const month = isMonthKey(sp.m) ? sp.m : today.slice(0, 7);
  const range = gridRange(month);
  const [studio, postsData, ideasData] = await Promise.all([getStudioSettings(), loadClientPosts(client.id, range.start, range.end), loadIdeas(client.id)]);

  return (
    <div className="min-h-dvh bg-[#eef0f1]">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pb-10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-mist/80">
              <img src={studio.markOnDark} alt="" className="h-6 w-auto" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">{studio.name}</span>
            </div>
            <h1 className="mt-4 font-display text-5xl uppercase leading-[0.9] sm:text-7xl">Content calendar</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-mist">
              <span className="size-2.5 rounded-full ring-2 ring-white/20" style={{ background: client.color }} />
              Prepared for <span className="font-semibold text-white">{client.name}</span>
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto -mt-5 max-w-6xl px-4 pb-16 sm:px-6">
        <ClientPlan
          ctx={{ token }}
          role="client"
          tab={sp.tab === "ideas" ? "ideas" : "calendar"}
          posts={postsData.posts}
          ideas={ideasData.ideas}
          postComments={ideasData.postComments}
          month={month}
          today={today}
          color={client.color}
          studioName={studio.name}
          basePath={`/cal/${token}`}
          postsOk={postsData.ok}
          ideasReady={ideasData.ready}
          openIdea={typeof sp.idea === "string" ? sp.idea : null}
        />
        <p className="mt-12 text-center text-xs text-slate-400">
          {studio.name} · This is a private link for {client.name}. Anyone with it can see this page.
        </p>
      </main>
    </div>
  );
}
