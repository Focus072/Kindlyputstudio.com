import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createRoom } from "@/app/admin/actions";
import { RoomForm } from "@/components/admin/RoomForm";
import { requireAdmin } from "@/lib/auth";
import { getStudioSettings } from "@/lib/settings";

export default async function NewRoomPage() {
  await requireAdmin();
  const studio = await getStudioSettings();
  return (
    <main className="max-w-3xl">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink max-sm:-my-2.5 max-sm:py-2.5">
        <ChevronLeft className="size-4" /> All rooms
      </Link>
      <h1 className="mt-1 font-display text-[2.375rem] uppercase leading-none text-ink sm:mt-2 sm:text-4xl sm:leading-normal">New room</h1>
      <p className="mt-1 text-sm text-slate-500">You will upload files on the next screen.</p>
      <div className="mt-5 rounded-3xl bg-white p-4 sm:mt-8 sm:p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <RoomForm
          action={createRoom}
          submitLabel="Create room"
          defaults={{ deliveredBy: studio.deliveredBy, theme: studio.defaultTheme }}
        />
      </div>
    </main>
  );
}
