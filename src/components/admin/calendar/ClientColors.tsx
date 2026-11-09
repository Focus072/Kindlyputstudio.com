"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { assignChannel, deleteClient, saveClient } from "@/app/admin/calendar/actions";
import { type CalClient, PLATFORMS, SWATCHES, platformInfo } from "@/lib/calendar";
import { ChannelAvatar, PlatformIcon } from "./PlatformIcon";

export type SettingsChannel = {
  id: string;
  name: string;
  service: string;
  avatar: string | null;
  client_id: string | null;
  is_disconnected?: boolean | null;
  removed_at?: string | null;
};

const order = (service: string) => {
  const i = PLATFORMS.findIndex((p) => p.id === platformInfo(service).id);
  return i < 0 ? PLATFORMS.length : i;
};

/** Accounts of one client, split by network (Instagram, Facebook, Google…). */
function byNetwork(channels: SettingsChannel[]) {
  const m = new Map<string, SettingsChannel[]>();
  for (const ch of [...channels].sort((a, b) => order(a.service) - order(b.service) || a.name.localeCompare(b.name))) {
    const id = platformInfo(ch.service).id;
    m.set(id, [...(m.get(id) ?? []), ch]);
  }
  return [...m.entries()];
}

/**
 * One card per client with its Buffer accounts grouped by network, plus a card
 * for accounts that aren't matched to anyone yet and a row to add a client.
 */
export function ClientAccounts({ clients, channels, showAccounts }: { clients: CalClient[]; channels: SettingsChannel[]; showAccounts: boolean }) {
  const unassigned = channels.filter((c) => !c.client_id || !clients.some((cl) => cl.id === c.client_id));
  const used = new Set(clients.map((c) => c.color.toLowerCase()));
  const next = SWATCHES.find((s) => !used.has(s)) ?? SWATCHES[clients.length % SWATCHES.length];

  return (
    <div className="mt-5 grid items-start gap-3 lg:grid-cols-2">
      {showAccounts && unassigned.length > 0 && (
        <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-3 sm:p-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-amber-900">Not matched to a client yet</h3>
          <p className="text-xs text-amber-800/80">Pick who each of these belongs to.</p>
          <Networks channels={unassigned} clients={clients} />
        </section>
      )}
      {clients.map((c) => (
        <ClientCard
          key={`${c.id}-${c.color}-${c.name}`}
          client={c}
          clients={clients}
          channels={channels.filter((ch) => ch.client_id === c.id)}
          showAccounts={showAccounts}
        />
      ))}
      <NewClient key={`new-${clients.length}`} defaultColor={next} />
    </div>
  );
}

