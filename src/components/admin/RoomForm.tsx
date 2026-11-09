"use client";

import { startTransition, useActionState, useState } from "react";
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
  "w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 sm:text-sm";

export function RoomForm({ action, room, submitLabel, defaults }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [preset, setPreset] = useState(room?.theme_preset ?? defaults?.theme ?? DEFAULT_THEME);
  const [payment, setPayment] = useState(room?.payment_status ?? "none");
  const [accent, setAccent] = useState(room?.accent_color ?? getTheme(preset).accent);
  const [visibility, setVisibility] = useState(room?.status ?? "draft");
  const willPublish = !!room && room.status !== "live" && visibility === "live";

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        // Dispatch explicitly to keep edited values in the form after saving.
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-5"
    >
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
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Link expires (optional)</span>
          <input
            id="room-expiration"
            name="expires_at"
            type="date"
            defaultValue={room?.expires_at ? room.expires_at.slice(0, 10) : ""}
            className={`${field} scroll-mt-24`}
          />
        </label>
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
        <>
          <section aria-labelledby="room-publishing" className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 id="room-publishing" tabIndex={-1} className="scroll-mt-24 text-base font-bold text-ink">Client publishing</h3>
            <p id="room-status-help" className="mt-1 text-sm text-slate-600">
              Choose Live and save to open the room under its client access and expiration settings.
            </p>
            <label className="mt-3 block max-w-xs">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Room status</span>
              <select
                name="status"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as RoomRow["status"])}
                aria-describedby="room-status-help"
                className={field}
              >
                <option value="draft">Draft</option>
                <option value="live">Live</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </section>
          <fieldset id="room-portfolio" tabIndex={-1} className="scroll-mt-24 rounded-2xl border border-slate-200 p-4">
            <legend className="px-1 text-base font-bold text-ink">Public portfolio</legend>
            <label className="flex min-h-11 items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                name="showcase"
                defaultChecked={room.showcase}
                aria-describedby="showcase-help"
                className="mt-0.5 size-5 shrink-0 accent-[#1d2b32]"
              />
              <span className="font-semibold text-ink">Include this shoot in Recent work</span>
            </label>
            <p id="showcase-help" className="text-sm text-slate-600">
              The public home page can show the project name and up to 12 photos. Draft and expired rooms can appear here when this is selected. Archived rooms are excluded.
            </p>
          </fieldset>
        </>
      )}

      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <p role="status" className={`empty:sr-only text-sm ${state?.warning ? "text-amber-700" : "text-emerald-800"}`}>
        {state?.ok ? state.warning ?? "Saved." : ""}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : willPublish ? "Save and publish" : submitLabel}
      </button>
    </form>
  );
}
