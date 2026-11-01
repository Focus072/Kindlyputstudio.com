import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

/** Finishes Google sign-in, email confirmation, and password reset links, then returns to the room. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const supabase = await supabaseForRequest();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "email" | "recovery" | "magiclink" | "invite",
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  // A password reset link that could not be used (expired, or opened in another
  // browser than the one that asked for it): start over from the sign-in screen.
  if (searchParams.get("flow") === "recovery" || type === "recovery") {
    return NextResponse.redirect(`${origin}/account?auth_error=reset`);
  }
  const back = new URL(next, origin);
  // Email links are often opened in a different browser or app (Gmail, Messages)
  // than the one used to sign up, so the code cannot be exchanged there. Supabase
  // has already confirmed the address by this point, so ask the client to sign in
  // with their password instead of showing a generic error.
  const fromEmail = searchParams.get("flow") === "email" || Boolean(tokenHash);
  back.searchParams.set("auth_error", fromEmail ? "confirmed" : "1");
  return NextResponse.redirect(back);
}
