// Shared calendar types and labels (safe for client components).

export type CalClient = { id: string; name: string; color: string };

export type CalStatus = "idea" | "draft" | "scheduled" | "posted" | "error";

export type CalPost = {
  id: string;
  source: "buffer" | "manual";
  clientId: string | null;
  at: string;
  platform: string;
  caption: string;
  status: CalStatus;
  notes: string | null;
  thumb: string | null;
  isVideo: boolean;
  channelName: string | null;
  link: string | null;
  /** Buffer only: the post's own id and channel, for editing. */
  bufferId: string | null;
  channelId: string | null;
  media: CalMedia[];
  /** Buffer only sent a phone reminder, so "sent" doesn't prove it went live. */
  reminder?: boolean;
};

export type CalMedia = { url: string; thumb: string | null; isVideo: boolean };

/** A Buffer channel as the composer sees it. */
export type CalChannel = { id: string; name: string; service: string; avatar: string | null; clientId: string | null };

/** Caption limits per network (characters). */
export const CAPTION_LIMIT: Record<string, number> = {
  instagram: 2200,
  tiktok: 2200,
  facebook: 63206,
  youtube: 5000,
  linkedin: 3000,
  threads: 500,
  twitter: 280,
  pinterest: 500,
  googlebusiness: 1500,
  bluesky: 300,
  mastodon: 500,
};

export const UNASSIGNED_COLOR = "#94a3b8";

export const PLATFORMS: { id: string; label: string; short: string }[] = [
  { id: "instagram", label: "Instagram", short: "IG" },
  { id: "tiktok", label: "TikTok", short: "TT" },
  { id: "facebook", label: "Facebook", short: "FB" },
  { id: "youtube", label: "YouTube", short: "YT" },
  { id: "linkedin", label: "LinkedIn", short: "IN" },
  { id: "threads", label: "Threads", short: "TH" },
  { id: "twitter", label: "X", short: "X" },
  { id: "pinterest", label: "Pinterest", short: "PI" },
  { id: "googlebusiness", label: "Google Business", short: "GB" },
  { id: "bluesky", label: "Bluesky", short: "BS" },
  { id: "other", label: "Other", short: "•" },
];

export function platformInfo(id: string) {
  const key = id.toLowerCase().replace(/[^a-z]/g, "");
  return PLATFORMS.find((p) => p.id === key) ?? { id: key || "other", label: id || "Other", short: (id || "•").slice(0, 2).toUpperCase() };
}

export const STATUS_LABEL: Record<CalStatus, string> = {
  idea: "Idea",
  draft: "Draft",
  scheduled: "Scheduled",
  posted: "Posted",
  error: "Failed",
};

/** Colors offered when adding a client. Picked to stay apart from each other. */
export const SWATCHES = ["#e4572e", "#f3a712", "#2a9d8f", "#3a86ff", "#8338ec", "#ff006e", "#06a77d", "#6d597a", "#1d3557", "#bc6c25", "#0096c7", "#c9184a"];

export function isHexColor(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}
