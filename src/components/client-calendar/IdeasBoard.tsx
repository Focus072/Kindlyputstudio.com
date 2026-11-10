"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Archive, CalendarClock, CalendarPlus, ChevronDown, ExternalLink, Lightbulb, MessageCircle, Plus, Trash2 } from "lucide-react";
import { type Ctx, type IdeaInput, deleteIdea, moveIdea, saveIdea } from "@/app/cal/actions";
import { PlatformIcon } from "@/components/admin/calendar/PlatformIcon";
import { PLATFORMS, platformInfo } from "@/lib/calendar";
import { dayLabel } from "@/lib/calendar-time";
import { IDEA_COLUMNS, IDEA_STATUS_LABEL, type Idea, type IdeaStatus, type Role } from "@/lib/ideas";
import { Comments, NameField, useGuestName } from "./Comments";
import { Sheet } from "./Sheet";

const PICK_PLATFORMS = PLATFORMS.filter((p) => ["instagram", "facebook", "tiktok", "googlebusiness", "youtube", "linkedin", "other"].includes(p.id));

const field = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-ink outline-none focus:border-slate-brand sm:text-sm";

/** Muted tone per column so the board reads at a glance without loud color. */
const COLUMN_TONE: Record<string, string> = {
  new: "#b6c3c8",
  planned: "#b8913f",
  scheduled: "#4f6d8a",
  done: "#6e8f72",
};

function shortDate(d: string) {
  return dayLabel(d, { month: "short", day: "numeric" });
}

export function IdeasBoard({
  ctx,
  role,
  ideas,
  studioName,
  ready = true,
  onSchedule,
  openId,
}: {
  ctx: Ctx;
  role: Role;
  ideas: Idea[];
  studioName: string;
  ready?: boolean;
  /** Studio only: open the composer with this idea filled in. */
  onSchedule?: (idea: Idea) => void;
  /** Open this idea right away (from a link). */
  openId?: string | null;
}) {
  const [open, setOpen] = useState<Idea | "new" | null>(() => (openId ? (ideas.find((i) => i.id === openId) ?? null) : null));
  const [showArchived, setShowArchived] = useState(false);
  const archived = ideas.filter((i) => i.status === "archived");

  // Keep an open idea in sync after a refresh.
  const current = open && open !== "new" ? (ideas.find((i) => i.id === open.id) ?? open) : open;

  const columns = useMemo(
    () =>
      IDEA_COLUMNS.map((col) => ({
        ...col,
        items: ideas
          .filter((i) => i.status === col.id)
          .sort((a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999") || b.createdAt.localeCompare(a.createdAt)),
      })),
    [ideas],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-slate-500">
          {role === "client"
            ? `A shared space for post ideas. Add anything you'd like to see, and ${studioName} will plan it, make it and put it on the calendar.`
            : "Ideas from you and the client. Move them along as they get made, then schedule them straight into Buffer."}
        </p>
        <button
          onClick={() => setOpen("new")}
          disabled={!ready}
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-brand disabled:opacity-40"
        >
          <Plus className="size-4" strokeWidth={2.5} /> Add an idea
        </button>
      </div>

      {!ready && <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">The ideas board isn&rsquo;t set up yet.</p>}

      <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4">
        {columns.map((col) => (
          <section key={col.id} aria-label={col.label} className="w-[82vw] max-w-sm shrink-0 snap-start rounded-3xl bg-slate-100/80 p-2.5 md:w-auto md:max-w-none">
            <header className="flex items-center justify-between px-2 pb-2 pt-1">
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: COLUMN_TONE[col.id] }} />
                <span className="font-display text-xl uppercase leading-none text-ink">{col.label}</span>
                <span className="text-xs font-semibold text-slate-400">{col.items.length}</span>
              </span>
            </header>
            <div className="space-y-2">
              {col.items.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400">{col.hint}</p>}
              {col.items.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} onOpen={() => setOpen(idea)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {archived.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowArchived(!showArchived)} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink">
            <Archive className="size-4" /> Archived ({archived.length}) <ChevronDown className={`size-4 transition ${showArchived ? "rotate-180" : ""}`} />
          </button>
          {showArchived && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {archived.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} onOpen={() => setOpen(idea)} />
              ))}
            </div>
          )}
        </div>
      )}

      {current && (
        <IdeaSheet
          key={current === "new" ? "new" : current.id}
          ctx={ctx}
          role={role}
          idea={current === "new" ? null : current}
          studioName={studioName}
          onClose={() => setOpen(null)}
          onSaved={(id) => id && current === "new" && setOpen(null)}
          onSchedule={onSchedule}
        />
      )}
    </div>
  );
}

function IdeaCard({ idea, onOpen }: { idea: Idea; onOpen: () => void }) {
  const p = idea.platform ? platformInfo(idea.platform) : null;
  return (
    <button onClick={onOpen} className="block w-full rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-brand">
      <p className="text-sm font-bold leading-snug text-ink">{idea.title}</p>
      {idea.body && <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-slate-600">{idea.body}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        {p && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
            <PlatformIcon service={p.id} className="size-3" /> {p.label}
          </span>
        )}
        {idea.scheduledAt ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
            <CalendarClock className="size-3" /> {new Date(idea.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        ) : (
          idea.targetDate && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
              <CalendarClock className="size-3" /> {shortDate(idea.targetDate)}
            </span>
          )
        )}
        {idea.link && <ExternalLink className="size-3" />}
        {idea.comments.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="size-3" /> {idea.comments.length}
          </span>
        )}
        <span className="ml-auto truncate font-normal text-slate-400">{idea.authorRole === "studio" ? `${idea.authorName ?? "Studio"} · Studio` : (idea.authorName ?? "Client")}</span>
      </div>
    </button>
  );
}

