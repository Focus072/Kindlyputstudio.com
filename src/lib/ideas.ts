// Shared types for the client Ideas board and calendar comments (safe for client components).

export type IdeaStatus = "new" | "planned" | "scheduled" | "done" | "archived";
export type Role = "studio" | "client";

export type Idea = {
  id: string;
  clientId: string;
  title: string;
  body: string;
  link: string | null;
  platform: string | null;
  targetDate: string | null;
  status: IdeaStatus;
  authorName: string | null;
  authorRole: Role;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  comments: CalComment[];
};

export type CalComment = {
  id: string;
  ideaId: string | null;
  postKey: string | null;
  body: string;
  authorName: string | null;
  authorRole: Role;
  createdAt: string;
};

/** Board columns, left to right. Archived ideas are tucked away below. */
export const IDEA_COLUMNS: { id: Exclude<IdeaStatus, "archived">; label: string; hint: string }[] = [
  { id: "new", label: "Ideas", hint: "Anything worth posting about" },
  { id: "planned", label: "In the works", hint: "Agreed on, being made" },
  { id: "scheduled", label: "Scheduled", hint: "On the calendar" },
  { id: "done", label: "Posted", hint: "Live" },
];

export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  new: "Idea",
  planned: "In the works",
  scheduled: "Scheduled",
  done: "Posted",
  archived: "Archived",
};

export const IDEA_STATUSES: IdeaStatus[] = ["new", "planned", "scheduled", "done", "archived"];

export function isIdeaStatus(v: unknown): v is IdeaStatus {
  return typeof v === "string" && (IDEA_STATUSES as string[]).includes(v);
}
