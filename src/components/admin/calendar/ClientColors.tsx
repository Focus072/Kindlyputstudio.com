"use client";

import { useActionState, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { deleteClient, saveClient } from "@/app/admin/calendar/actions";
import { type CalClient, SWATCHES } from "@/lib/calendar";

export function ClientColors({ clients }: { clients: CalClient[] }) {
  const used = new Set(clients.map((c) => c.color.toLowerCase()));
  const next = SWATCHES.find((s) => !used.has(s)) ?? SWATCHES[clients.length % SWATCHES.length];

  return (
    <div className="mt-4 space-y-2">
      {clients.map((c) => (
        <ClientRow key={`${c.id}-${c.color}-${c.name}`} client={c} />
      ))}
      <ClientRow key={`new-${clients.length}`} defaultColor={next} />
    </div>
  );
}

function ClientRow({ client, defaultColor }: { client?: CalClient; defaultColor?: string }) {
  const [state, action, pending] = useActionState(saveClient, undefined);
  const [color, setColor] = useState(client?.color ?? defaultColor ?? SWATCHES[0]);
  const [name, setName] = useState(client?.name ?? "");
  const dirty = !client || color !== client.color || name !== client.name;

  return (
    <form action={action} className={`rounded-2xl p-2 ${client ? "ring-1 ring-slate-200" : "border border-dashed border-slate-300"}`}>
      {client && <input type="hidden" name="id" value={client.id} />}
      <input type="hidden" name="color" value={color} />
      <div className="flex items-center gap-2">
        <label className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-xl ring-1 ring-black/10" style={{ background: color }} title="Pick any color">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label="Color" />
        </label>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
          placeholder={client ? "" : "Add a client, e.g. Luigi's"}
          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-ink sm:text-sm"
        />
        <button
          disabled={pending || !dirty || !name.trim()}
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-ink px-4 text-sm font-semibold text-white disabled:opacity-30"
        >
          {client ? <Check className="size-4" /> : "Add"}
          <span className="sr-only">{client ? "Save" : ""}</span>
        </button>
        {client && (
          <button
            formAction={async (fd) => {
              if (confirm(`Remove ${client.name}? Their posts stay on the calendar as unassigned.`)) await deleteClient(fd);
            }}
            formNoValidate
            aria-label={`Remove ${client.name}`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-decline"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      {!client && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
          {SWATCHES.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setColor(s)}
              aria-label={`Use ${s}`}
              className={`size-6 rounded-full ring-offset-2 ${s === color ? "ring-2 ring-ink" : ""}`}
              style={{ background: s }}
            />
          ))}
        </div>
      )}
      {state?.error && <p className="mt-2 px-1 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
