"use client";

import { useActionState, useEffect } from "react";
import { X } from "lucide-react";
import { deletePost, savePost } from "@/app/admin/calendar/actions";
import { type CalClient, type CalPost, PLATFORMS } from "@/lib/calendar";
import { dayKey, timeInput } from "@/lib/calendar-time";

const field =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-ink focus:ring-4 focus:ring-ink/10 sm:text-sm";

export function PostEditor({ post, defaultDate, clients, onClose }: { post: CalPost | null; defaultDate: string; clients: CalClient[]; onClose: () => void }) {
  const [state, action, pending] = useActionState(savePost, undefined);

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={post ? "Edit post" : "Add post"}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl uppercase leading-none text-ink">{post ? "Edit post" : "Add post"}</h2>
          <button onClick={onClose} aria-label="Close" className="inline-flex size-10 items-center justify-center rounded-full hover:bg-slate-100">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">For ideas, drafts, or anything not in Buffer. Times are Bakersfield time.</p>

        <form action={action} className="mt-4 space-y-4">
          {post && <input type="hidden" name="id" value={post.id} />}
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Client</span>
            <select name="client_id" defaultValue={post?.clientId ?? clients[0]?.id ?? ""} className={field}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="">No client</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Date</span>
              <input type="date" name="date" required defaultValue={post ? dayKey(post.at) : defaultDate} className={field} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Time</span>
              <input type="time" name="time" required defaultValue={post ? timeInput(post.at) : "09:00"} className={field} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Platform</span>
              <select name="platform" defaultValue={post?.platform ?? "instagram"} className={field}>
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Status</span>
              <select name="status" defaultValue={post?.status ?? "scheduled"} className={field}>
                <option value="idea">Idea</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="posted">Posted</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Caption</span>
            <textarea name="caption" rows={4} maxLength={5000} defaultValue={post?.caption} placeholder="What's the post?" className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Notes (only you see these)</span>
            <input name="notes" maxLength={2000} defaultValue={post?.notes ?? ""} placeholder="Reel from the Oct shoot, needs client OK" className={field} />
          </label>

          {state?.error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button disabled={pending} className="h-12 flex-1 rounded-full bg-ink text-sm font-semibold text-white hover:bg-slate-brand disabled:opacity-50">
              {pending ? "Saving…" : post ? "Save changes" : "Add to calendar"}
            </button>
            {post && (
              <button
                formAction={async (fd) => {
                  if (!confirm("Delete this post from the calendar?")) return;
                  await deletePost(fd);
                  onClose();
                }}
                formNoValidate
                className="h-12 rounded-full border border-slate-200 px-5 text-sm font-semibold text-decline hover:border-decline"
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
