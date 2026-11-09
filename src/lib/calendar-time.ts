// Date helpers for the content calendar. Everything is shown in the studio's
// own time zone, whatever time zone the server or phone is in. Set
// NEXT_PUBLIC_STUDIO_TIMEZONE (an IANA name such as "America/New_York") to change it.

function validTz(tz: string | undefined) {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

export const STUDIO_TZ = validTz(process.env.NEXT_PUBLIC_STUDIO_TIMEZONE) ?? "America/Los_Angeles";

/** "Pacific time" style label for the studio time zone. */
export const STUDIO_TZ_LABEL = (() => {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TZ, timeZoneName: "long" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName")?.value;
  return name ? name.replace(/ (Standard|Daylight) Time$/, " time").replace(/ Time$/, " time") : STUDIO_TZ;
})();

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: STUDIO_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TZ, hour: "numeric", minute: "2-digit" });
const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: STUDIO_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** "2026-11-05" for an instant, in studio time. */
export function dayKey(iso: string | Date): string {
  return dayFmt.format(new Date(iso));
}

/** "9:30 AM" in studio time. */
export function timeLabel(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** "14:30" in studio time, for a time input. */
export function timeInput(iso: string): string {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.hour}:${p.minute}`;
}

function offsetMs(utcMs: number): number {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - (utcMs - (utcMs % 1000));
}

/** Studio-time date ("2026-11-05") and time ("14:30") to a UTC instant. */
export function studioToUtc(date: string, time = "00:00"): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  let ms = guess - offsetMs(guess);
  ms = guess - offsetMs(ms); // second pass settles daylight-saving edges
  return new Date(ms);
}

export function isMonthKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function keyOf(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** The weeks shown for a month: full Sunday to Saturday rows of day keys. */
export function monthGrid(month: string): string[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const last = new Date(Date.UTC(y, m, 0));
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));
  const weeks: string[][] = [];
  for (const d = new Date(start); d <= end; ) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(keyOf(d));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** UTC range covering every day in the month's grid. */
export function gridRange(month: string): { start: Date; end: Date } {
  const weeks = monthGrid(month);
  const lastDay = weeks[weeks.length - 1][6];
  const after = new Date(`${lastDay}T00:00:00Z`);
  after.setUTCDate(after.getUTCDate() + 1);
  return { start: studioToUtc(weeks[0][0]), end: studioToUtc(keyOf(after)) };
}

export function dayLabel(key: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function isDayKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
}

/** Day key n days after the given one. */
export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOf(d);
}

/** The Sunday to Saturday week holding the day. */
export function weekDays(key: string): string[] {
  const d = new Date(`${key}T12:00:00Z`);
  const start = addDays(key, -d.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** UTC range covering whole studio days, from the first key to the day after the last. */
export function daysRange(first: string, last: string): { start: Date; end: Date } {
  return { start: studioToUtc(first), end: studioToUtc(addDays(last, 1)) };
}

/** "Nov 8 – 14" style label for a week. */
export function weekLabel(days: string[]): string {
  const a = new Date(`${days[0]}T12:00:00Z`);
  const b = new Date(`${days[6]}T12:00:00Z`);
  const m = (d: Date) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return a.getUTCMonth() === b.getUTCMonth() ? `${m(a)} ${a.getUTCDate()} – ${b.getUTCDate()}` : `${m(a)} ${a.getUTCDate()} – ${m(b)} ${b.getUTCDate()}`;
}

/** "in 2 hours", "3 days ago". */
export function relativeLabel(iso: string, now = Date.now()): string {
  const diff = Date.parse(iso) - now;
  const abs = Math.abs(diff);
  const fmt = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  if (abs < 60 * 60_000) return fmt.format(Math.round(diff / 60_000), "minute");
  if (abs < 24 * 3600_000) return fmt.format(Math.round(diff / 3600_000), "hour");
  return fmt.format(Math.round(diff / 86_400_000), "day");
}
