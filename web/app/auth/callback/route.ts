import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { safeNext } from "@/lib/auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"), "/account/");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login/?error=send", url.origin));
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
