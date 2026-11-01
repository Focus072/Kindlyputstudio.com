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
export type RoomFile = {
  id: string;
  kind: "image" | "video";
  fileName: string;
  width: number | null;
  height: number | null;
  thumbUrl: string | null;
  previewUrl: string | null;
  posterUrl: string | null;
  /** Signed, time-limited URL used for inline video playback. */
  videoUrl: string | null;
  status: ReviewStatus;
  reviewedBy: string | null;
  comments: {
    id: string;
    author: string;
    body: string;
    fromAgency: boolean;
    createdAt: string;
  }[];
};
