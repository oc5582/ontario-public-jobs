"use client";

import { useState, type FormEvent } from "react";

const ENDPOINT = "https://ontario-public-jobs-signup.publicjobs.workers.dev";

export function SignupForm() {
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim().toLowerCase();
    const consent = data.get("casl_consent") === "yes";
    const gotcha = String(data.get("_gotcha") || "").trim();
    if (gotcha) {
      setStatus({ msg: "You’re on the list. We’ll email new openings to this address.", ok: true });
      return;
    }
    if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !consent) {
      setStatus({ msg: "Enter your email and check the box to agree to job alert emails.", ok: false });
      return;
    }
    setPending(true);
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email, casl_consent: "yes", _gotcha: "" }),
        mode: "cors",
        credentials: "omit",
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || "fail");
      const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;
      if (body.ok === true && typeof fbq === "function") fbq("track", "Lead");
      setStatus({ msg: "You’re on the list. We’ll email new openings to this address.", ok: true });
      form.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setStatus({
        msg: message.toLowerCase().includes("agree") ? message : "Something went wrong. Please try again.",
        ok: false,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="signup signup-compact" aria-labelledby="signup-heading">
      <form id="signup-form" method="post" action={ENDPOINT} noValidate onSubmit={onSubmit}>
        <div className="signup-compact-row">
          <h2 id="signup-heading" className="signup-compact-heading">
            <span className="b2-desktop">Or get new openings by email</span>
            <span className="b2-phone">New openings by email</span>
          </h2>
          <div className="signup-compact-fields">
            <label id="email-label" htmlFor="email" className="visually-hidden">
              Email
            </label>
            <input type="email" id="email" name="email" required autoComplete="email" inputMode="email" maxLength={254} placeholder="you@example.com" />
            <button type="submit" id="submit-btn" disabled={pending}>
              <span className="b2-desktop">Email me new openings</span>
              <span className="b2-phone">Sign up</span>
            </button>
          </div>
        </div>
        <label className="checkbox signup-compact-consent" htmlFor="consent">
          <input type="checkbox" id="consent" name="casl_consent" value="yes" required />
          <span id="casl-label">I agree to receive job alert emails from PublicJobs.ca at this address. I can unsubscribe anytime.</span>
          <span className="b2-phone b2-consent">
            I agree to job alert emails from PublicJobs.ca. Unsubscribe anytime. <a href="/privacy/">Privacy</a>
          </span>
          <span className="signup-compact-links">
            <a href="/privacy/">Privacy</a> <a href="/terms/">Terms</a>
          </span>
        </label>
        <div className="hp" aria-hidden="true">
          <label htmlFor="gotcha">Leave this field blank</label>
          <input type="text" id="gotcha" name="_gotcha" tabIndex={-1} autoComplete="off" />
        </div>
        <div id="signup-status" className={status ? `status ${status.ok ? "ok" : "err"}` : "status"} role="status" aria-live="polite" hidden={!status}>
          {status?.msg}
        </div>
      </form>
    </section>
  );
}
