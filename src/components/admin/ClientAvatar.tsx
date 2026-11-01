export function ClientAvatar({ name, url, size = "size-9" }: { name: string; url: string | null; size?: string }) {
  if (url) return <img src={url} alt="" referrerPolicy="no-referrer" className={`${size} rounded-full object-cover`} />;
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={`${size} flex items-center justify-center rounded-full bg-steel text-xs font-bold text-ink`}>
      {initials || "?"}
    </span>
  );
}
