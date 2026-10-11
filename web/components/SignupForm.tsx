"use client";

import { SIGNUP_ENDPOINT } from "@/lib/site";
import { weeklyAlertPayload } from "@/lib/weekly-alert";
import { type FormEvent, useState } from "react";

const SUCCESS = "You’re on the list. We’ll email new openings to this address.";
const ERROR = "Something went wrong. Please try again.";
const VALIDATION = "Enter your email and check the box to agree to job alert emails.";

function isEmail(value: string): boolean {
  if (value.length < 3 || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function SignupForm({ consent, sender }: { consent: string; sender: string }) {
  const [status, setStatus] = useState<{ message: string; ok: boolean } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") || "");
    const agreed = data.get("casl_consent") === "yes";
    const gotcha = String(data.get("_gotcha") || "");

    if (gotcha.trim()) {
      setStatus({ message: SUCCESS, ok: true });
      return;
    }
    if (!isEmail(email.trim().toLowerCase()) || !agreed) {
      setStatus({ message: VALIDATION, ok: false });
      return;
    }

    const endpoint = SIGNUP_ENDPOINT.trim();
    if (!endpoint) {
      setStatus({ message: "Email alerts are not turned on yet. Please try again later.", ok: false });
      return;
    }

    const payload = weeklyAlertPayload(email);
    setPending(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        mode: "cors",
        credentials: "omit",
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || "fail");
      const fbq = (window as Window & { fbq?: (command: string, name: string) => void }).fbq;
      if (body.ok === true && typeof fbq === "function") fbq("track", "Lead");
      setStatus({ message: SUCCESS, ok: true });
      const label = form.querySelector("#casl-label");
      const consentText = label?.textContent || "";
      fetch("/api/alerts/consent/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: payload.email,
          page_url: window.location.href,
          consent_text: consentText,
        }),
      }).catch(() => {});
      form.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setStatus({ message: message.includes("agree") ? message : ERROR, ok: false });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="signup signup-compact" aria-labelledby="signup-heading">
      <form id="signup-form" method="post" action={SIGNUP_ENDPOINT} noValidate onSubmit={onSubmit}>
        <div className="signup-compact-row">
          <h2 id="signup-heading" className="signup-compact-heading">
            <span className="b2-desktop">Or get new openings by email</span>
            <span className="b2-phone">New openings by email</span>
          </h2>
          <div className="signup-compact-fields">
            <label id="email-label" htmlFor="email" className="visually-hidden">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              placeholder="you@example.com"
            />
            <button type="submit" id="submit-btn" disabled={pending}>
              <span className="b2-desktop">Email me new openings</span>
              <span className="b2-phone">Sign up</span>
            </button>
          </div>
        </div>
        <label className="checkbox signup-compact-consent" htmlFor="consent">
          <input type="checkbox" id="consent" name="casl_consent" value="yes" required />
          <span id="casl-label">
            {consent}
            <span className="consent-sender">{sender}</span>
          </span>
          <span className="b2-phone b2-consent">
            {consent} <a href="/privacy/">Privacy</a>
            <span className="consent-sender">{sender}</span>
          </span>
          <span className="signup-compact-links">
            <a href="/privacy/">Privacy</a> <a href="/terms/">Terms</a>
          </span>
        </label>
        <div className="hp" aria-hidden="true">
          <label htmlFor="gotcha">Leave this field blank</label>
          <input type="text" id="gotcha" name="_gotcha" tabIndex={-1} autoComplete="off" />
        </div>
        <div
          id="signup-status"
          className={status ? `status ${status.ok ? "ok" : "err"}` : "status"}
          role="status"
          aria-live="polite"
          hidden={status == null}
        >
          {status?.message || ""}
        </div>
      </form>
    </section>
  );
}
