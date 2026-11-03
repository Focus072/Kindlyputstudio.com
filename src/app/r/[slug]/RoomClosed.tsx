import Link from "next/link";
import { themeVars } from "@/config/themes";
import type { StudioSettings } from "@/lib/settings";
import type { RoomRow } from "@/lib/types";

export function RoomClosed({ room, expired, studio }: { room: RoomRow; expired: boolean; studio: StudioSettings }) {
  return (
    <div
      className="room-root flex min-h-dvh items-center justify-center bg-room-bg px-6 text-center text-room-fg"
      style={themeVars(room.theme_preset, room.accent_color)}
    >
      <div className="max-w-md">
        <p className="font-typewriter text-sm text-room-muted">Prepared for {room.client_name}</p>
        <h1 className="mt-4 font-display text-5xl uppercase">{room.title}</h1>
        <p className="mt-6 text-room-muted">
          {expired
            ? "This delivery link has expired."
            : "This room is not open right now."}{" "}
          Reach out to {studio.name} and we will send you a fresh link.
        </p>
        <Link
          href={studio.contactEmail ? `mailto:${studio.contactEmail}` : "/#start"}
          className="mt-8 inline-flex rounded-full border border-current/20 px-5 py-2.5 text-sm font-semibold hover:opacity-80"
        >
          Contact {studio.name}
        </Link>
      </div>
    </div>
  );
}
