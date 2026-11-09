import Link from "next/link";
import { createRoom } from "@/app/admin/actions";
import { RoomForm } from "@/components/admin/RoomForm";
import { requireAdmin } from "@/lib/auth";
import { getStudioSettings } from "@/lib/settings";

export const metadata = { title: "New room" };

export default async function NewRoomPage() {
  await requireAdmin();
  const studio = await getStudioSettings();
  return (
    <main className="max-w-3xl">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-ink max-sm:-my-2.5 max-sm:inline-block max-sm:py-2.5">← All rooms</Link>
      <h1 className="mt-2 font-display text-4xl uppercase text-ink">New room</h1>
      <p className="mt-1 text-sm text-slate-600">Create a private draft, then upload files, review access, and publish the room when it is ready.</p>
      <div className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <RoomForm
          action={createRoom}
          submitLabel="Create draft"
          defaults={{ deliveredBy: studio.deliveredBy, theme: studio.defaultTheme }}
        />
      </div>
    </main>
  );
}
