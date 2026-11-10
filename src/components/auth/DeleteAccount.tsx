"use client";

import { useState, useTransition } from "react";
import { deleteMyAccount } from "@/app/account/actions";

/** Two-step "Delete my account" for clients. */
export function DeleteAccount() {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="text-sm text-mist/60 underline-offset-4 hover:text-white hover:underline">
        Delete my account
      </button>
    );
  }
  return (
    <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm font-semibold text-white">Delete your account?</p>
      <p className="mt-1.5 text-sm text-mist/70">
        This removes your login and your list of rooms. The studio keeps the files and any notes you left on them. You can
        always make a new account later.
      </p>
      {error && <p className="mt-3 text-sm text-decline">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await deleteMyAccount();
              if (res?.error) setError(res.error);
            })
          }
          className="rounded-full bg-decline px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Yes, delete it"}
        </button>
        <button type="button" onClick={() => setAsking(false)} className="rounded-full px-4 py-2.5 text-sm font-semibold text-mist/80 hover:text-white">
          Keep my account
        </button>
      </div>
    </div>
  );
}
