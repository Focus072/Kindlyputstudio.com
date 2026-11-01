import type { RoomStats } from "@/lib/types";

const ITEMS: { key: keyof RoomStats; label: string; tone?: string }[] = [
  { key: "views", label: "views" },
  { key: "comments", label: "comments" },
  { key: "approved", label: "approved", tone: "text-approve" },
  { key: "changes", label: "changes", tone: "text-decline" },
  { key: "pending", label: "pending" },
];

export function StatsLine({ stats }: { stats: RoomStats }) {
  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 font-typewriter text-[13px] text-room-muted">
      {ITEMS.map((item, i) => (
        <div key={item.key} className="flex items-center gap-4">
          {i > 0 && <span aria-hidden className="size-1 rounded-full bg-room-border" />}
          <div className="flex items-baseline gap-1.5">
            <dt className="sr-only">{item.label}</dt>
            <dd className={`font-bold tabular-nums text-room-fg ${item.tone ?? ""}`}>
              {stats[item.key]}
            </dd>
            <span aria-hidden>{item.label}</span>
          </div>
        </div>
      ))}
    </dl>
  );
}
