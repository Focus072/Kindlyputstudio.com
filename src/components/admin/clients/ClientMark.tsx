/** Rounded-square monogram in the client's calendar color. */
export function ClientMark({ name, color, size = "size-11", text = "text-sm" }: { name: string; color: string; size?: string; text?: string }) {
  const initials = name
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={`${size} ${text} flex shrink-0 items-center justify-center rounded-[28%] font-display uppercase tracking-wide text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]`}
      style={{ background: `linear-gradient(160deg, ${color}, color-mix(in srgb, ${color} 72%, #1d2b32))` }}
    >
      {initials || "?"}
    </span>
  );
}
