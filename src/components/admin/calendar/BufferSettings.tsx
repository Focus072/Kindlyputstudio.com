"use client";

import { useActionState, useState, useTransition } from "react";
import { CircleCheck, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { assignChannel, connectBuffer, disconnectBuffer, refreshChannels, type ActionState } from "@/app/admin/calendar/actions";
import { clientsFromChannels } from "@/app/admin/calendar/buffer-actions";
import { type CalClient, platformInfo } from "@/lib/calendar";

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
          <p className="mr-auto text-sm font-semibold text-ink">Connected to Buffer</p>
          <form action={refresh}>
            <button disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-ink hover:text-ink">
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh channels
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

type Channel = { id: string; name: string; service: string; avatar: string | null; client_id: string | null };

export function ChannelList({ channels, clients }: { channels: Channel[]; clients: CalClient[] }) {
  if (!channels.length) return <p className="mt-4 text-sm text-slate-500">No Buffer channels found yet. Press Refresh channels.</p>;
  const color = new Map(clients.map((c) => [c.id, c.color]));

  return (
    <div className="mt-5">
      <h3 className="text-sm font-bold text-ink">Which client is each channel?</h3>
      <p className="text-sm text-slate-500">Posts take the color of the channel&rsquo;s client.</p>
      {channels.some((c) => !c.client_id) && <AutoClients />}
      <ul className="mt-3 divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">
        {channels.map((ch) => (
          <li key={ch.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="relative shrink-0">
              {ch.avatar ? (
                <img src={ch.avatar} alt="" className="size-9 rounded-full bg-slate-100 object-cover" />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{platformInfo(ch.service).short}</span>
              )}
              <span
                className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full ring-2 ring-white"
                style={{ background: (ch.client_id && color.get(ch.client_id)) || "#cbd5e1" }}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{ch.name}</span>
              <span className="block text-xs text-slate-500">{platformInfo(ch.service).label}</span>
            </span>
            <ChannelSelect key={`${ch.id}-${ch.client_id ?? ""}`} channelId={ch.id} channelName={ch.name} value={ch.client_id ?? ""} clients={clients} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AutoClients() {
  const [state, run, pending] = useActionState(clientsFromChannels, undefined);
  return (
    <form action={run} className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-3">
      <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-brand disabled:opacity-50">
        <Sparkles className="size-4" /> {pending ? "Setting up…" : "Make a client for each channel"}
      </button>
      <span className="min-w-0 flex-1 text-xs text-slate-500">
        {state?.error || state?.ok || "Channels with matching names (like “Joe’s Pizza” and joespizza_bakery) share one client. You can rename, recolor or reassign after."}
      </span>
    </form>
  );
}

/**
 * Controlled, so the picked client stays visible while it saves and after the
 * page refreshes (a plain form select snapped back to its first value).
 */
function ChannelSelect({ channelId, channelName, value, clients }: { channelId: string; channelName: string; value: string; clients: CalClient[] }) {
  const [current, setCurrent] = useState(value);
  const [failed, setFailed] = useState(false);
  const [saving, start] = useTransition();
  return (
    <span className="flex shrink-0 flex-col items-end">
    <select
      value={current}
      disabled={saving}
      onChange={(e) => {
        const next = e.target.value;
        const before = current;
        setCurrent(next);
        setFailed(false);
        const fd = new FormData();
        fd.set("channel_id", channelId);
        fd.set("client_id", next);
        start(async () => {
          const r = await assignChannel(fd);
          if (r.error) {
            setCurrent(before);
            setFailed(true);
          }
        });
      }}
      aria-label={`Client for ${channelName}`}
      className="h-10 max-w-40 shrink-0 rounded-xl border border-slate-200 bg-white px-2 text-base outline-none focus:border-ink disabled:opacity-60 sm:max-w-52 sm:text-sm"
    >
      <option value="">No client</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
    {failed && <span className="mt-1 text-[11px] font-semibold text-decline">Didn&rsquo;t save. Try again.</span>}
    </span>
  );
}
