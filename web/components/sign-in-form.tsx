"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/browser";

export function SignInForm({ configured, devEnabled }: { configured: boolean; devEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [pending, setPending] = useState(false);

  async function sendLink(event: FormEvent) {
    event.preventDefault();
    if (!configured) {
      setStatus({ msg: "Supabase Auth is not configured yet. Add the keys in web/.env.local.", ok: false });
      return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${origin}/auth/callback/` },
      });
      if (error) throw error;
      setStatus({ msg: "Check that inbox for a sign-in link.", ok: true });
    } catch (error) {
      setStatus({ msg: error instanceof Error ? error.message : "Could not send the link.", ok: false });
    } finally {
      setPending(false);
    }
  }

  async function google() {
    if (!configured) {
      setStatus({ msg: "Supabase Auth is not configured yet.", ok: false });
      return;
    }
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback/` },
    });
    if (error) setStatus({ msg: error.message, ok: false });
  }

  return (
    <div className="stack-form">
      <form onSubmit={sendLink} className="stack-form">
        <label htmlFor="email">
          Email
          <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" maxLength={254} placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <button className="apply-btn" type="submit" disabled={pending}>
          Email me a sign-in link
        </button>
      </form>
      <button className="apply-btn" type="button" onClick={google}>
        Continue with Google
      </button>
      {devEnabled ? (
        <form method="post" action="/api/dev/member/">
          <button className="apply-btn" type="submit">
            Continue as test member
          </button>
          <p className="fine">Local only. Signs in as member@example.com without sending email.</p>
        </form>
      ) : null}
      {status ? (
        <p className={`status ${status.ok ? "ok" : "err"}`} role="status">
          {status.msg}
        </p>
      ) : null}
    </div>
  );
}
