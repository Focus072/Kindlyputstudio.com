import Link from "next/link";
import { createRoom } from "@/app/admin/actions";
import { RoomForm } from "@/components/admin/RoomForm";
import { requireAdmin } from "@/lib/auth";

export default async function NewRoomPage() {
  await requireAdmin();
  return (
    <main className="max-w-3xl">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-ink">← All rooms</Link>
      <h1 className="mt-2 font-display text-4xl uppercase text-ink">New room</h1>
      <p className="mt-1 text-sm text-slate-500">You will upload files on the next screen.</p>
      <div className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <RoomForm action={createRoom} submitLabel="Create room" />
      </div>
    </main>
  );
}
