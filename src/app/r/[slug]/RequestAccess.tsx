"use client";

import { Lock } from "lucide-react";
import { useState, useTransition } from "react";
import { themeVars } from "@/config/themes";
import type { StudioSettings } from "@/lib/settings";
import type { RoomRow } from "@/lib/types";
import { requestAccess } from "./actions";

type Props = {
  room: Pick<RoomRow, "slug" | "title" | "client_name" | "theme_preset" | "accent_color">;
  studio: Pick<StudioSettings, "name" | "markOnDark">;
  email: string | null;
  initialStatus: "pending" | "approved" | "denied" | null;
};

/** Shown to a signed-in client who is not on a guest-list room's list. */
export function RequestAccess({ room, studio, email, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div
      className="room-root flex min-h-dvh items-center justify-center bg-room-bg px-6 text-center text-room-fg"
      style={themeVars(room.theme_preset, room.accent_color)}
    >
      <div className="max-w-md">
        <img src={studio.markOnDark} alt={studio.name} className="mx-auto h-10 w-auto" />
        <span className="mx-auto mt-8 flex size-12 items-center justify-center rounded-full border border-room-border bg-white/5">
          <Lock className="size-5" />
        </span>
        <p className="mt-6 font-typewriter text-sm text-room-muted">Prepared for {room.client_name}</p>
        <h1 className="mt-3 font-display text-4xl uppercase sm:text-5xl">{room.title}</h1>
        <p className="mt-5 text-room-muted">
          This room is invite only, and {email ? <span className="text-room-fg">{email}</span> : "your account"} is not on the
          list yet. Ask {studio.name} to let you in.
        </p>
        {status === "pending" ? (
          <p className="mt-8 rounded-full border border-room-border px-5 py-3 text-sm font-semibold">
            Request sent. You will be able to open the room once {studio.name} approves it.
          </p>
        ) : status === "denied" ? (
          <p className="mt-8 text-sm text-room-muted">{studio.name} has not opened this room to your account.</p>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await requestAccess(room.slug).catch(() => ({ ok: false as const, error: "Connection lost. Please try again." }));
                if (res.ok) setStatus("pending");
                else setError(res.error);
              })
            }
            className="mt-8 inline-flex rounded-full bg-room-accent px-6 py-3.5 text-sm font-bold text-room-accent-fg disabled:opacity-50"
          >
            {pending ? "Sending…" : "Request access"}
          </button>
        )}
        {error && <p className="mt-3 text-sm text-decline">{error}</p>}
        <form action="/auth/signout" method="post" className="mt-8 text-xs text-room-muted">
          Wrong account?{" "}
          <button type="submit" className="underline underline-offset-4">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
