/** Formats a room's review-by day (YYYY-MM-DD) without time zone drift. */
export function formatReviewBy(day: string | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  if (!day) return null;
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

/** Today's date in Bakersfield as YYYY-MM-DD, for "overdue" checks on the server. */
export function studioToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}
