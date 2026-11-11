import { requireAdmin } from "@/lib/auth";
import { getStudioSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await getStudioSettings();
  return (
    <main className="max-w-3xl">
      <p className="font-typewriter text-sm text-slate-500 max-sm:hidden">Your studio</p>
      <h1 className="font-display text-[2.375rem] uppercase leading-none text-ink sm:text-5xl">Settings</h1>
      <p className="mt-2 text-sm text-slate-500">Name, logo, and defaults every room uses. Change them here instead of in code.</p>
      <div className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <SettingsForm settings={settings} />
      </div>
    </main>
  );
}
