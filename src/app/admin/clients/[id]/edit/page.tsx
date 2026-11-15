import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";
import { deleteClientProfile } from "@/app/admin/clients/actions";
import { ClientProfileForm } from "@/components/admin/clients/ClientProfileForm";
import { ConfirmButton } from "@/components/admin/clients/ConfirmButton";
import { requireAdmin } from "@/lib/auth";
import { getClientProfile, profilesReady } from "@/lib/client-profiles";

export default async function EditClientPage({ params }: PageProps<"/admin/clients/[id]/edit">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [client, ready] = await Promise.all([getClientProfile(id), profilesReady()]);
  if (!client) notFound();
  return (
    <main className="max-w-5xl">
      <Link href={`/admin/clients/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink max-sm:-my-2.5 max-sm:py-2.5">
        <ChevronLeft className="size-4" /> {client.name}
      </Link>
      <h1 className="mt-1 font-display text-[2.375rem] uppercase leading-none text-ink sm:mt-2 sm:text-5xl">Edit client</h1>
      {!ready && (
        <p className="mt-3 rounded-2xl bg-ochre-soft px-4 py-3 text-sm text-ochre">
          The client profile database update isn’t applied yet, so only the name and color will save.
        </p>
      )}
      <div className="mt-6">
        <ClientProfileForm client={client} />
      </div>
      <form action={deleteClientProfile} className="mt-6 flex justify-center sm:justify-end">
        <input type="hidden" name="id" value={client.id} />
        <ConfirmButton
          message={`Delete ${client.name}? Their profile, notes and calendar color go away. Rooms and Buffer posts stay.`}
          className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-clay hover:bg-clay-soft"
        >
          <Trash2 className="size-4" /> Delete client
        </ConfirmButton>
      </form>
    </main>
  );
}
