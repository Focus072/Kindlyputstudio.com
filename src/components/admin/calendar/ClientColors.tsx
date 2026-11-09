"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ArrowRightLeft, Check, ChevronDown, ExternalLink, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
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

const BUFFER_CHANNELS = "https://publish.buffer.com/settings/channels";

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
 * One full-width card per client. Inside, each network gets its own column
 * (Instagram | Facebook | Google Business), so accounts never mix. Accounts
 * Buffer no longer has are tucked away at the bottom.
 */
export function ClientAccounts({ clients, channels, showAccounts }: { clients: CalClient[]; channels: SettingsChannel[]; showAccounts: boolean }) {
  const live = channels.filter((c) => !c.removed_at);
  const removed = channels.filter((c) => c.removed_at);
  const known = new Set(clients.map((c) => c.id));
  const unassigned = live.filter((c) => !c.client_id || !known.has(c.client_id));
  const used = new Set(clients.map((c) => c.color.toLowerCase()));
  const next = SWATCHES.find((s) => !used.has(s)) ?? SWATCHES[clients.length % SWATCHES.length];
  const reconnect = live.filter((c) => c.is_disconnected).length;

  return (
    <div className="mt-5 space-y-4">
      {showAccounts && reconnect > 0 && (
        <a
          href={BUFFER_CHANNELS}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 hover:ring-amber-300"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-200/70 text-xs font-bold">{reconnect}</span>
          <span className="min-w-0 flex-1">
            <b className="font-semibold">{reconnect === 1 ? "1 account needs" : `${reconnect} accounts need`} reconnecting in Buffer.</b> Posts to {reconnect === 1 ? "it" : "them"} won&rsquo;t go out until then.
          </span>
          <ExternalLink className="size-4 shrink-0" />
        </a>
      )}

      {showAccounts && unassigned.length > 0 && (
        <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-4">
          <h3 className="text-sm font-bold text-ink">Not matched to a client</h3>
          <p className="text-xs text-slate-500">Use the button on each account to pick who it belongs to.</p>
          <NetworkColumns channels={unassigned} clients={clients} />
        </section>
      )}

      {clients.map((c) => (
        <ClientCard
          key={`${c.id}-${c.color}-${c.name}`}
          client={c}
          clients={clients}
          channels={live.filter((ch) => ch.client_id === c.id)}
          showAccounts={showAccounts}
        />
      ))}

      <NewClient key={`new-${clients.length}`} defaultColor={next} />

      {showAccounts && removed.length > 0 && (
        <details className="group rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-500 [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-4 -rotate-90 transition group-open:rotate-0" />
            No longer in Buffer
            <span className="rounded-full bg-slate-200 px-2 text-xs">{removed.length}</span>
          </summary>
          <p className="mt-2 text-xs text-slate-500">
            Buffer stopped listing these accounts, so they can&rsquo;t be posted to. Their old posts keep their client. Reconnect one in Buffer and it comes back here on its own.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {removed.map((ch) => (
              <li key={ch.id} className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                <ChannelAvatar avatar={ch.avatar} service={ch.service} name={ch.name} size="size-7" badge="size-3" dim />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-500">{ch.name}</span>
                  <span className="block truncate text-[11px] text-slate-400">
                    {platformInfo(ch.service).label}
                    {ch.client_id && known.has(ch.client_id) ? ` · ${clients.find((c) => c.id === ch.client_id)?.name}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ClientCard({ client, clients, channels, showAccounts }: { client: CalClient; clients: CalClient[]; channels: SettingsChannel[]; showAccounts: boolean }) {
  const [state, action, pending] = useActionState(saveClient, undefined);
  const [name, setName] = useState(client.name);
  const [color, setColor] = useState(client.color);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [recoloring, startRecolor] = useTransition();
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
    <section className="rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="flex items-center gap-3 rounded-t-2xl px-4 py-3 last:rounded-b-2xl" style={{ boxShadow: `inset 4px 0 0 ${color}` }}>
        <button
          type="button"
          onClick={() => setPicking(!picking)}
          aria-label={`Change ${client.name}'s color`}
          aria-expanded={picking}
          title="Change color"
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ring-1 ring-black/5 transition hover:ring-4 hover:ring-black/5 ${recoloring ? "opacity-60" : ""}`}
          style={{ background: color }}
        >
          <span className="text-xs font-bold uppercase text-white">{initials(name || client.name)}</span>
        </button>

        {editing ? (
          <form action={action} className="flex min-w-0 flex-1 items-center gap-2">
            <input type="hidden" name="id" value={client.id} />
            <input type="hidden" name="color" value={color} />
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
              autoFocus
              aria-label="Client name"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setName(client.name);
                  setEditing(false);
                }
              }}
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-base font-semibold text-ink outline-none focus:border-ink sm:text-sm"
            />
            <button disabled={pending || !name.trim()} aria-label="Save name" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-white disabled:opacity-40">
              <Check className="size-4" />
            </button>
            <IconButton
              label="Cancel"
              onClick={() => {
                setName(client.name);
                setEditing(false);
              }}
            >
              <X className="size-4" />
            </IconButton>
          </form>
        ) : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-bold text-ink">{client.name}</span>
              {showAccounts && (
                <span className="block truncate text-xs text-slate-500">
                  {channels.length ? `${channels.length} account${channels.length === 1 ? "" : "s"}` : "No Buffer accounts yet"}
                </span>
              )}
            </span>
            {showAccounts && networks.length > 0 && (
              <span className="hidden items-center -space-x-1 sm:flex" aria-hidden>
                {networks.map(([id]) => (
                  <PlatformIcon key={id} service={id} badge className="size-6" />
                ))}
              </span>
            )}
            <IconButton label={`Rename ${client.name}`} onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
            </IconButton>
            <form
              action={async (fd) => {
                if (confirm(`Remove ${client.name}? Their accounts and posts stay, just without a client.`)) await deleteClient(fd);
              }}
            >
              <input type="hidden" name="id" value={client.id} />
              <IconButton label={`Remove ${client.name}`} submit danger>
                <Trash2 className="size-4" />
              </IconButton>
            </form>
          </>
        )}
      </div>
      {picking && <Swatches value={color} onPick={recolor} className="border-t border-slate-100 px-4 py-3" />}
      {state?.error && <p className="px-4 pb-3 text-sm text-red-700">{state.error}</p>}
      {showAccounts && channels.length > 0 && (
        <div className="rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-4 pb-4">
          <NetworkColumns channels={channels} clients={clients} />
        </div>
      )}
    </section>
  );
}

function IconButton({ label, onClick, submit, danger, children }: { label: string; onClick?: () => void; submit?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type={submit ? "submit" : "button"}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition ${danger ? "hover:bg-red-50 hover:text-decline" : "hover:bg-slate-100 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

/** Instagram | Facebook | Google Business side by side; stacked on phones. */
function NetworkColumns({ channels, clients }: { channels: SettingsChannel[]; clients: CalClient[] }) {
  const groups = byNetwork(channels);
  const cols = groups.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : groups.length === 2 ? "sm:grid-cols-2" : "";
  return (
    <div className={`grid gap-4 pt-3 ${cols}`}>
      {groups.map(([id, list]) => (
        <div key={id} className="min-w-0">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <PlatformIcon service={id} className="size-4" />
            {platformInfo(id).label}
            <span className="text-slate-400">{list.length}</span>
          </p>
          <ul className={groups.length === 1 ? "grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3" : "space-y-1.5"}>
            {list.map((ch) => (
              <AccountRow key={`${ch.id}-${ch.client_id ?? ""}`} channel={ch} clients={clients} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AccountRow({ channel: ch, clients }: { channel: SettingsChannel; clients: CalClient[] }) {
  const [current, setCurrent] = useState(ch.client_id ?? "");
  const [failed, setFailed] = useState(false);
  const [saving, start] = useTransition();

  function move(to: string) {
    const before = current;
    setCurrent(to);
    setFailed(false);
    const fd = new FormData();
    fd.set("channel_id", ch.id);
    fd.set("client_id", to);
    start(async () => {
      const r = await assignChannel(fd);
      if (r.error) {
        setCurrent(before);
        setFailed(true);
      }
    });
  }

  return (
    <li className={`flex items-center gap-2.5 rounded-xl bg-white py-2 pl-2.5 pr-1 ring-1 ring-slate-200/80 ${saving ? "opacity-60" : ""}`}>
      <ChannelAvatar avatar={ch.avatar} service={ch.service} name={ch.name} size="size-8" badge="size-3.5" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{ch.name}</span>
        {failed ? (
          <span className="block text-[11px] font-semibold text-decline">Didn&rsquo;t save. Try again.</span>
        ) : ch.is_disconnected ? (
          <a href={BUFFER_CHANNELS} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline">
            Reconnect in Buffer <ExternalLink className="size-3" />
          </a>
        ) : null}
      </span>
      <MoveMenu name={ch.name} current={current} clients={clients} onMove={move} />
    </li>
  );
}

/** A small menu instead of a native select, so it reads cleanly at any width. */
function MoveMenu({ name, current, clients, onMove }: { name: string; current: string; clients: CalClient[]; onMove: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const others = clients.filter((c) => c.id !== current);
  const assigned = !!current;
  const pick = (id: string) => {
    setOpen(false);
    onMove(id);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      {assigned ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={`Move ${name} to another client`}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Move to another client"
          className="flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-ink"
        >
          <MoreHorizontal className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="mr-1 inline-flex h-8 items-center gap-1 rounded-full bg-ink px-3 text-xs font-semibold text-white hover:bg-slate-brand"
        >
          Pick client <ChevronDown className="size-3.5" />
        </button>
      )}
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
          {assigned && <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Move to</p>}
          {others.map((c) => (
            <button key={c.id} role="menuitem" type="button" onClick={() => pick(c.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-slate-50">
              <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
          {assigned && (
            <button
              role="menuitem"
              type="button"
              onClick={() => pick("")}
              className="mt-1 flex w-full items-center gap-2.5 border-t border-slate-100 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
            >
              <ArrowRightLeft className="size-3 shrink-0" /> No client
            </button>
          )}
        </div>
      )}
    </div>
  );
}

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
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 hover:border-ink hover:text-ink"
      >
        <Plus className="size-4" /> Add a client
      </button>
    );

  return (
    <form action={action} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <input type="hidden" name="color" value={color} />
      <div className="flex items-center gap-3">
        <span className="size-10 shrink-0 rounded-full" style={{ background: color }} />
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
        <button disabled={pending || !name.trim()} className="h-10 shrink-0 rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-30">
          Add
        </button>
        <IconButton label="Cancel" onClick={() => setOpen(false)}>
          <X className="size-4" />
        </IconButton>
      </div>
      <Swatches value={color} onPick={setColor} className="mt-3 sm:pl-[3.25rem]" />
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
