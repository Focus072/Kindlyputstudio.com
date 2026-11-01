export function VerifiedDot({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="Verified"
      className={`inline-flex size-3.5 items-center justify-center rounded-full bg-room-accent shadow-[0_0_12px_var(--room-accent)] ${className}`}
    >
      <svg viewBox="0 0 12 12" className="size-2.5 text-room-accent-fg" aria-hidden>
        <path
          d="M3 6.2 5.1 8.2 9 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
