"use client";

import { useTransition } from "react";
import { deleteRoom } from "@/app/admin/actions";

export function DeleteRoomButton({ roomId, title }: { roomId: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`Delete "${title}" and all of its files? This cannot be undone.`)) {
          start(() => deleteRoom(roomId));
        }
      }}
      className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete room"}
    </button>
  );
}
