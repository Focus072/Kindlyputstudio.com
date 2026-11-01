import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLIC_FALLBACK } from "@/config/supabase-public";

/** Keeps client sign-in sessions fresh on room and account pages. */
export async function proxy(request: NextRequest) {
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
