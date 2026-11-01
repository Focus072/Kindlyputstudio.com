"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { safeNext } from "@/lib/safe-next";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function NewPasswordForm({ supabaseUrl, supabaseKey, next }: { supabaseUrl: string; supabaseKey: string; next: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Those two passwords do not match.");
    setBusy(true);
    const { error } = await supabaseBrowser(supabaseUrl, supabaseKey).auth.updateUser({ password });
    if (error) {
      setBusy(false);
      return setError(
        /different from the old/i.test(error.message) ? "Please pick a password you have not used before." : error.message,
      );
    }
    window.location.assign(safeNext(next));
  }

  const input =
    "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-base text-white outline-none placeholder:text-white/40 focus:border-white/40";

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <input
        required
        type="password"
        minLength={8}
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (8+ characters)"
        autoComplete="new-password"
        className={input}
      />
      <input
        required
        type="password"
        minLength={8}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Type it again"
        autoComplete="new-password"
        className={input}
      />
      {error && <p className="text-sm text-decline">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-steel px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-ink transition-opacity disabled:opacity-60"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        Save and continue
      </button>
    </form>
  );
}
