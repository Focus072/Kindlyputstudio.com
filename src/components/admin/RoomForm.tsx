"use client";

import { useActionState, useState } from "react";
import { brand } from "@/config/brand";
import { DEFAULT_THEME, getTheme, themeList } from "@/config/themes";
import type { RoomRow } from "@/lib/types";

type State = { error?: string; ok?: boolean; warning?: string } | undefined;

type Props = {
  action: (prev: State, formData: FormData) => Promise<State>;
  room?: RoomRow;
  submitLabel: string;
  /** Studio defaults from Admin > Settings, used for new rooms. */
  defaults?: { deliveredBy: string; theme: string };
};

const field =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 sm:text-sm";

export function RoomForm({ action, room, submitLabel, defaults }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [preset, setPreset] = useState(room?.theme_preset ?? defaults?.theme ?? DEFAULT_THEME);
  const [payment, setPayment] = useState(room?.payment_status ?? "none");
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
          <input name="delivered_by" maxLength={60} defaultValue={room?.delivered_by ?? defaults?.deliveredBy ?? brand.deliveredBy} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Review by (optional)</span>
            <input name="review_by" type="date" defaultValue={room?.review_by ?? ""} className={field} />
          </label>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Link expires (optional)</span>
            <input
              name="expires_at"
              type="date"
              defaultValue={room?.expires_at ? room.expires_at.slice(0, 10) : ""}
              className={field}
            />
          </label>
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">Note to the client (optional)</span>
        <textarea
          name="intro"
          rows={2}
          maxLength={600}
          defaultValue={room?.intro ?? ""}
          placeholder="Here are your fall campaign edits. Approve your favorites by Friday."
          className={`${field} resize-y`}
        />
      </label>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-slate-700">Room theme</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {themeList.map((t) => (
            <label
              key={t.id}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 sm:last:odd:col-span-2 ${
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
            className="kp-color h-10 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
          />
          Accent color for this room <span className="font-typewriter text-xs text-slate-400">{accent}</span>
        </label>
      </fieldset>

      {room && (
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Grid layout</span>
            <select name="layout" defaultValue={room.layout ?? "grid"} className={field}>
              <option value="grid">Even grid (every tile 4:5)</option>
              <option value="natural">True shape (reels stay tall, wide shots stay wide)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Downloads</span>
            <select name="downloads" defaultValue={room.downloads ?? "on"} className={field}>
              <option value="on">Every file</option>
              <option value="approved">Only files the client approved</option>
              <option value="off">Off (view and review only)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Payment</span>
            <select
              name="payment_status"
              value={payment}
              onChange={(e) => setPayment(e.target.value as typeof payment)}
              className={field}
            >
              <option value="none">No invoice in this room</option>
              <option value="due">Invoice due (downloads locked until paid)</option>
              <option value="paid">Paid (downloads open)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Payment link</span>
            <input
              name="payment_url"
              type="url"
              inputMode="url"
              maxLength={500}
              defaultValue={room.payment_url ?? ""}
              placeholder="Stripe, Square, or PayPal invoice link"
              className={field}
            />
            {payment === "due" && (
              <span className="mt-1 block text-xs text-slate-500">The room shows a Pay invoice button. Switch to Paid once it clears.</span>
            )}
          </label>
        </div>
      )}

      {room && (
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" name="watermark" defaultChecked={!!room.watermark} className="mt-0.5 size-5 accent-[#1d2b32]" />
          <span>
            <span className="font-semibold text-ink">Watermark previews</span>
            <span className="block text-slate-500">Tiles your studio name over every preview. Downloads stay clean.</span>
          </span>
        </label>
      )}

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

      {room && (
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" name="showcase" defaultChecked={room.showcase} className="mt-0.5 size-5 accent-[#1d2b32]" />
          <span>
            <span className="font-semibold text-ink">Show in Recent work on the home page</span>
            <span className="block text-slate-500">Uses this room&rsquo;s photos as a portfolio piece. The room itself stays private.</span>
          </span>
        </label>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className={`text-sm ${state.warning ? "text-amber-700" : "text-approve"}`}>{state.warning ?? "Saved."}</p>}
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
