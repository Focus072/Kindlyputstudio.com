import { platformInfo } from "@/lib/calendar";

// Small network marks drawn here (lucide has no brand icons). Simple shapes,
// recognizable at 10 to 20 px.

function Glyph({ id }: { id: string }) {
  switch (id) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="size-full">
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-full">
          <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.1H7.7v3h2.6V21h3.2Z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-full">
          <path d="M16.6 3c.3 2.2 1.6 3.6 3.9 3.8v3c-1.4.1-2.7-.3-3.9-1.1v5.9c0 3.4-2.6 6.4-6.3 6.4-3.4 0-5.9-2.7-5.9-5.9 0-3.6 3.2-6.4 7-5.8v3.2c-1.8-.4-3.6.7-3.6 2.6 0 1.5 1.1 2.7 2.6 2.7 1.6 0 2.8-1.2 2.8-3.1V3h3.4Z" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-full">
          <path d="M9.5 15.5v-7l6 3.5-6 3.5Z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-full">
          <path d="M5 9h3v10H5V9Zm1.5-4.8a1.7 1.7 0 1 1 0 3.5 1.7 1.7 0 0 1 0-3.5ZM10 9h2.9v1.4c.4-.8 1.4-1.6 2.9-1.6 3.1 0 3.7 2 3.7 4.7V19h-3v-4.9c0-1.2 0-2.6-1.6-2.6s-1.9 1.2-1.9 2.5v5H10V9Z" />
        </svg>
      );
    case "twitter":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-full">
          <path d="M17.2 4h2.9l-6.3 7.2L21.2 20h-5.8l-4.5-5.9L5.7 20H2.8l6.7-7.7L2.4 4h5.9l4.1 5.4L17.2 4Zm-1 14.3h1.6L7.6 5.6H5.9l10.3 12.7Z" />
        </svg>
      );
    case "threads":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-full">
          <path d="M16.5 11.3c-.6-2.6-2.4-3.6-4.5-3.6-2.3 0-3.7 1.4-3.9 2.9m8.4.7c-2.6-.6-6.7-.5-6.6 2 .1 2.6 5.4 2.6 5.9-1.3.5-4.1-1-8-5.8-8C6.2 4 4.5 7.5 4.5 12s1.8 8 7.4 8c3.5 0 5.6-1.6 6.3-3.8" />
        </svg>
      );
    case "pinterest":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-full">
          <path d="M12.3 3C7.4 3 5 6.4 5 9.3c0 1.7.7 3.3 2.1 3.9.2.1.4 0 .5-.2l.2-.8c.1-.3 0-.4-.2-.6-.4-.5-.7-1.1-.7-2 0-2.6 2-5 5.1-5 2.8 0 4.3 1.7 4.3 4 0 3-1.3 5.5-3.3 5.5-1.1 0-1.9-.9-1.6-2 .3-1.3.9-2.8.9-3.7 0-.9-.5-1.6-1.5-1.6-1.2 0-2.1 1.2-2.1 2.8 0 1 .3 1.7.3 1.7L7.9 18.2c-.4 1.6 0 3.6 0 3.8 0 .1.2.2.3 0 .1-.1 1.4-1.7 1.8-3.3l.7-2.7c.4.7 1.4 1.3 2.5 1.3 3.3 0 5.6-3 5.6-7.1C18.8 6.1 16.2 3 12.3 3Z" />
        </svg>
      );
    case "googlebusiness":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-full">
          <path d="M20.6 12.2c0-.6-.1-1.2-.2-1.8H12v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5ZM12 21c2.4 0 4.5-.8 5.9-2.2L15 16.5c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21ZM7 13.7a5.4 5.4 0 0 1 0-3.4V8H4a9 9 0 0 0 0 8l3-2.3ZM12 6.6c1.3 0 2.5.5 3.4 1.3L18 5.4A9 9 0 0 0 4 8l3 2.3c.7-2.1 2.7-3.7 5-3.7Z" />
        </svg>
      );
    case "bluesky":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-full">
          <path d="M6.3 4.7C8.4 6.3 10.6 9.4 12 11c1.4-1.6 3.6-4.7 5.7-6.3 1.5-1.1 3.9-2 3.9.8 0 .6-.3 4.7-.5 5.4-.7 2.4-3.2 3-5.4 2.6 3.9.7 4.9 2.9 2.8 5.1-4 4.1-5.8-1-6.2-2.4l-.3-.8-.3.8c-.4 1.4-2.2 6.5-6.2 2.4-2.1-2.2-1.1-4.4 2.8-5.1-2.2.4-4.7-.2-5.4-2.6-.2-.7-.5-4.8-.5-5.4 0-2.8 2.4-1.9 3.9-.8Z" />
        </svg>
      );
    default:
      return <span className="text-[0.6em] font-black leading-none">{platformInfo(id).short}</span>;
  }
}

/** A network mark in its brand color. `badge` puts it on a white ring for avatar corners. */
export function PlatformIcon({ service, className = "size-4", badge = false }: { service: string; className?: string; badge?: boolean }) {
  const p = platformInfo(service);
  const bg =
    p.id === "instagram"
      ? "linear-gradient(45deg,#f9a825 0%,#e1306c 50%,#833ab4 100%)"
      : p.id === "googlebusiness"
        ? "#fff"
        : p.color;
  return (
    <span
      title={p.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${p.id === "googlebusiness" ? "text-[#4285f4] ring-1 ring-slate-200" : "text-white"} ${badge ? "ring-2 ring-white" : ""} ${className}`}
      style={{ background: bg }}
    >
      <span className="flex size-[64%] items-center justify-center">
        <Glyph id={p.id} />
      </span>
    </span>
  );
}

/** Account avatar with the network mark in the corner. */
export function ChannelAvatar({
  avatar,
  service,
  name,
  size = "size-9",
  badge = "size-4",
  dim = false,
}: {
  avatar: string | null | undefined;
  service: string;
  name?: string | null;
  size?: string;
  badge?: string;
  dim?: boolean;
}) {
  return (
    <span className={`relative inline-flex shrink-0 ${size} ${dim ? "opacity-40 grayscale" : ""}`}>
      {avatar ? (
        <img src={avatar} alt="" className="size-full rounded-full bg-slate-100 object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold uppercase text-slate-600">
          {(name || platformInfo(service).short).replace(/[^a-z0-9]/gi, "").slice(0, 2)}
        </span>
      )}
      <PlatformIcon service={service} badge className={`absolute -bottom-0.5 -right-0.5 ${badge}`} />
    </span>
  );
}