function IdeaSheet({
  ctx,
  role,
  idea,
  studioName,
  onClose,
  onSaved,
  onSchedule,
}: {
  ctx: Ctx;
  role: Role;
  idea: Idea | null;
  studioName: string;
  onClose: () => void;
  onSaved: (id?: string) => void;
  onSchedule?: (idea: Idea) => void;
}) {
  const router = useRouter();
  const [name, setName] = useGuestName();
  const [form, setForm] = useState<IdeaInput>({
    id: idea?.id,
    title: idea?.title ?? "",
    body: idea?.body ?? "",
    link: idea?.link ?? "",
    platform: idea?.platform ?? "",
    targetDate: idea?.targetDate ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const dirty =
    !idea ||
    form.title !== idea.title ||
    form.body !== idea.body ||
    form.link !== (idea.link ?? "") ||
    form.platform !== (idea.platform ?? "") ||
    form.targetDate !== (idea.targetDate ?? "");
  const needsName = role === "client" && !idea && !name.trim();
  const canDelete = idea && (role === "studio" || idea.authorRole === "client");

  function save() {
    setError(null);
    start(async () => {
      const r = await saveIdea({ ...ctx, name }, form);
      if (!r.ok) return setError(r.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
      router.refresh();
      onSaved(r.id);
    });
  }

  function move(status: IdeaStatus) {
    if (!idea) return;
    start(async () => {
      const r = await moveIdea(ctx, idea.id, status);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  function remove() {
    if (!idea || !confirm("Delete this idea?")) return;
    start(async () => {
      const r = await deleteIdea(ctx, idea.id);
      if (!r.ok) return setError(r.error);
      router.refresh();
      onClose();
    });
  }

  const set = (k: keyof IdeaInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Sheet
      title={idea ? "Idea" : "New idea"}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {canDelete && (
            <button onClick={remove} disabled={pending} aria-label="Delete idea" className="inline-flex size-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-[#9a4a3c] hover:text-[#9a4a3c]">
              <Trash2 className="size-4" />
            </button>
          )}
          {role === "studio" && idea && onSchedule && idea.status !== "scheduled" && idea.status !== "done" && (
            <button
              onClick={() => onSchedule({ ...idea, ...form, body: form.body ?? "", link: form.link || null, platform: form.platform || null, targetDate: form.targetDate || null } as Idea)}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-sm font-semibold text-ink hover:border-ink"
            >
              <CalendarPlus className="size-4" /> Schedule it
            </button>
          )}
          <button
            onClick={save}
            disabled={pending || !form.title.trim() || !dirty || needsName}
            className="ml-auto inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-slate-brand disabled:opacity-40"
          >
            {saved ? "Saved" : pending ? "Saving…" : idea ? "Save" : "Add idea"}
          </button>
        </div>
      }
    >
      {idea && role === "client" && (
        <p className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-ink">{IDEA_STATUS_LABEL[idea.status]}</span>
          {idea.status === "new" ? `${studioName} will move it along as it gets made.` : idea.status === "planned" ? "Being made now." : null}
        </p>
      )}
      {idea && role === "studio" && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {(["new", "planned", "scheduled", "done"] as IdeaStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => move(s)}
              disabled={pending}
              aria-pressed={idea.status === s}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${idea.status === s ? "bg-ink text-white" : "border border-slate-200 text-slate-600 hover:border-ink hover:text-ink"}`}
            >
              {IDEA_STATUS_LABEL[s]}
            </button>
          ))}
          <button
            onClick={() => move(idea.status === "archived" ? "new" : "archived")}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold text-slate-500 hover:text-ink"
          >
            <Archive className="size-3.5" /> {idea.status === "archived" ? "Restore" : "Archive"}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {needsName && <NameField value={name} onChange={setName} />}
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Idea</span>
          <input value={form.title} onChange={set("title")} maxLength={140} placeholder="e.g. Behind the scenes of the new menu" className={field} autoFocus={!idea} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Details</span>
          <textarea value={form.body} onChange={set("body")} rows={4} maxLength={4000} placeholder="What should it show or say? Caption ideas, people, products, timing…" className={`${field} resize-y`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Where</span>
            <span className="relative block">
              <select value={form.platform} onChange={set("platform")} className={`${field} appearance-none pr-8`}>
                <option value="">Anywhere</option>
                {PICK_PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 mt-0.5 size-4 -translate-y-1/2 text-slate-400" />
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Ideally by</span>
            <input type="date" value={form.targetDate} onChange={set("targetDate")} className={field} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Reference link</span>
          <input value={form.link} onChange={set("link")} inputMode="url" maxLength={600} placeholder="A post, reel or page you like (optional)" className={field} />
        </label>
        {idea?.link && (
          <a href={idea.link} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-brand underline underline-offset-2">
            <ExternalLink className="size-3.5" /> Open reference
          </a>
        )}
        {error && <p className="text-sm font-semibold text-[#9a4a3c]">{error}</p>}
        {idea && (
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Lightbulb className="size-3.5" />
            Added by {idea.authorRole === "studio" ? `${idea.authorName ?? studioName} (studio)` : (idea.authorName ?? "the client")} on{" "}
            {new Date(idea.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        )}
      </div>

      {idea && <Comments ctx={ctx} role={role} target={{ ideaId: idea.id }} comments={idea.comments} studioName={studioName} />}
    </Sheet>
  );
}
