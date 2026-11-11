"use client";

import { Check, Link2, Lock, X } from "lucide-react";
import { useState, useTransition } from "react";
import { addInvites, removeInvite, resolveAccessRequest, setAccessMode } from "@/app/admin/actions";

type Props = {
  roomId: string;
  mode: "link" | "invited";
  invites: string[];
  requests: { id: string; email: string | null; name: string | null }[];
};

/** Who can open the room: anyone with the link, or only the guest list. */
export function RoomAccess({ roomId, mode, invites, requests }: Props) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const option = (value: "link" | "invited", Icon: typeof Lock, title: string, body: string) => (
    <button
      type="button"
      disabled={pending}
      onClick={() => value !== mode && start(() => setAccessMode(roomId, value))}
      aria-pressed={mode === value}
      className={`flex flex-1 items-start gap-3 rounded-2xl border p-3 text-left ${
        mode === value ? "border-ink ring-2 ring-ink/10" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-ink" />
      <span>
        <span className="block text-sm font-bold text-ink">{title}</span>
        <span className="block text-xs text-slate-500">{body}</span>
      </span>
    </button>
  );

  return (
    <div className={`space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 ${pending ? "opacity-70" : ""}`}>
      <div className="flex flex-col gap-2 sm:flex-row">
        {option("link", Link2, "Anyone with the link", "They create a free account, then they are in. Share links below skip the account.")}
        {option("invited", Lock, "Guest list only", "Only the emails below. Others can request access.")}
      </div>

      {requests.length > 0 && (
        <div className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-800">Waiting for access</p>
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold text-ink">{r.name ?? "Someone"}</span>{" "}
                  <span className="text-slate-500">{r.email}</span>
                </span>
                <button
                  type="button"
                  onClick={() => start(() => resolveAccessRequest(roomId, r.id, true))}
                  className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white"
                >
                  <Check className="size-3.5" /> Let in
                </button>
                <button
                  type="button"
                  onClick={() => start(() => resolveAccessRequest(roomId, r.id, false))}
                  aria-label={`Decline ${r.email ?? "request"}`}
                  className="inline-flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === "invited" && (
        <div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const value = draft.trim();
              if (!value) return;
              start(async () => {
                const res = await addInvites(roomId, value);
                setDraft("");
                setNote(
                  res.invalid.length
                    ? `Added ${res.added}. Not an email: ${res.invalid.slice(0, 3).join(", ")}`
                    : `Added ${res.added} ${res.added === 1 ? "person" : "people"}.`,
                );
              });
            }}
            className="flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="client@business.com, partner@business.com"
              className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-base outline-none focus:border-brand sm:text-sm"
            />
            <button className="rounded-full bg-ink px-4 text-sm font-bold text-white">Add</button>
          </form>
          {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
          {invites.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nobody is on the list yet. Add the client&rsquo;s email before you send the link.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {invites.map((email) => (
                <li key={email} className="flex min-w-0 max-w-full items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm text-slate-700">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{email}</span>
                  <button
                    type="button"
                    onClick={() => start(() => removeInvite(roomId, email))}
                    aria-label={`Remove ${email}`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-slate-200 sm:size-6"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
