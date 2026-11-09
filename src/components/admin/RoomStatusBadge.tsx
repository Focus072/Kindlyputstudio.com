import type { roomAvailability } from "@/lib/data";

const states = {
  draft: { label: "Draft", color: "bg-amber-50 text-amber-900" },
  live: { label: "Live", color: "bg-emerald-50 text-emerald-900" },
  expired: { label: "Expired", color: "bg-rose-50 text-rose-900" },
  archived: { label: "Archived", color: "bg-slate-100 text-slate-700" },
};

export function RoomStatusBadge({ status }: { status: ReturnType<typeof roomAvailability> }) {
  const { label, color } = states[status];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{label}</span>;
}
