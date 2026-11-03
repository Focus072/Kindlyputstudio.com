"use client";

import { useActionState, useState } from "react";
import { themeList } from "@/config/themes";
import type { StudioSettings } from "@/lib/settings";
import { saveSettings } from "./actions";

const field =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 sm:text-sm";

export function SettingsForm({ settings }: { settings: StudioSettings }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Studio name</span>
          <input name="agency_name" required maxLength={60} defaultValue={settings.name} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Contact email</span>
          <input
            name="contact_email"
            type="email"
            maxLength={160}
            defaultValue={settings.contactEmail ?? ""}
            placeholder="hello@yourstudio.com"
            className={field}
          />
          <span className="mt-1 block text-xs text-slate-500">Shown on the Privacy and Terms pages and on closed rooms.</span>
        </label>
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

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-slate-700">Logo in rooms and the admin</legend>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-28 items-center justify-center rounded-2xl bg-ink p-3">
            <img src={preview ?? settings.markOnDark} alt="" className="max-h-full max-w-full object-contain" />
          </span>
          <div className="space-y-2 text-sm">
            <input
              name="logo"
              type="file"
              accept="image/png,image/webp,image/svg+xml,image/jpeg"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview(f ? URL.createObjectURL(f) : null);
              }}
              className="block text-sm file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold"
            />
            <p className="text-xs text-slate-500">A light logo on a transparent background works best (rooms are dark). Under 900 KB.</p>
            {settings.logoPath && (
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="reset_logo" className="size-4" /> Go back to the brand kit logo
              </label>
            )}
          </div>
        </div>
      </fieldset>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-approve">Saved. Rooms use the new settings right away.</p>}
      <button disabled={pending} className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
