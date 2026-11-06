import Link from "next/link";
import { Check, Download, Eye, KeyRound, MessageCircle, Send, X } from "lucide-react";
import { describe, type ActivityItem } from "@/lib/activity";
import { timeAgo } from "@/lib/format";

const icons = {
  approve: { Icon: Check, tone: "bg-approve text-white" },
  decline: { Icon: X, tone: "bg-decline text-white" },
  comment: { Icon: MessageCircle, tone: "bg-brand text-white" },
  download: { Icon: Download, tone: "bg-slate-200 text-slate-700" },
  submit: { Icon: Send, tone: "bg-ink text-white" },
  access_request: { Icon: KeyRound, tone: "bg-amber-400 text-amber-950" },
  view: { Icon: Eye, tone: "bg-slate-100 text-slate-600" },
  reset: { Icon: Eye, tone: "bg-slate-100 text-slate-600" },
} as const;

export function ActivityList({ items, empty = "Nothing yet. Activity shows up here as clients review." }: { items: ActivityItem[]; empty?: string }) {
  if (items.length === 0) return <p className="rounded-3xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      {items.map((a) => {
        const { Icon, tone } = icons[a.type] ?? icons.view;
        return (
          <li key={a.id}>
            <Link href={`/admin/rooms/${a.roomId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{describe(a)}</span>
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
