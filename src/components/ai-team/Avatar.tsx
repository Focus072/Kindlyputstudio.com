import type { Specialist } from "@/lib/ai-team/specialists";

/** Simple initial avatar. Clearly marked as an AI team member. */
export function Avatar({ s, size = 40 }: { s: Pick<Specialist, "name" | "color">; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: s.color, fontSize: size * 0.42 }}
      aria-label={`${s.name}, AI team member`}
      title={`${s.name} · AI team member`}
    >
      {s.name[0]}
    </span>
  );
}

export function SpecialistBadge() {
  return <span className="badge ai">AI</span>;
}
