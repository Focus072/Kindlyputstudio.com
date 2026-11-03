/** Tiled studio name over a preview. A deterrent for screenshots, not DRM. */
export function Watermark({ label, size = "sm" }: { label: string; size?: "sm" | "lg" }) {
  const rows = size === "lg" ? 7 : 4;
  return (
    <span aria-hidden className="kp-watermark pointer-events-none absolute inset-0 select-none overflow-hidden">
      <span className="absolute -inset-1/2 flex rotate-[-30deg] flex-col justify-around">
        {Array.from({ length: rows }, (_, i) => (
          <span
            key={i}
            className={`whitespace-nowrap text-center font-display uppercase tracking-[0.3em] text-white/25 ${
              size === "lg" ? "text-3xl sm:text-5xl" : "text-sm sm:text-base"
            }`}
            style={{ marginLeft: i % 2 ? "-20%" : "0" }}
          >
            {`${label} · `.repeat(6)}
          </span>
        ))}
      </span>
    </span>
  );
}
