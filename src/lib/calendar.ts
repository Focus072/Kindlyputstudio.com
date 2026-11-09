// Shared calendar types and labels (safe for client components).

export type CalClient = { id: string; name: string; color: string };

export type CalStatus = "idea" | "draft" | "scheduled" | "posted" | "error";

export type CalTag = { id: string; name: string; color: string };

/** Network options a Buffer post carries, as far as the calendar reads them back. */
export type CalPostMeta = {
  type?: string | null;
  firstComment?: string | null;
  shareToFeed?: boolean | null;
  link?: string | null;
  title?: string | null;
  privacy?: string | null;
  button?: string | null;
  boardName?: string | null;
};

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
  channelAvatar?: string | null;
  link: string | null;
  /** Buffer only: the post's own id and channel, for editing. */
  bufferId: string | null;
  channelId: string | null;
  media: CalMedia[];
  /** Buffer only sent a phone reminder, so "sent" doesn't prove it went live. */
  reminder?: boolean;
  /** Why Buffer couldn't publish it. */
  errorMessage?: string | null;
  tags?: CalTag[];
  author?: string | null;
  meta?: CalPostMeta;
};

export type CalMedia = { url: string; thumb: string | null; isVideo: boolean; alt?: string | null };

export type CalSlot = { day: string; times: string[]; paused?: boolean };

/** A Buffer channel as the calendar and composer see it. */
export type CalChannel = {
  id: string;
  name: string;
  service: string;
  avatar: string | null;
  clientId: string | null;
  /** Buffer lost access; posts there won't go out until it's reconnected in Buffer. */
  needsReconnect?: boolean;
  paused?: boolean;
  link?: string | null;
  schedule?: CalSlot[] | null;
  boards?: { id: string; name: string }[] | null;
};

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
export const UNASSIGNED = "__none";

export const PLATFORMS: { id: string; label: string; short: string; color: string }[] = [
  { id: "instagram", label: "Instagram", short: "IG", color: "#d62976" },
  { id: "tiktok", label: "TikTok", short: "TT", color: "#111111" },
  { id: "facebook", label: "Facebook", short: "FB", color: "#1877f2" },
  { id: "youtube", label: "YouTube", short: "YT", color: "#ff0000" },
  { id: "linkedin", label: "LinkedIn", short: "IN", color: "#0a66c2" },
  { id: "threads", label: "Threads", short: "TH", color: "#111111" },
  { id: "twitter", label: "X", short: "X", color: "#111111" },
  { id: "pinterest", label: "Pinterest", short: "PI", color: "#e60023" },
  { id: "googlebusiness", label: "Google Business", short: "GB", color: "#4285f4" },
  { id: "bluesky", label: "Bluesky", short: "BS", color: "#1185fe" },
  { id: "mastodon", label: "Mastodon", short: "MA", color: "#6364ff" },
  { id: "other", label: "Other", short: "•", color: "#64748b" },
];

export function platformInfo(id: string) {
  const key = (id || "").toLowerCase().replace(/[^a-z]/g, "");
  return PLATFORMS.find((p) => p.id === key) ?? { id: key || "other", label: id || "Other", short: (id || "•").slice(0, 2).toUpperCase(), color: "#64748b" };
}

type ChannelIdentity = Pick<CalChannel, "id" | "name" | "service"> & { link?: string | null; external_link?: string | null };

function profileDetail(channel: ChannelIdentity) {
  try {
    const url = new URL(channel.link ?? channel.external_link ?? "");
    const path = url.pathname.replace(/^\/+|\/+$/g, "");
    const id = url.searchParams.get("id") ?? url.searchParams.get("cid");
    return id || (path && path !== "profile.php" ? path : "");
  } catch {
    return "";
  }
}

/** Network and, for lookalike names, the profile or stable Buffer account identifier. */
export function channelDetail(channel: ChannelIdentity, channels: ChannelIdentity[]) {
  const network = platformInfo(channel.service);
  const duplicates = channels.filter((c) => c.id !== channel.id && platformInfo(c.service).id === network.id && c.name.trim().toLowerCase() === channel.name.trim().toLowerCase());
  if (!duplicates.length) return network.label;
  const profile = profileDetail(channel);
  if (profile && !duplicates.some((c) => profileDetail(c) === profile)) return `${network.label} · ${profile}`;
  const shortId = channel.id.slice(-6);
  return `${network.label} · Account ${duplicates.some((c) => c.id.endsWith(shortId)) ? channel.id : shortId}`;
}

export function channelLabel(channel: ChannelIdentity, channels: ChannelIdentity[]) {
  return `${channel.name} · ${channelDetail(channel, channels)}`;
}

export const STATUS_LABEL: Record<CalStatus, string> = {
  idea: "Idea",
  draft: "Draft",
  scheduled: "Scheduled",
  posted: "Posted",
  error: "Failed",
};

/** Instagram/Facebook post types in plain words. */
export const TYPE_LABEL: Record<string, string> = {
  post: "Post",
  reel: "Reel",
  story: "Story",
  carousel: "Carousel",
  short: "Short",
  whats_new: "Update",
  offer: "Offer",
  event: "Event",
};

/**
 * Client colors: muted, earthy tones that sit next to the Ink/Slate/Steel brand
 * kit and stay readable with white text. Order = the order new clients get them.
 */
export const SWATCHES = [
  "#4f6d8a", // slate blue
  "#6e8f72", // sage
  "#b86b4b", // terracotta
  "#7e5a86", // plum
  "#b8913f", // ochre
  "#3f7f7c", // teal
  "#b07583", // dusty rose
  "#34495e", // navy
  "#7c8048", // olive
  "#8c6a55", // walnut
  "#5a5f9e", // indigo
  "#8b3a4a", // wine
];

export function isHexColor(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

/** Posts that can still be moved or edited: not published yet. */
export function isEditable(p: CalPost) {
  if (p.source === "manual") return p.status !== "posted";
  return !!p.bufferId && (p.status === "scheduled" || p.status === "draft" || p.status === "error");
}