function ClientCard({ client, clients, channels, showAccounts }: { client: CalClient; clients: CalClient[]; channels: SettingsChannel[]; showAccounts: boolean }) {
  const [state, action, pending] = useActionState(saveClient, undefined);
  const [name, setName] = useState(client.name);
  const [color, setColor] = useState(client.color);
  const [picking, setPicking] = useState(false);
  const [recoloring, startRecolor] = useTransition();
  const dirty = name.trim() !== client.name && !!name.trim();
  const networks = byNetwork(channels);

  function recolor(c: string) {
    setColor(c);
    setPicking(false);
    const fd = new FormData();
    fd.set("id", client.id);
    fd.set("name", client.name);
    fd.set("color", c);
    startRecolor(async () => {
      await saveClient(undefined, fd);
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      <form action={action} className="flex items-center gap-2 p-3 sm:gap-3 sm:px-4" style={{ boxShadow: `inset 4px 0 0 ${color}` }}>
        <input type="hidden" name="id" value={client.id} />
        <input type="hidden" name="color" value={color} />
        <button
          type="button"
          onClick={() => setPicking(!picking)}
          aria-label={`Change ${client.name}'s color`}
          aria-expanded={picking}
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-black/5 transition ${recoloring ? "opacity-60" : ""}`}
          style={{ background: color }}
        >
          <span className="text-xs font-bold uppercase text-white">{initials(name || client.name)}</span>
        </button>
        <span className="min-w-0 flex-1">
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            aria-label="Client name"
            className="-mx-1.5 block w-full rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-base font-bold text-ink outline-none hover:border-slate-200 focus:border-ink"
          />
          {showAccounts && (
            <span className="block text-xs text-slate-500">
              {channels.length ? `${channels.length} account${channels.length === 1 ? "" : "s"} · ${networks.map(([id]) => platformInfo(id).label).join(", ")}` : "No Buffer accounts"}
            </span>
          )}
        </span>
        {dirty && (
          <button disabled={pending} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-ink px-3 text-xs font-semibold text-white disabled:opacity-40">
            <Check className="size-3.5" /> Save
          </button>
        )}
        <button
          formAction={async (fd) => {
            if (confirm(`Remove ${client.name}? Their posts stay on the calendar as unassigned.`)) await deleteClient(fd);
          }}
          formNoValidate
          aria-label={`Remove ${client.name}`}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-red-50 hover:text-decline"
        >
          <Trash2 className="size-4" />
        </button>
      </form>
      {picking && <Swatches value={color} onPick={recolor} className="border-t border-slate-100 px-3 py-2.5 sm:px-4" />}
      {state?.error && <p className="px-4 pb-3 text-sm text-red-700">{state.error}</p>}
      {showAccounts && channels.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-3 pb-3 sm:px-4">
          <Networks channels={channels} clients={clients} />
        </div>
      )}
    </section>
  );
}

function Networks({ channels, clients }: { channels: SettingsChannel[]; clients: CalClient[] }) {
  return (
    <div className="space-y-3 pt-3">
      {byNetwork(channels).map(([id, list]) => (
        <div key={id}>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <PlatformIcon service={id} className="size-4" />
            {platformInfo(id).label}
            <span className="font-semibold text-slate-400">{list.length}</span>
          </p>
          <ul className="space-y-1.5">
            {list.map((ch) => (
              <li key={ch.id} className="flex items-center gap-3 rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/70">
                <ChannelAvatar avatar={ch.avatar} service={ch.service} name={ch.name} size="size-8" badge="size-3.5" dim={!!ch.removed_at} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{ch.name}</span>
                  {(ch.removed_at || ch.is_disconnected) && (
                    <span className="block text-xs font-semibold text-amber-700">{ch.removed_at ? "Removed from Buffer" : "Reconnect in Buffer"}</span>
                  )}
                </span>
                <ChannelSelect key={`${ch.id}-${ch.client_id ?? ""}`} channelId={ch.id} channelName={ch.name} value={ch.client_id ?? ""} clients={clients} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
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
  const assigned = !!current;
  return (
    <span className="flex shrink-0 flex-col items-end">
      <span className="relative">
        <select
          // Assigned accounts already sit under their client, so this is a "move" menu
          // that always shows its placeholder; unassigned ones pick a client.
          value=""
          disabled={saving}
          onChange={(e) => {
            const next = e.target.value === NONE ? "" : e.target.value;
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
          aria-label={assigned ? `Move ${channelName} to another client` : `Pick a client for ${channelName}`}
          className={`h-8 appearance-none truncate rounded-full border bg-white py-0 pl-3 pr-7 text-base font-semibold outline-none focus:border-ink disabled:opacity-60 sm:text-xs ${assigned ? "w-[5.75rem] border-slate-200 text-slate-500 hover:border-ink hover:text-ink sm:w-[4.75rem]" : "w-36 border-amber-300 text-amber-800 sm:w-32"}`}
        >
          <option value="" disabled>
            {saving ? "Saving…" : assigned ? "Move" : "Pick a client"}
          </option>
          {clients
            .filter((c) => c.id !== current)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {assigned ? `Move to ${c.name}` : c.name}
              </option>
            ))}
          {assigned && <option value={NONE}>Unassign</option>}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
      </span>
      {failed && <span className="mt-1 text-[11px] font-semibold text-decline">Didn&rsquo;t save. Try again.</span>}
    </span>
  );
}

const NONE = "__none";

function NewClient({ defaultColor }: { defaultColor: string }) {
  const [state, action, pending] = useActionState(saveClient, undefined);
  const [color, setColor] = useState(defaultColor);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 self-stretch rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 hover:border-ink hover:text-ink"
      >
        <Plus className="size-4" /> Add a client
      </button>
    );

  return (
    <form action={action} className="rounded-2xl border border-dashed border-slate-300 p-3 sm:px-4 lg:col-span-2">
      <input type="hidden" name="color" value={color} />
      <div className="flex items-center gap-2">
        <span className="size-9 shrink-0 rounded-full" style={{ background: color }} />
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
          autoFocus
          placeholder="Client name, e.g. Luigi's"
          className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-ink sm:text-sm"
        />
        <button disabled={pending || !name.trim()} className="h-10 shrink-0 rounded-full bg-ink px-4 text-sm font-semibold text-white disabled:opacity-30">
          Add
        </button>
      </div>
      <Swatches value={color} onPick={setColor} className="mt-2.5" />
      {state?.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

function Swatches({ value, onPick, className = "" }: { value: string; onPick: (c: string) => void; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="radiogroup" aria-label="Color">
      {SWATCHES.map((s) => (
        <button
          type="button"
          key={s}
          role="radio"
          aria-checked={s === value.toLowerCase()}
          onClick={() => onPick(s)}
          aria-label={`Color ${s}`}
          className={`size-8 rounded-full ring-offset-2 transition sm:size-7 ${s === value.toLowerCase() ? "ring-2 ring-ink" : "hover:scale-110"}`}
          style={{ background: s }}
        />
      ))}
    </div>
  );
}

function initials(name: string) {
  const words = name.replace(/[^a-z0-9 ]/gi, " ").trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2)) || "?";
}
