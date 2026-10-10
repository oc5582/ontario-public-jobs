"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { localLoginAllowed, requestOrigin, safeNext, setLocalSession, supabaseConfigured } from "@/lib/auth";
import { googleSignInEnabled } from "@/lib/google-sign-in";
import { query } from "@/lib/db";
import { createClient } from "@/lib/supabase";

function emailOf(formData: FormData): string {
  return String(formData.get("email") || "").trim().toLowerCase();
}

export async function signInWithEmail(formData: FormData) {
  const email = emailOf(formData);
  const next = safeNext(String(formData.get("next") || ""), "/account/");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(`/login/?error=email&next=${encodeURIComponent(next)}`);
  }
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const origin = await requestOrigin();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback/?next=${encodeURIComponent(next)}`,
        shouldCreateUser: true,
      },
    });
    if (error) redirect(`/login/?error=send&next=${encodeURIComponent(next)}`);
    redirect(`/login/?sent=1&next=${encodeURIComponent(next)}`);
  }
  const h = await headers();
  if (!localLoginAllowed(h.get("host"))) {
    redirect(`/login/?error=config&next=${encodeURIComponent(next)}`);
  }
  const rows = await query<{ id: string }>(`select id from profiles where lower(email) = lower($1)`, [email]);
  if (!rows[0]) redirect(`/login/?error=local&next=${encodeURIComponent(next)}`);
  await setLocalSession(email);
  redirect(next);
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(String(formData.get("next") || ""), "/account/");
  if (!googleSignInEnabled() || !supabaseConfigured()) {
    redirect(`/login/?error=google&next=${encodeURIComponent(next)}`);
  }
  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback/?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/login/?error=google&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}
