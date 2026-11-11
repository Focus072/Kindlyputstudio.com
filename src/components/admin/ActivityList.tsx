import Link from "next/link";
import { Check, Download, Eye, KeyRound, MessageCircle, Send, X } from "lucide-react";
import { describe, type ActivityItem } from "@/lib/activity";
import { timeAgo } from "@/lib/format";

const icons = {
  approve: { Icon: Check, tone: "bg-sage-soft text-sage" },
  decline: { Icon: X, tone: "bg-clay-soft text-clay" },
  comment: { Icon: MessageCircle, tone: "bg-steel/45 text-ink" },
  download: { Icon: Download, tone: "bg-slate-100 text-slate-600" },
  submit: { Icon: Send, tone: "bg-ink text-white" },
  access_request: { Icon: KeyRound, tone: "bg-ochre-soft text-ochre" },
  view: { Icon: Eye, tone: "bg-slate-100 text-slate-600" },
  reset: { Icon: Eye, tone: "bg-slate-100 text-slate-600" },
} as const;

export function ActivityList({
  items,
  empty = "Nothing yet. Activity shows up here as clients review.",
  phoneLimit,
}: {
  items: ActivityItem[];
  empty?: string;
  /** Show only the first few rows on phones (the full list is one tap away). */
  phoneLimit?: number;
}) {
  if (items.length === 0) return <p className="rounded-3xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">{empty}</p>;
  return (
    <ul className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 max-sm:ring-slate-200/80">
      {items.map((a, i) => {
        const { Icon, tone } = icons[a.type] ?? icons.view;
        return (
          <li key={a.id} className={phoneLimit !== undefined && i >= phoneLimit ? "max-sm:hidden" : undefined}>
            {/* Inset hairline between rows, starting after the icon like iOS lists. */}
            <Link
              href={`/admin/rooms/${a.roomId}`}
              className={`relative flex min-h-[60px] items-center gap-3 px-4 py-2.5 hover:bg-slate-50 active:bg-slate-100 sm:py-3 ${
                i ? "before:absolute before:left-[3.75rem] before:right-0 before:top-0 before:h-px before:bg-slate-100" : ""
              }`}
            >
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-snug text-ink max-sm:line-clamp-2 max-sm:[overflow-wrap:anywhere] sm:truncate">{describe(a)}</span>
                <span className="block truncate text-xs text-slate-500">{a.roomTitle}</span>
              </span>
              <span className="shrink-0 text-xs text-slate-400">{timeAgo(a.createdAt)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
