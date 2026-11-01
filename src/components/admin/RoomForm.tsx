"use client";

import { useActionState, useState } from "react";
import { brand } from "@/config/brand";
import { DEFAULT_THEME, getTheme, themeList } from "@/config/themes";
import type { RoomRow } from "@/lib/types";

type State = { error?: string; ok?: boolean } | undefined;

type Props = {
  action: (prev: State, formData: FormData) => Promise<State>;
  room?: RoomRow;
  submitLabel: string;
};

const field =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 sm:text-sm";

export function RoomForm({ action, room, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [preset, setPreset] = useState(room?.theme_preset ?? DEFAULT_THEME);
  const [accent, setAccent] = useState(room?.accent_color ?? getTheme(preset).accent);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Project title</span>
          <input name="title" required maxLength={80} defaultValue={room?.title} placeholder="Spring menu shoot" className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Prepared for (client)</span>
          <input name="client_name" required maxLength={60} defaultValue={room?.client_name} placeholder="Luigi's" className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Delivered by</span>
          <input name="delivered_by" maxLength={60} defaultValue={room?.delivered_by ?? brand.deliveredBy} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Link expires (optional)</span>
          <input
            name="expires_at"
            type="date"
            defaultValue={room?.expires_at ? room.expires_at.slice(0, 10) : ""}
            className={field}
          />
        </label>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-slate-700">Room theme</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {themeList.map((t) => (
            <label
              key={t.id}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${
                preset === t.id ? "border-ink ring-2 ring-ink/10" : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="theme_preset"
                value={t.id}
                checked={preset === t.id}
                onChange={() => {
                  setPreset(t.id);
                  setAccent(t.accent);
                }}
                className="sr-only"
              />
              <span
                className="relative size-12 shrink-0 overflow-hidden rounded-xl"
                style={{ background: t.background }}
              >
                <span
                  className="absolute -left-3 top-1 size-10 rounded-full blur-md"
                  style={{ background: preset === t.id ? accent : t.accent, opacity: 0.8 }}
                />
              </span>
              <span>
                <span className="block text-sm font-bold text-ink">{t.label}</span>
                <span className="block text-xs text-slate-500">{t.description}</span>
              </span>
            </label>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-3 text-sm text-slate-700">
          <input
            type="color"
            name="accent_color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
          />
          Accent color for this room <span className="font-typewriter text-xs text-slate-400">{accent}</span>
        </label>
      </fieldset>

      {room && (
        <label className="block max-w-xs">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Status</span>
          <select name="status" defaultValue={room.status} className={field}>
            <option value="live">Live (client can open it)</option>
            <option value="draft">Draft (hidden from client)</option>
            <option value="archived">Archived (closed)</option>
          </select>
        </label>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-approve">Saved.</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
