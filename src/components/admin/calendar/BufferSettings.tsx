"use client";

import { useActionState, useTransition } from "react";
import { CircleCheck, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { connectBuffer, disconnectBuffer, refreshChannels, type ActionState } from "@/app/admin/calendar/actions";
import { clientsFromChannels } from "@/app/admin/calendar/buffer-actions";

const field =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-ink focus:ring-4 focus:ring-ink/10 sm:text-sm";

export function BufferConnect({ connected }: { connected: "settings" | "env" | null }) {
  const [state, action, pending] = useActionState(connectBuffer, undefined);
  const [refreshState, refresh, refreshing] = useActionState<ActionState>(refreshChannels, undefined);
  const [leaving, startLeave] = useTransition();

  if (connected) {
    return (
      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-approve/10 px-4 py-3">
          <CircleCheck className="size-5 text-approve" />
          <p className="mr-auto text-sm font-semibold text-ink">Connected<span className="max-sm:hidden"> to Buffer</span></p>
          <form action={refresh}>
            <button disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-ink hover:text-ink">
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Syncing…" : "Sync now"}
            </button>
          </form>
          {connected === "settings" && (
            <button
              onClick={() => confirm("Disconnect Buffer? The calendar will stop showing Buffer posts.") && startLeave(() => disconnectBuffer())}
              disabled={leaving}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-decline"
            >
              Disconnect
            </button>
          )}
        </div>
        {(refreshState?.ok || refreshState?.error || state?.ok) && (
          <p className={`mt-2 text-sm ${refreshState?.error ? "text-red-700" : "text-slate-500"}`}>{refreshState?.error || refreshState?.ok || state?.ok}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>
          In Buffer, open{" "}
          <a href="https://publish.buffer.com/settings/api" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-ink underline underline-offset-2">
            Settings → API <ExternalLink className="size-3" />
          </a>
          .
        </li>
        <li>Create a new API key and copy it.</li>
        <li>Paste it below.</li>
      </ol>
      <form action={action} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input name="api_key" type="password" autoComplete="off" required placeholder="Buffer API key" className={field} />
        <button disabled={pending} className="h-12 shrink-0 rounded-full bg-ink px-6 text-sm font-semibold text-white hover:bg-slate-brand disabled:opacity-50">
          {pending ? "Checking…" : "Connect"}
        </button>
      </form>
      {state?.error && <p className="mt-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <p className="mt-2 text-xs text-slate-400">The key is stored on the server only and is never shown to clients.</p>
    </div>
  );
}

export function AutoClients() {
  const [state, run, pending] = useActionState(clientsFromChannels, undefined);
  return (
    <form action={run} className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-3">
      <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-brand disabled:opacity-50">
        <Sparkles className="size-4" /> {pending ? "Setting up…" : "Make a client for each account"}
      </button>
      <span className="min-w-0 flex-1 text-xs text-slate-500">
        {state?.error || state?.ok || "Channels with matching names (like “Joe’s Pizza” and joespizza_bakery) share one client. You can rename, recolor or reassign after."}
      </span>
    </form>
  );
}
