"use client";

import { useActionState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { addClientNote, deleteClientNote } from "@/app/admin/clients/actions";
import type { ClientNote } from "@/lib/client-profile-types";
import { timeAgo } from "@/lib/format";

export function NotesLog({ clientId, notes, ready }: { clientId: string; notes: ClientNote[]; ready: boolean }) {
  const [state, action, pending] = useActionState(addClientNote, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <form ref={form} action={action} className="border-b border-slate-100 p-4">
        <input type="hidden" name="client_id" value={clientId} />
        <label className="sr-only" htmlFor="note-body">New note</label>
        <textarea
          id="note-body"
          name="body"
          rows={2}
          maxLength={4000}
          disabled={!ready}
          placeholder={ready ? "Log a call, a meeting, a request…" : "Notes turn on after the client profile update is applied."}
          className="block w-full resize-y rounded-xl bg-slate-50 px-3.5 py-2.5 text-base outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand/30 sm:text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) form.current?.requestSubmit();
          }}
        />
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <p className={`text-xs ${state?.error ? "text-clay" : "text-slate-400"}`}>
            {state?.error ?? <span className="max-sm:hidden">Only you and your team see these. ⌘/Ctrl + Enter to save.</span>}
          </p>
          <button
            disabled={pending || !ready}
            className="h-9 shrink-0 rounded-full bg-ink px-4 text-sm font-bold text-white hover:bg-slate-brand disabled:opacity-50"
          >
            {pending ? "Saving…" : "Add note"}
          </button>
        </div>
      </form>
      {notes.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">No notes yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {notes.map((n) => (
            <li key={n.id} className="group flex gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-[15px] text-ink [overflow-wrap:anywhere] sm:text-sm">{n.body}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {n.author ? `${n.author} · ` : ""}
                  {timeAgo(n.created_at)}
                </p>
              </div>
              <form action={deleteClientNote}>
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name="client_id" value={clientId} />
                <button
                  aria-label="Delete note"
                  className="inline-flex size-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-clay sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  onClick={(e) => {
                    if (!confirm("Delete this note?")) e.preventDefault();
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
