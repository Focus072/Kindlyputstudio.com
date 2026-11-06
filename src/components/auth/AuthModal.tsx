"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
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
  /** "1": a sign-in link failed. "confirmed": the email is confirmed, sign in with password. */
  initialError?: "1" | "confirmed" | "reset" | null;
  /** Shows a "Back to home" link, for pages a client can reach without a room link. */
  homeHref?: string;
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

export function AuthModal({
  supabaseUrl,
  supabaseKey,
  next,
  heading,
  subheading,
  brandMark,
  initialError,
  homeHref,
}: Props) {
  const confirmed = initialError === "confirmed";
  const [mode, setMode] = useState<"signup" | "signin" | "forgot">(
    confirmed || initialError === "reset" ? "signin" : "signup",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(
    initialError === "1"
      ? "That sign-in link did not work. Please try again."
      : initialError === "reset"
        ? "That reset link has expired or was opened in a different browser. Tap Forgot password for a new one, then open it on this device."
        : null,
  );
  const [notice, setNotice] = useState<string | null>(
    confirmed ? "Your email is confirmed. Sign in with your email and password to open your room." : null,
  );
  const [checkEmail, setCheckEmail] = useState<"confirm" | "reset" | null>(null);
  const [resent, setResent] = useState<"idle" | "sending" | "sent">("idle");

  const supabase = () => supabaseBrowser(supabaseUrl, supabaseKey);
  const callback = (flow?: "email" | "recovery", to = next) =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(to)}${flow ? `&flow=${flow}` : ""}`;

  async function resend() {
    setResent("sending");
    const { error } = await supabase().auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: callback("email") },
    });
    setResent(error ? "idle" : "sent");
    if (error) setError(/rate limit|security purposes/i.test(error.message) ? "Please wait a minute before asking again." : error.message);
  }

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
    setNotice(null);
    setBusy("email");
    const client = supabase();
    if (mode === "forgot") {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: callback("recovery", `/account/password?next=${encodeURIComponent(next)}`),
      });
      setBusy(null);
      if (error) {
        return setError(
          /rate limit|security purposes/i.test(error.message) ? "Please wait a minute before asking again." : error.message,
        );
      }
      return setCheckEmail("reset");
    }
    if (mode === "signup") {
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() }, emailRedirectTo: callback("email") },
      });
      setBusy(null);
      if (error) return setError(error.message);
      if (data.session) return window.location.reload();
      if (data.user && data.user.identities?.length === 0) {
        setMode("signin");
        return setError("You already have an account with this email. Please sign in.");
      }
      setCheckEmail("confirm");
    } else {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(null);
      if (error) {
        if (/Email not confirmed/i.test(error.message)) {
          // Show the "check your email" screen, which has a Resend button.
          setResent("idle");
          return setCheckEmail("confirm");
        }
        return setError("That email or password is not right.");
      }
      window.location.reload();
    }
  }

  const input =
    "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-base text-white outline-none placeholder:text-white/40 focus:border-white/40";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md sm:items-center">
      {homeHref && (
        <Link
          href={homeHref}
          className="absolute left-3 top-[calc(0.75rem+env(safe-area-inset-top))] inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-4 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/10 sm:left-6 sm:top-6"
        >
          <ArrowLeft className="size-4" /> Back to home
        </Link>
      )}
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
            {checkEmail === "confirm" ? (
              <p className="mt-2 text-sm text-mist/80">
                We sent a confirmation link to <span className="font-semibold text-white">{email}</span>. Tap it and
                you will land right back in your room. It can take a minute, and sometimes lands in spam.
              </p>
            ) : (
              <p className="mt-2 text-sm text-mist/80">
                If <span className="font-semibold text-white">{email}</span> has an account, a link to set a new
                password is on its way. Open it on this device.
              </p>
            )}
            {error && <p className="mt-3 text-sm text-decline">{error}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-semibold">
              {checkEmail === "confirm" && (
                <button
                  type="button"
                  onClick={resend}
                  disabled={resent !== "idle"}
                  className="text-white underline-offset-4 hover:underline disabled:no-underline disabled:opacity-60"
                >
                  {resent === "sent" ? "Sent again" : resent === "sending" ? "Sending…" : "Resend email"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCheckEmail(null);
                  setError(null);
                  setMode("signin");
                }}
                className="text-steel underline-offset-4 hover:underline"
              >
                {checkEmail === "confirm" ? "Already confirmed? Sign in" : "Back to sign in"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 id="auth-heading" className="mt-5 font-display text-4xl uppercase leading-none">
              {mode === "signup" ? heading : mode === "forgot" ? "Reset password" : "Welcome back"}
            </h2>
            <p className="mt-2 text-sm text-mist/80">
              {mode === "signup"
                ? subheading
                : mode === "forgot"
                  ? "Enter the email on your account and we will send you a link to set a new password."
                  : "Sign in to open your rooms."}
            </p>
            {notice && (
              <p role="status" className="mt-4 flex items-start gap-2 rounded-2xl bg-approve/15 px-4 py-3 text-sm text-white">
                <MailCheck className="mt-0.5 size-4 shrink-0 text-approve" />
                {notice}
              </p>
            )}

            {mode !== "forgot" && (
              <>
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
              </>
            )}

            <form onSubmit={submit} className={`space-y-3 ${mode === "forgot" ? "mt-6" : ""}`}>
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
              {mode !== "forgot" && (
                <input
                  required
                  type="password"
                  minLength={mode === "signup" ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className={input}
                />
              )}
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setNotice(null);
                    setMode("forgot");
                  }}
                  className="block px-1 text-sm text-white/60 underline-offset-4 hover:text-white hover:underline max-sm:-my-1.5 max-sm:py-1.5"
                >
                  Forgot password?
                </button>
              )}
              {error && <p className="text-sm text-decline">{error}</p>}
              <button
                type="submit"
                disabled={busy !== null}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-steel px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-ink transition-opacity disabled:opacity-60"
              >
                {busy === "email" && <Loader2 className="size-4 animate-spin" />}
                {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-white/60">
              {mode === "signup" ? "Already have an account?" : mode === "forgot" ? "Remembered it?" : "New here?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setMode(mode === "signin" ? "signup" : "signin");
                }}
                className="font-semibold text-steel underline-offset-4 hover:underline max-sm:-my-2.5 max-sm:py-2.5"
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
