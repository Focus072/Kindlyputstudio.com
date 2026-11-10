"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Send } from "lucide-react";
import { type Ctx, addComment } from "@/app/cal/actions";
import type { CalComment, Role } from "@/lib/ideas";

const NAME_KEY = "kp-cal-name";

const listeners = new Set<() => void>();

function readName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The name a client typed once, remembered on this device. */
export function useGuestName(): [string, (v: string) => void] {
  const name = useSyncExternalStore(subscribe, readName, () => "");
  return [
    name,
    (v: string) => {
      try {
        localStorage.setItem(NAME_KEY, v);
      } catch {
        /* private mode */
      }
      listeners.forEach((fn) => fn());
    },
  ];
}

export function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500">Your name</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={60}
        autoComplete="name"
        placeholder="So the studio knows who wrote it"
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-ink outline-none focus:border-slate-brand sm:text-sm"
      />
    </label>
  );
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function Comments({
  ctx,
  role,
  target,
  comments,
  studioName,
}: {
  ctx: Ctx;
  role: Role;
  target: { ideaId?: string; postKey?: string };
  comments: CalComment[];
  studioName: string;
}) {
  const router = useRouter();
  const [name, setName] = useGuestName();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<CalComment[]>([]);
  const [pending, start] = useTransition();
  const all = [...comments, ...mine.filter((m) => !comments.some((c) => c.id === m.id))];
  const needsName = role === "client" && !name.trim();

  function send() {
    const body = text.trim();
    if (!body) return;
    setError(null);
    start(async () => {
      const r = await addComment({ ...ctx, name }, target, body);
      if (!r.ok) return setError(r.error);
      setMine((m) => [
        ...m,
        { id: r.id ?? `tmp-${Date.now()}`, ideaId: target.ideaId ?? null, postKey: target.postKey ?? null, body, authorName: role === "client" ? name : studioName, authorRole: role, createdAt: new Date().toISOString() },
      ]);
      setText("");
      router.refresh();
    });
  }

  return (
    <section aria-label="Comments" className="mt-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Comments{all.length ? ` · ${all.length}` : ""}</h3>
      {all.length === 0 && <p className="mt-2 text-sm text-slate-500">No comments yet. Questions, tweaks or a thumbs up all go here.</p>}
      <ul className="mt-2 space-y-2">
        {all.map((c) => (
          <li key={c.id} className={`rounded-2xl px-3.5 py-2.5 text-sm ${c.authorRole === "studio" ? "bg-slate-100 text-ink" : "bg-[#eef1ec] text-ink"}`}>
            <p className="flex items-baseline justify-between gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{c.authorRole === "studio" ? `${c.authorName ?? studioName} · Studio` : (c.authorName ?? "Client")}</span>
              <span>{when(c.createdAt)}</span>
            </p>
            <p className="mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-3 space-y-2">
        {needsName && <NameField value={name} onChange={setName} />}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
            rows={2}
            maxLength={2000}
            placeholder="Write a comment"
            className="min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-ink outline-none focus:border-slate-brand sm:text-sm"
          />
          <button
            onClick={send}
            disabled={pending || !text.trim() || needsName}
            aria-label="Send comment"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white hover:bg-slate-brand disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
        {error && <p className="text-sm font-semibold text-[#9a4a3c]">{error}</p>}
      </div>
    </section>
  );
}
