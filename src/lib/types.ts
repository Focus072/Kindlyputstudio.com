export type ReviewStatus = "pending" | "approved" | "changes";

export type RoomRow = {
  id: string;
  slug: string;
  title: string;
  client_name: string;
  delivered_by: string;
  hero_file_id: string | null;
  theme_preset: string;
  accent_color: string | null;
  status: "draft" | "live" | "archived";
  expires_at: string | null;
  /** Feature this room in the public "Recent work" section of the home page. */
  showcase: boolean;
  /** "link": anyone signed in with the link. "invited": only emails on the guest list. */
  access_mode: "link" | "invited";
  /** "grid": every tile 4:5. "natural": each file keeps its own shape. */
  layout: "grid" | "natural";
  /** "on", "approved" (only approved files), or "off". */
  downloads: "on" | "approved" | "off";
  watermark: boolean;
  payment_url: string | null;
  payment_status: "none" | "due" | "paid";
  /** Short note from the studio at the top of the room. */
  intro: string | null;
  feedback_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FileRow = {
  id: string;
  room_id: string;
  kind: "image" | "video";
  file_name: string;
  mime_type: string;
  original_path: string;
  preview_path: string | null;
  thumb_path: string | null;
  poster_path: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  size_bytes: number | null;
  sort_order: number;
  category: string | null;
  caption: string | null;
  version: number;
  /** Set when a newer version replaced this file. */
  replaced_by: string | null;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type CommentRow = {
  id: string;
  room_id: string;
  file_id: string;
  author_name: string;
  body: string;
  from_agency: boolean;
  /** Seconds into a video the note points at. */
  timecode: number | null;
  created_at: string;
};

export type RoomStats = {
  views: number;
  comments: number;
  approved: number;
  changes: number;
  pending: number;
};

/** What the client-side room receives for each file. */
export type RoomComment = {
  id: string;
  author: string;
  body: string;
  fromAgency: boolean;
  createdAt: string;
  timecode: number | null;
};

export type RoomFile = {
  id: string;
  kind: "image" | "video";
  fileName: string;
  caption: string | null;
  /** Set name, like "Reels" or "Day 1". */
  category: string | null;
  version: number;
  /** Earlier versions, newest first. */
  versions: RoomFileVersion[];
  /** False when the room's download setting holds this file back. */
  canDownload: boolean;
  width: number | null;
  height: number | null;
  thumbUrl: string | null;
  previewUrl: string | null;
  posterUrl: string | null;
  /** Signed, time-limited URL used for inline video playback. */
  videoUrl: string | null;
  status: ReviewStatus;
  reviewedBy: string | null;
  comments: RoomComment[];
};

export type RoomFileVersion = {
  id: string;
  version: number;
  thumbUrl: string | null;
  previewUrl: string | null;
  posterUrl: string | null;
  videoUrl: string | null;
  status: ReviewStatus;
  createdAt: string;
  comments: RoomComment[];
};
