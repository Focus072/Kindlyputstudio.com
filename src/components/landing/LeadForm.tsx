"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { submitLead } from "@/app/actions";

const field =
  "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-base text-white outline-none placeholder:text-white/40 focus:border-steel";

export function LeadForm() {
  const [state, action, pending] = useActionState(submitLead, undefined);

  if (state?.ok) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-approve" />
        <p className="mt-4 font-display text-4xl uppercase">Got it</p>
        <p className="mt-2 text-mist/80">Thanks for reaching out. We&rsquo;ll get back to you within one business day.</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input name="name" required maxLength={80} placeholder="Your name" autoComplete="name" className={field} />
      <input name="business" maxLength={120} placeholder="Business" autoComplete="organization" className={field} />
      <input name="email" type="email" required maxLength={160} placeholder="Email" autoComplete="email" className={field} />
      <input name="phone" type="tel" maxLength={40} placeholder="Phone (optional)" autoComplete="tel" className={field} />
      <select name="service" defaultValue="" className={`${field} sm:col-span-2 has-[option[value='']:checked]:text-white/40`}>
        <option value="" disabled className="text-ink">What do you need?</option>
        {["Photography", "Video", "Photo + video", "Social content", "Not sure yet"].map((s) => (
          <option key={s} value={s} className="text-ink">{s}</option>
        ))}
      </select>
      <textarea
        name="message"
        rows={4}
        maxLength={2000}
        placeholder="Tell us about the shoot: what, where, and when."
        className={`${field} resize-none sm:col-span-2`}
      />
      {/* Honeypot: hidden from people, irresistible to bots. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {state?.error && <p className="text-sm text-decline sm:col-span-2">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-full bg-steel px-6 py-4 text-sm font-bold uppercase tracking-wider text-ink transition-opacity disabled:opacity-60 sm:col-span-2"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        Start my project
      </button>
    </form>
  );
}
