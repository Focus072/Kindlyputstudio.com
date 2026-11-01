"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="mt-8 space-y-3">
      <label className="block">
        <span className="sr-only">Username</span>
        <input
          type="text"
          name="username"
          required
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          placeholder="Username"
          className="w-full rounded-full border border-slate-200 bg-white px-5 py-3.5 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
        />
      </label>
      <label className="block">
        <span className="sr-only">Password</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          className="w-full rounded-full border border-slate-200 bg-white px-5 py-3.5 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
        />
      </label>
      {state?.error && <p className="px-2 text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-steel px-5 py-3.5 font-bold text-ink transition-opacity disabled:opacity-50"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
