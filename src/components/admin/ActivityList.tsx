import { Check, Download, Eye, KeyRound, MessageCircle, RotateCcw, Send, X } from "lucide-react";
import { describe, type ActivityItem } from "@/lib/activity";
import { STUDIO_TZ } from "@/lib/calendar-time";

const icons = {
  approve: { Icon: Check, tone: "bg-approve text-white" },
  decline: { Icon: X, tone: "bg-decline text-white" },
  comment: { Icon: MessageCircle, tone: "bg-brand text-white" },
  download: { Icon: Download, tone: "bg-slate-200 text-slate-700" },
  submit: { Icon: Send, tone: "bg-ink text-white" },
  access_request: { Icon: KeyRound, tone: "bg-amber-400 text-amber-950" },
  view: { Icon: Eye, tone: "bg-slate-100 text-slate-600" },
  reset: { Icon: RotateCcw, tone: "bg-slate-100 text-slate-700" },
} as const;

const eventTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
  timeZone: STUDIO_TZ,
});

export function ActivityList({ items, empty = "Nothing yet. Activity shows up here as clients review." }: { items: ActivityItem[]; empty?: string }) {
  if (items.length === 0) return <p className="rounded-3xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      {items.map((a) => {
        const { Icon, tone } = icons[a.type] ?? icons.view;
        const fileEvent = a.fileName || a.type === "approve" || a.type === "decline" || a.type === "reset" || a.type === "comment";
        const target = a.currentFileId ? `#file-${a.currentFileId}` : fileEvent ? "#files" : "";
        return (
          <li key={a.id}>
            <a href={`/admin/rooms/${a.roomId}${target}`} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 px-4 py-3 hover:bg-slate-50 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
              <span aria-hidden className={`flex size-8 items-center justify-center rounded-full ${tone}`}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 [overflow-wrap:anywhere]">
                <span className="block text-sm text-ink">{describe(a)}</span>
                <span className="block text-xs text-slate-600">{a.roomTitle}</span>
              </span>
              <time dateTime={a.createdAt} className="col-start-2 text-xs text-slate-600 sm:col-start-auto">
                {eventTime.format(new Date(a.createdAt))}
              </time>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
