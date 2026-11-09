"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { themeList } from "@/config/themes";
import type { StudioSettings } from "@/lib/settings";
import { saveSettings, type SettingsState } from "./actions";

const field =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 sm:text-sm";

export function SettingsForm({ settings }: { settings: StudioSettings }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  const logoInput = useRef<HTMLInputElement>(null);
  const resetInput = useRef<HTMLInputElement>(null);
  const [editedSince, setEditedSince] = useState<SettingsState | null>(null);
  const [logo, setLogo] = useState<{ url: string; file: File; revision: number } | null>(null);
  const revision = state?.revision ?? 0;
  const preview = logo?.revision === revision ? logo : null;
  const previewUrl = preview?.url;
  const feedback = editedSince === state ? undefined : state;

  useEffect(() => {
    if (state?.ok) {
      if (logoInput.current) logoInput.current.value = "";
      if (resetInput.current) resetInput.current.checked = false;
    }
  }, [state]);

  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <form
      action={action}
      onChange={() => setEditedSince(state)}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const data = new FormData(event.currentTarget);
        if (preview) data.set("logo", preview.file);
        startTransition(() => action(data));
      }}
    >
      <fieldset disabled={pending} className="min-w-0 space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Studio name</span>
            <input name="agency_name" required maxLength={60} defaultValue={settings.name} className={field} />
          </label>
          <div className="min-w-0">
            <label htmlFor="studio-contact-email" className="mb-1.5 block text-sm font-semibold text-slate-700">Contact email</label>
            <input
              id="studio-contact-email"
              name="contact_email"
              type="email"
              aria-describedby="studio-contact-email-help"
              maxLength={160}
              defaultValue={settings.contactEmail ?? ""}
              placeholder="hello@yourstudio.com"
              className={field}
            />
            <p id="studio-contact-email-help" className="mt-1 text-xs text-slate-600">
              Shown on Privacy, Terms, and closed rooms. If blank, the legal pages omit the address and closed rooms link to the website contact form.
            </p>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Default &ldquo;Delivered by&rdquo;</span>
            <input name="delivered_by" maxLength={60} defaultValue={settings.deliveredBy} className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">&ldquo;Powered by&rdquo; tag in rooms</span>
            <input name="powered_by_label" maxLength={60} defaultValue={settings.poweredByLabel} className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Default theme for new rooms</span>
            <select name="default_theme" defaultValue={settings.defaultTheme} className={field}>
              {themeList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-sm font-semibold text-slate-700">Logo in rooms and the admin</legend>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-16 w-28 shrink-0 items-center justify-center rounded-2xl bg-ink p-3">
              <img src={preview?.url ?? settings.markOnDark} alt="" className="max-h-full max-w-full object-contain" />
            </span>
            <div className="w-full min-w-0 space-y-2 text-sm sm:flex-1">
              <label htmlFor="studio-logo" className="block font-semibold text-slate-700">Upload a studio logo</label>
              <input
                ref={logoInput}
                id="studio-logo"
                name="logo"
                type="file"
                aria-describedby="studio-logo-help"
                accept="image/png,image/webp,image/svg+xml,image/jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setLogo(f ? { url: URL.createObjectURL(f), file: f, revision } : null);
                  if (f && resetInput.current) resetInput.current.checked = false;
                }}
                className="block w-full min-w-0 max-w-full overflow-hidden rounded-full text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink file:mr-2 file:min-h-11 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:text-sm file:font-semibold"
              />
              {preview && <p className="break-all text-xs text-slate-600">Selected file: {preview.file.name}</p>}
              <p id="studio-logo-help" className="text-xs text-slate-600">PNG, WebP, SVG, or JPEG, up to 900 KB. A light logo on a transparent background works best in dark rooms.</p>
              {settings.logoPath && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    ref={resetInput}
                    type="checkbox"
                    name="reset_logo"
                    className="size-4"
                    onChange={(e) => {
                      if (e.target.checked) {
                        if (logoInput.current) logoInput.current.value = "";
                        setLogo(null);
                      }
                    }}
                  /> Use the brand kit logo
                </label>
              )}
            </div>
          </div>
        </fieldset>

        {feedback?.error && <p role="alert" className="text-sm text-red-700">{feedback.error}</p>}
        <p role="status" className="empty:hidden text-sm text-emerald-800">
          {pending ? "Saving settings…" : feedback?.ok ? "Saved. Rooms use the new settings right away." : ""}
        </p>
        <button disabled={pending} className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
          {pending ? "Saving…" : "Save settings"}
        </button>
      </fieldset>
    </form>
  );
}
