"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { saveClientProfile } from "@/app/admin/clients/actions";
import { SWATCHES } from "@/lib/calendar";
import { type ClientContact, type ClientDate, type ClientProfile, SOCIALS, STATUSES } from "@/lib/client-profile-types";

const field =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base outline-none placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/15 sm:text-sm";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-slate-100 py-6 first:border-t-0 first:pt-0 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8">
      <div>
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

let nextKey = 1;
const keyed = <T,>(v: T) => ({ ...v, k: nextKey++ });
const blankContact = (): ClientContact & { k: number } => keyed({ name: "", role: "", email: "", phone: "" });
const blankDate = (): ClientDate & { k: number } => keyed({ label: "", date: "" });

export function ClientProfileForm({ client, suggestedColor }: { client?: ClientProfile; suggestedColor?: string }) {
  const [state, action, pending] = useActionState(saveClientProfile, undefined);
  const colors: string[] = client && !SWATCHES.some((c) => c.toLowerCase() === client.color.toLowerCase()) ? [client.color, ...SWATCHES] : [...SWATCHES];
  const [color, setColor] = useState(client?.color ?? suggestedColor ?? SWATCHES[0]);
  const [contacts, setContacts] = useState(() => (client?.contacts.length ? client.contacts.map(keyed) : [blankContact()]));
  const [dates, setDates] = useState(() => (client?.dates.length ? client.dates.map(keyed) : []));

  return (
    <form action={action} className="rounded-[22px] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
      {client && <input type="hidden" name="id" value={client.id} />}
      <input type="hidden" name="color" value={color} />

      <Section title="Basics" hint="The name matches rooms by their “Prepared for” field.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client name">
            <input name="name" required maxLength={60} defaultValue={client?.name} placeholder="Crema Cafe" className={field} />
          </Field>
          <Field label="Industry">
            <input name="industry" maxLength={80} defaultValue={client?.industry ?? ""} placeholder="Coffee shop" className={field} />
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">Status</span>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <label key={s.id} className="cursor-pointer">
                <input type="radio" name="status" value={s.id} defaultChecked={(client?.status ?? "active") === s.id} className="peer sr-only" />
                <span className="inline-flex h-9 items-center rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-600 transition-colors peer-checked:bg-ink peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-brand/20">
                  {s.label}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">Color</span>
          <div className="flex flex-wrap items-center gap-2.5">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={color.toLowerCase() === c.toLowerCase()}
                onClick={() => setColor(c)}
                className={`size-8 rounded-full ring-offset-2 transition ${color.toLowerCase() === c.toLowerCase() ? "ring-2 ring-ink" : "hover:scale-110"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section title="People" hint="Who you talk to. The first one is the main contact.">
        <div className="space-y-3">
          {contacts.map((c, i) => (
            <div key={c.k} className="relative grid gap-2.5 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70 sm:grid-cols-2">
              <input name="contact_name" defaultValue={c.name} maxLength={80} placeholder="Name" aria-label="Contact name" className={field} />
              <input name="contact_role" defaultValue={c.role} maxLength={80} placeholder="Role (Owner, Manager…)" aria-label="Role" className={field} />
              <input name="contact_email" type="email" defaultValue={c.email} maxLength={120} placeholder="Email" aria-label="Contact email" className={field} />
              <input name="contact_phone" type="tel" defaultValue={c.phone} maxLength={40} placeholder="Phone" aria-label="Contact phone" className={field} />
              {contacts.length > 1 && (
                <button
                  type="button"
                  aria-label="Remove contact"
                  onClick={() => setContacts(contacts.filter((_, j) => j !== i))}
                  className="absolute -right-2 -top-2 inline-flex size-7 items-center justify-center rounded-full bg-white text-slate-400 shadow ring-1 ring-slate-200 hover:text-clay"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setContacts([...contacts, blankContact()])} className="inline-flex h-9 items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
          <Plus className="size-4" /> Add a person
        </button>
      </Section>

      <Section title="Business details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business phone">
            <input name="phone" type="tel" maxLength={40} defaultValue={client?.phone ?? ""} placeholder="(661) 555-0123" className={field} />
          </Field>
          <Field label="Business email">
            <input name="email" type="email" maxLength={120} defaultValue={client?.email ?? ""} placeholder="hello@cremacafe.com" className={field} />
          </Field>
          <Field label="Website">
            <input name="website" maxLength={200} defaultValue={client?.website ?? ""} placeholder="cremacafe.com" className={field} />
          </Field>
          <Field label="Google Drive folder">
            <input name="drive_url" type="url" maxLength={500} defaultValue={client?.drive_url ?? ""} placeholder="https://drive.google.com/…" className={field} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <textarea name="address" rows={2} maxLength={300} defaultValue={client?.address ?? ""} placeholder={"1234 Truxtun Ave\nBakersfield, CA 93301"} className={field} />
          </Field>
        </div>
      </Section>

      <Section title="Social" hint="Handles or full links.">
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIALS.map((s) => (
            <Field key={s.key} label={s.label}>
              <input
                name={`social_${s.key}`}
                maxLength={200}
                defaultValue={client?.socials[s.key] ?? ""}
                placeholder={s.key === "google" ? "Maps or profile link" : "@handle"}
                className={field}
              />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Package & billing">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Package">
            <input name="package" maxLength={120} defaultValue={client?.package ?? ""} placeholder="Social Growth: 12 posts + 4 reels" className={field} />
          </Field>
          <Field label="Monthly rate">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input name="monthly_rate" inputMode="decimal" maxLength={20} defaultValue={client?.monthly_rate ?? ""} placeholder="1,500" className={`${field} pl-7`} />
            </div>
          </Field>
          <Field label="Client since">
            <input name="client_since" type="date" defaultValue={client?.client_since ?? ""} className={field} />
          </Field>
          <Field label="Contract renews">
            <input name="renews_on" type="date" defaultValue={client?.renews_on ?? ""} className={field} />
          </Field>
          <Field label="Billing notes" className="sm:col-span-2">
            <textarea name="billing_notes" rows={2} maxLength={1000} defaultValue={client?.billing_notes ?? ""} placeholder="Invoice on the 1st, Net 15, pays by Zelle" className={field} />
          </Field>
        </div>
      </Section>

      <Section title="Important dates" hint="Birthdays, anniversaries, launches. Yearly dates roll over.">
        {dates.length > 0 && (
          <div className="space-y-2.5">
            {dates.map((d, i) => (
              <div key={d.k} className="flex flex-wrap gap-2.5 max-sm:rounded-2xl max-sm:bg-slate-50 max-sm:p-3 max-sm:ring-1 max-sm:ring-slate-200/70 sm:flex-nowrap">
                <input name="date_label" defaultValue={d.label} maxLength={60} placeholder="Owner's birthday" aria-label="What" className={`${field} min-w-0 basis-full sm:basis-auto sm:flex-1`} />
                <input name="date_value" type="date" defaultValue={d.date} aria-label="Date" className={`${field} min-w-0 flex-1 sm:w-[10.5rem] sm:flex-none`} />
                <button
                  type="button"
                  aria-label="Remove date"
                  onClick={() => setDates(dates.filter((_, j) => j !== i))}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-clay"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setDates([...dates, blankDate()])} className="inline-flex h-9 items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
          <Plus className="size-4" /> Add a date
        </button>
      </Section>

      <Section title="Brand & notes">
        <Field label="Brand notes">
          <textarea
            name="brand_notes"
            rows={4}
            maxLength={4000}
            defaultValue={client?.brand_notes ?? ""}
            placeholder="Voice, colors, fonts, do's and don'ts, hashtags…"
            className={field}
          />
        </Field>
        <Field label="About this client">
          <textarea name="notes" rows={4} maxLength={4000} defaultValue={client?.notes ?? ""} placeholder="Anything else worth remembering" className={field} />
        </Field>
      </Section>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-5 -mb-5 flex items-center justify-end gap-3 rounded-b-[22px] border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:-mb-8 sm:px-8 lg:bottom-0">
        {state?.error && <p className="mr-auto text-sm text-clay">{state.error}</p>}
        <button disabled={pending} className="h-11 rounded-full bg-ink px-6 text-sm font-bold text-white hover:bg-slate-brand disabled:opacity-60">
          {pending ? "Saving…" : client ? "Save changes" : "Add client"}
        </button>
      </div>
    </form>
  );
}
