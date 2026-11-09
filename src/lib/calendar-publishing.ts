import { CAPTION_LIMIT, platformInfo } from "./calendar";
import { dayKey, studioToUtc, timeInput } from "./calendar-time";

export const MAX_PUBLISH_DESTINATIONS = 40;

export type ComposerMedia = { url: string; isVideo: boolean; alt?: string; coverMs?: number | null };

export type NetworkOptions = {
  instagram?: { type: "post" | "reel" | "story"; shareToFeed: boolean; firstComment?: string; link?: string; ai?: boolean };
  facebook?: { type: "post" | "reel" | "story"; firstComment?: string };
  linkedin?: { firstComment?: string };
  google?: { type: "whats_new" | "offer" | "event"; button: string; link?: string; title?: string; start?: string; end?: string; code?: string; terms?: string };
  youtube?: { title: string; privacy: "public" | "unlisted" | "private"; categoryId: string; madeForKids: boolean; notify: boolean };
  tiktok?: { title?: string; ai?: boolean };
  pinterest?: { title?: string; link?: string };
};

type ContentIssue = { field: "caption" | "media"; message: string };

export function postContentIssue(service: string, text: string, media: Pick<ComposerMedia, "isVideo">[], options: NetworkOptions | null, creating = true): ContentIssue | null {
  const limit = CAPTION_LIMIT[service];
  if (limit && text.length > limit) return { field: "caption", message: `Caption is over ${platformInfo(service).label}'s ${limit} characters.` };
  const hasVideo = media.some((item) => item.isVideo);
  const igType = options?.instagram?.type;
  const fbType = options?.facebook?.type;
  let mediaIssue: string | null = null;

  if (creating && hasVideo && media.length > 1) mediaIssue = "Use one video, or up to 10 photos.";
  else if (service === "instagram") {
    if (igType === "reel" && !hasVideo) mediaIssue = "An Instagram reel needs a video.";
    else if (!media.length) mediaIssue = "Instagram needs a photo or video.";
    else if (igType === "post" && hasVideo && media.length === 1) mediaIssue = "Choose Reel to post a single video to your Instagram feed.";
    else if (igType === "story" && media.length > 1) mediaIssue = "An Instagram story needs a single photo or video.";
  } else if (service === "facebook") {
    if (fbType === "reel" && !hasVideo) mediaIssue = "A Facebook reel needs a video.";
    else if (fbType === "story" && media.length !== 1) mediaIssue = "A Facebook story needs a single photo or video.";
  } else if (service === "youtube" && !hasVideo) {
    mediaIssue = "YouTube needs a video.";
  } else if (service === "tiktok" && !media.length) {
    mediaIssue = "TikTok needs a photo or video.";
  } else if (service === "pinterest" && media.length !== 1) {
    mediaIssue = "Pinterest needs a single photo or video.";
  } else if (service === "googlebusiness" && media.length > 1) {
    mediaIssue = "Google Business supports one photo or video per post.";
  } else if (["twitter", "mastodon"].includes(service) && media.length > 4) {
    mediaIssue = `${platformInfo(service).label} supports up to four photos per post.`;
  }

  if (mediaIssue) return { field: "media", message: mediaIssue };
  if (!text.trim() && !media.length) return { field: "caption", message: "Write a caption or add a photo or video." };
  return null;
}

export function scheduledTime(date?: string, time?: string): { at: Date } | { error: string } {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !time || !/^\d{2}:\d{2}$/.test(time)) return { error: "Pick a date and time." };
  const at = studioToUtc(date, time);
  if (dayKey(at) !== date || timeInput(at.toISOString()) !== time) return { error: "That date or time isn't available. Pick another." };
  if (at.getTime() < Date.now() + 60_000) return { error: "Pick a time at least one minute from now, or post now." };
  return { at };
}

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function dateIso(v: string | undefined) {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? studioToUtc(v, "00:00").toISOString() : null;
}

