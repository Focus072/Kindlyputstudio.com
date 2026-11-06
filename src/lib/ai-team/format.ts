import { STUDIO_TZ } from "@/lib/calendar-time";

// Dates in the studio's time zone (NEXT_PUBLIC_STUDIO_TIMEZONE, Pacific by
// default), so the server, G's phone and Mohhamed's laptop all show the same
// time, and server-rendered and browser-rendered text match.
const whenFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: STUDIO_TZ,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TZ, month: "short", day: "numeric", year: "numeric" });

/** "Nov 5, 2026, 5:35 PM" */
export const when = (iso: string) => whenFmt.format(new Date(iso));
/** "Nov 5, 2026" */
export const day = (iso: string) => dayFmt.format(new Date(iso));
