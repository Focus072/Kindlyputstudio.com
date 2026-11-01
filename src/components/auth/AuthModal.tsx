"use client";

import { motion } from "framer-motion";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Props = {
  supabaseUrl: string;
  supabaseKey: string;
  /** Path to return to after sign-in, e.g. /r/adro-m4-k7x2pq */
  next: string;
  heading: string;
  subheading: string;
  brandMark: string;
  initialError?: boolean;
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function AuthModal({ supabaseUrl, supabaseKey, next, heading, subheading, brandMark, initialError }: Props) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(
    initialError ? "That sign-in link did not work. Please try again." : null,
  );
  const [checkEmail, setCheckEmail] = useState(false);

  const supabase = () => supabaseBrowser(supabaseUrl, supabaseKey);
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    setError(null);
    setBusy("google");
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback() },
    });
    if (error) {
      setBusy(null);
      setError(
        /provider is not enabled|Unsupported provider/i.test(error.message)
          ? "Google sign-in is not switched on yet. Please use email for now."
          : error.message,
      );
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("email");
    const client = supabase();
    if (mode === "signup") {
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() }, emailRedirectTo: callback() },
      });
      setBusy(null);
      if (error) return setError(error.message);
      if (data.session) return window.location.reload();
      if (data.user && data.user.identities?.length === 0) {
        setMode("signin");
        return setError("You already have an account with this email. Please sign in.");
      }
      setCheckEmail(true);
    } else {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(null);
      if (error) {
        return setError(
          /Email not confirmed/i.test(error.message)
            ? "Please confirm your email first. Check your inbox for our link."
            : "That email or password is not right.",
        );
      }
      window.location.reload();
    }
  }

  const input =
    "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-base text-white outline-none placeholder:text-white/40 focus:border-white/40";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-md sm:items-center">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-heading"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-[28px] border border-white/10 bg-ink p-6 text-cloud shadow-2xl sm:p-8"
      >
        <img src={brandMark} alt="Kindly Put Studio" className="h-10 w-auto" />

        {checkEmail ? (
          <div className="mt-6">
            <MailCheck className="size-8 text-steel" />
            <h2 id="auth-heading" className="mt-3 font-display text-3xl uppercase">Check your email</h2>
            <p className="mt-2 text-sm text-mist/80">
              We sent a confirmation link to <span className="font-semibold text-white">{email}</span>. Tap it and
              you will land right back in your room.
            </p>
            <button
              type="button"
              onClick={() => {
                setCheckEmail(false);
                setMode("signin");
              }}
              className="mt-6 text-sm font-semibold text-steel underline-offset-4 hover:underline"
            >
              Already confirmed? Sign in
            </button>
          </div>
        ) : (
          <>
            <h2 id="auth-heading" className="mt-5 font-display text-4xl uppercase leading-none">
              {mode === "signup" ? heading : "Welcome back"}
            </h2>
            <p className="mt-2 text-sm text-mist/80">
              {mode === "signup" ? subheading : "Sign in to open your rooms."}
            </p>

            <button
              type="button"
              onClick={google}
              disabled={busy !== null}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3.5 text-sm font-bold text-ink transition-opacity disabled:opacity-60"
            >
              {busy === "google" ? <Loader2 className="size-5 animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.25em] text-white/40">
              <span className="h-px flex-1 bg-white/10" />
              or with email
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                  maxLength={80}
                  className={input}
                />
              )}
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                className={input}
              />
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Create a password (8+ characters)" : "Password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className={input}
              />
              {error && <p className="text-sm text-decline">{error}</p>}
              <button
                type="submit"
                disabled={busy !== null}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-steel px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-ink transition-opacity disabled:opacity-60"
              >
                {busy === "email" && <Loader2 className="size-4 animate-spin" />}
                {mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-white/60">
              {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode(mode === "signup" ? "signin" : "signup");
                }}
                className="font-semibold text-steel underline-offset-4 hover:underline"
              >
                {mode === "signup" ? "Sign in" : "Create an account"}
              </button>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
