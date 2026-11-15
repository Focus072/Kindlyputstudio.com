export type ClientStatus = "active" | "prospect" | "paused" | "past";

export type ClientContact = { name: string; role?: string; email?: string; phone?: string };
export type ClientDate = { label: string; date: string };

export const SOCIALS = [
  { key: "instagram", label: "Instagram", prefix: "https://instagram.com/" },
  { key: "tiktok", label: "TikTok", prefix: "https://tiktok.com/@" },
  { key: "facebook", label: "Facebook", prefix: "https://facebook.com/" },
  { key: "youtube", label: "YouTube", prefix: "https://youtube.com/@" },
  { key: "linkedin", label: "LinkedIn", prefix: "https://linkedin.com/company/" },
  { key: "google", label: "Google Business", prefix: "" },
] as const;

export const STATUSES: { id: ClientStatus; label: string; tone: string }[] = [
  { id: "active", label: "Active", tone: "bg-sage-soft text-sage" },
  { id: "prospect", label: "Prospect", tone: "bg-[#e4e9ec] text-slate-brand" },
  { id: "paused", label: "Paused", tone: "bg-ochre-soft text-ochre" },
  { id: "past", label: "Past", tone: "bg-slate-100 text-slate-500" },
];

export type ClientProfile = {
  id: string;
  name: string;
  color: string;
  status: ClientStatus;
  industry: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  socials: Record<string, string>;
  contacts: ClientContact[];
  package: string | null;
  monthly_rate: number | null;
  billing_notes: string | null;
  client_since: string | null;
  renews_on: string | null;
  dates: ClientDate[];
  brand_notes: string | null;
  drive_url: string | null;
  notes: string | null;
  share_token: string | null;
  created_at: string;
};

export type ClientNote = { id: string; body: string; author: string | null; created_at: string };

/** "@crema.cafe_" or a full URL → a link. */
export function socialHref(key: string, value: string) {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const s = SOCIALS.find((x) => x.key === key);
  if (!s?.prefix) return `https://${v.replace(/^\/+/, "")}`;
  return s.prefix + v.replace(/^@/, "");
}

export function socialLabel(value: string) {
  const v = value.trim();
  if (!/^https?:\/\//i.test(v)) return v.startsWith("@") ? v : `@${v}`;
  try {
    const u = new URL(v);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
  } catch {
    return v;
  }
}

export function money(n: number | null) {
  if (n == null) return null;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 ? 2 : 0 });
}

/** Next occurrence of a yearly date (birthdays, anniversaries), or the date itself if it's in the future. */
export function nextOccurrence(iso: string, today = new Date()) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  if (d >= t) return d;
  const n = new Date(t.getFullYear(), d.getMonth(), d.getDate(), 12);
  if (n < t) n.setFullYear(n.getFullYear() + 1);
  return n;
}

export function shortDate(d: Date | string) {
  const x = typeof d === "string" ? new Date(`${d}T12:00:00`) : d;
  return x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: x.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}
