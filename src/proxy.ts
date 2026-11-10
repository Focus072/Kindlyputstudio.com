import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLIC_FALLBACK } from "@/config/supabase-public";

/** Keeps client sign-in sessions fresh on room and account pages. */
export async function proxy(request: NextRequest) {
  // Share links (/r/<slug>?key=...): keep the key in a cookie for that room and
  // drop it from the address bar, so it is not copied along with the URL.
  const shareKey = request.nextUrl.searchParams.get("key");
  const roomMatch = request.nextUrl.pathname.match(/^\/r\/([a-z0-9-]{1,120})\/?$/);
  if (shareKey && roomMatch && /^[A-Za-z0-9_-]{20,100}$/.test(shareKey)) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("key");
    const redirect = NextResponse.redirect(clean, 302);
    redirect.cookies.set(`kp_share_${roomMatch[1]}`, shareKey, {
      path: `/r/${roomMatch[1]}`,
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 180,
    });
    redirect.headers.set("Cache-Control", "no-store");
    return redirect;
  }

  let response = NextResponse.next({ request });
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || SUPABASE_PUBLIC_FALLBACK.url
  ).replace(/\/$/, "");
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    (url === SUPABASE_PUBLIC_FALLBACK.url ? SUPABASE_PUBLIC_FALLBACK.publishableKey : "");
  if (!key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/r/:path*", "/account/:path*", "/account"],
};
