import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { localLoginAllowed, supabaseConfigured } from "./auth";
import { AlreadySubscribedError } from "./billing";
import { query } from "./db";
import {
  CheckoutProfileError,
  isCheckoutEmail,
  normalizeCheckoutEmail,
  profileIsSubscribed,
  safeAppOrigin,
} from "./guest-checkout";
import { createClient } from "./supabase";

type ProfileRow = {
  id: string;
  email: string;
  membership_status: string;
  stripe_subscription_id: string | null;
};

async function profileByEmail(email: string): Promise<ProfileRow | null> {
  const rows = await query<ProfileRow>(
    `select id, email, membership_status, stripe_subscription_id
     from profiles where lower(email) = lower($1)`,
    [email],
  );
  return rows[0] || null;
}

function otpResult(error: { message?: string; code?: string } | null): "sent" | "rate" | "failed" {
  if (!error) return "sent";
  const msg = `${error.code || ""} ${error.message || ""}`;
  if (/over_email_send_rate_limit|rate limit/i.test(msg)) return "rate";
  return "failed";
}

async function deliverSignIn(email: string, origin: string): Promise<"sent" | "rate" | "failed"> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/callback/?next=${encodeURIComponent("/account/")}`,
    },
  });
  return otpResult(error);
}

/**
 * Emails a magic link. The link only signs in the browser that requested it,
 * because Supabase stores the PKCE verifier in that browser's cookie.
 * A webhook cannot set that cookie, so post-payment links are requested from
 * the return page (or from /login/ on any device).
 */
export async function sendMembershipSignIn(email: string, origin: string): Promise<"sent" | "rate" | "failed"> {
  const normalized = normalizeCheckoutEmail(email);
  if (!isCheckoutEmail(normalized) || !supabaseConfigured()) return "failed";
  const primary = safeAppOrigin(origin);
  const fallback = safeAppOrigin(process.env.NEXT_PUBLIC_SITE_URL, "https://publicjobs.ca");
  const first = await deliverSignIn(normalized, primary);
  if (first === "sent" || first === "rate" || primary === fallback) return first;
  const second = await deliverSignIn(normalized, fallback);
  return second === "failed" ? first : second;
}

export async function ensureCheckoutProfile(
  email: string,
  origin: string,
): Promise<{ id: string; email: string; signInSent: boolean }> {
  const existing = await profileByEmail(email);
  if (existing) {
    if (profileIsSubscribed(existing)) throw new AlreadySubscribedError();
    return { id: existing.id, email: existing.email, signInSent: false };
  }
  if (supabaseConfigured()) {
    const sent = await sendMembershipSignIn(email, origin);
    const created = await profileByEmail(email);
    if (!created) throw new CheckoutProfileError();
    if (profileIsSubscribed(created)) throw new AlreadySubscribedError();
    return { id: created.id, email: created.email, signInSent: sent === "sent" };
  }
  const h = await headers();
  if (!localLoginAllowed(h.get("host"))) throw new CheckoutProfileError();
  const rows = await query<{ id: string; email: string }>(
    `insert into profiles (id, email)
     values ($1, $2)
     on conflict (email) do update set updated_at = now()
     returning id, email`,
    [randomUUID(), email],
  );
  const row = rows[0];
  if (!row) throw new CheckoutProfileError();
  return { id: row.id, email: row.email, signInSent: false };
}
