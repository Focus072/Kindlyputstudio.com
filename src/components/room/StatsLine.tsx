import type { RoomStats } from "@/lib/types";

const ITEMS: { key: keyof RoomStats; label: string; tone?: string }[] = [
  { key: "views", label: "views" },
  { key: "comments", label: "notes" },
  { key: "approved", label: "approved", tone: "text-approve" },
  { key: "changes", label: "changes", tone: "text-decline" },
  { key: "pending", label: "pending" },
];

/** Phones: an even 5-up row of counts. Larger screens: one dotted typewriter line. */
export function StatsLine({ stats }: { stats: RoomStats }) {
  return (
    <dl className="grid grid-cols-5 font-typewriter text-room-muted sm:flex sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2 sm:text-[13px]">
      {ITEMS.map((item, i) => (
        <div key={item.key} className="flex items-center gap-4">
          {i > 0 && <span aria-hidden className="hidden size-1 rounded-full bg-room-border sm:block" />}
          <div className="flex w-full flex-col items-center gap-0.5 sm:w-auto sm:flex-row sm:items-baseline sm:gap-1.5">
            <dt className="sr-only">{item.label}</dt>
            <dd className={`text-lg font-bold tabular-nums sm:text-[13px] ${item.tone ?? "text-room-fg"}`}>
              {stats[item.key]}
            </dd>
            <span aria-hidden className="text-[11px] sm:text-[13px]">{item.label}</span>
          </div>
        </div>
      ))}
    </dl>
  );
}
