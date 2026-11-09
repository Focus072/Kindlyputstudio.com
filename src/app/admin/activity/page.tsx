import { ActivityList } from "@/components/admin/ActivityList";
import { listActivity, markActivitySeen } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Activity" };

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireAdmin();
  const sp = await searchParams;
  const includeViews = sp.views === "1";
  const items = await listActivity(150, { includeViews });
  await markActivitySeen();
  return (
    <main>
      <p className="font-typewriter text-sm text-slate-500">Across every room</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl uppercase leading-none text-ink sm:text-5xl">Activity</h1>
        <a
          href={includeViews ? "/admin/activity" : "/admin/activity?views=1"}
          className="inline-flex min-h-11 items-center rounded-full bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"
        >
          {includeViews ? "Hide room opens" : "Show room opens"}
        </a>
      </div>
      <div className="mt-6">
        <ActivityList items={items} />
      </div>
    </main>
  );
}
