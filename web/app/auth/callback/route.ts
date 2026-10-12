import { NextResponse } from "next/server";
import { ensureProfileRow, isFirstSignIn, reportEvent, signupMethod } from "@/lib/analytics";
import { safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"), "/account/");
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login/?error=send", url.origin));
    }
    const user = data.user;
    if (user?.id && user.email && isFirstSignIn(user)) {
      try {
        const ready = await ensureProfileRow(user.id, user.email);
        if (ready) reportEvent("signup", { method: signupMethod(user) }, request);
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "analytics_track_failed",
            name: "signup",
            message: err instanceof Error ? err.message.slice(0, 160) : "failed",
          }),
        );
      }
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
