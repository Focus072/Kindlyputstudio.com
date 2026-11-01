import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await supabaseForRequest();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/account", request.url), 303);
}
