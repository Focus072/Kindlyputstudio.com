import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

/** Finishes Google sign-in and email confirmation, then returns to the room. */
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
  const back = new URL(next, origin);
  back.searchParams.set("auth_error", "1");
  return NextResponse.redirect(back);
}