/** Buffer's per-network options for one channel, or the reason it can't go. */
export function metadataFor(service: string, o: NetworkOptions, media: ComposerMedia[], boardId?: string): { metadata?: Record<string, unknown>; error?: string } {
  const hasMedia = media.length > 0;
  const hasVideo = media.some((m) => m.isVideo);
  switch (service) {
    case "instagram": {
      if (!hasMedia) return { error: "Instagram needs a photo or video." };
      const type = o.instagram?.type ?? (hasVideo ? "reel" : "post");
      if (type === "reel" && !hasVideo) return { error: "An Instagram reel needs a video." };
      const ig: Record<string, unknown> = { type, shouldShareToFeed: type === "story" ? false : (o.instagram?.shareToFeed ?? true) };
      if (type !== "story" && str(o.instagram?.firstComment, 2200)) ig.firstComment = str(o.instagram?.firstComment, 2200);
      if (type === "post" && /^https?:\/\//.test(str(o.instagram?.link))) ig.link = str(o.instagram?.link);
      if (o.instagram?.ai) ig.isAiGenerated = true;
      return { metadata: { instagram: ig } };
    }
    case "facebook": {
      const type = o.facebook?.type ?? "post";
      if (type !== "post" && !hasMedia) return { error: "Facebook reels and stories need a photo or video." };
      if (type === "reel" && !hasVideo) return { error: "A Facebook reel needs a video." };
      const fb: Record<string, unknown> = { type };
      if (str(o.facebook?.firstComment, 8000)) fb.firstComment = str(o.facebook?.firstComment, 8000);
      return { metadata: { facebook: fb } };
    }
    case "linkedin":
      return str(o.linkedin?.firstComment) ? { metadata: { linkedin: { firstComment: str(o.linkedin?.firstComment, 1250) } } } : {};
    case "googlebusiness": {
      const g = o.google ?? { type: "whats_new", button: "none" };
      const link = str(g.link);
      const button = ["book", "call", "learn_more", "none", "order", "shop", "signup"].includes(g.button) ? g.button : "none";
      if (g.type === "offer") {
        const title = str(g.title, 58);
        const start = dateIso(g.start);
        const end = dateIso(g.end);
        if (!title || !start || !end) return { error: "Google offers need a title, a start date and an end date." };
        const d: Record<string, unknown> = { title, startDate: start, endDate: end };
        if (str(g.code)) d.code = str(g.code, 58);
        if (str(g.terms)) d.terms = str(g.terms, 5000);
        if (link) d.link = link;
        return { metadata: { google: { type: "offer", title, detailsOffer: d } } };
      }
      if (g.type === "event") {
        const title = str(g.title, 58);
        const start = dateIso(g.start);
        const end = dateIso(g.end);
        if (!title || !start || !end) return { error: "Google events need a title, a start date and an end date." };
        if (button !== "none" && button !== "call" && !link) return { error: "Google Business buttons need a link." };
        const d: Record<string, unknown> = { title, startDate: start, endDate: end, isFullDayEvent: true, button };
        if (link) d.link = link;
        return { metadata: { google: { type: "event", title, detailsEvent: d } } };
      }
      if (button !== "none" && button !== "call" && !link) return { error: "Google Business buttons need a link." };
      const google: Record<string, unknown> = { type: "whats_new" };
      if (button !== "none") google.detailsWhatsNew = { button, ...(link ? { link } : {}) };
      return { metadata: { google } };
    }
    case "tiktok": {
      if (!hasMedia) return { error: "TikTok needs a photo or video." };
      const tt: Record<string, unknown> = {};
      if (!hasVideo && str(o.tiktok?.title)) tt.title = str(o.tiktok?.title, 90);
      if (hasVideo && o.tiktok?.ai) tt.isAiGenerated = true;
      return Object.keys(tt).length ? { metadata: { tiktok: tt } } : {};
    }
    case "youtube": {
      if (!hasVideo) return { error: "YouTube needs a video." };
      const y = o.youtube;
      if (!str(y?.title)) return { error: "YouTube needs a title." };
      return {
        metadata: {
          youtube: {
            title: str(y?.title, 100),
            categoryId: /^\d{1,2}$/.test(y?.categoryId ?? "") ? y!.categoryId : "22",
            privacy: ["public", "unlisted", "private"].includes(y?.privacy ?? "") ? y!.privacy : "public",
            madeForKids: !!y?.madeForKids,
            notifySubscribers: y?.notify ?? true,
          },
        },
      };
    }
    case "pinterest": {
      if (!hasMedia) return { error: "Pinterest needs a photo or video." };
      if (!boardId) return { error: "Pick a Pinterest board." };
      const pin: Record<string, unknown> = { boardServiceId: boardId };
      if (str(o.pinterest?.title)) pin.title = str(o.pinterest?.title, 100);
      if (/^https?:\/\//.test(str(o.pinterest?.link))) pin.url = str(o.pinterest?.link);
      return { metadata: { pinterest: pin } };
    }
    default:
      return {};
  }
}
