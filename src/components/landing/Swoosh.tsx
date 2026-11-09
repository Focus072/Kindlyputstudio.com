/**
 * The sweeping blade strokes from the KPS brand kit. Pure SVG, decorative only.
 * `tone` sets the color (any CSS color via currentColor).
 */
export function Swoosh({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 600 600"
      aria-hidden
      className={`pointer-events-none select-none ${className}`}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      fill="currentColor"
    >
      <path d="M600 18 Q250 70 70 600 Q300 170 600 18Z" opacity="0.55" />
      <path d="M600 118 Q330 170 190 600 Q380 270 600 118Z" opacity="0.35" />
      <path d="M600 228 Q420 270 320 600 Q470 360 600 228Z" opacity="0.2" />
    </svg>
  );
}
