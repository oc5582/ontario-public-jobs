/** Pure checks for guest membership checkout. No database or Stripe calls. */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export class CheckoutProfileError extends Error {
  readonly notice = "send" as const;

  constructor() {
    super("Could not open checkout for that email.");
    this.name = "CheckoutProfileError";
  }
}

export function normalizeCheckoutEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isCheckoutEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function profileIsSubscribed(profile: {
  stripe_subscription_id: string | null;
  membership_status: string;
}): boolean {
  return Boolean(
    profile.stripe_subscription_id &&
      (profile.membership_status === "active" || profile.membership_status === "past_due"),
  );
}

/** Statuses that already bill this Stripe customer. A second Checkout would charge them again. */
export function subscriptionBlocksNewCheckout(status: string): boolean {
  return status === "active" || status === "past_due" || status === "unpaid" || status === "trialing" || status === "paused";
}

export function isCheckoutSessionId(value: string): boolean {
  return /^cs_[A-Za-z0-9_]+$/.test(value);
}

function allowedSignInHost(host: string): boolean {
  if (host === "publicjobs.ca" || host === "www.publicjobs.ca") return true;
  if (LOCAL_HOSTS.has(host)) return true;
  const labels = host.split(".");
  // Preview hosts look like publicjobs-preview.vercel.app or
  // publicjobs-preview-git-<branch>-<team>.vercel.app.
  return labels.length === 3 && labels[1] === "vercel" && labels[2] === "app" && labels[0].startsWith("publicjobs");
}

/** Origin used in a magic-link redirect. Rejects hosts that are not this app. */
export function safeAppOrigin(value: string | null | undefined, fallback = "https://publicjobs.ca"): string {
  const backup = fallback.replace(/\/$/, "") || "https://publicjobs.ca";
  try {
    const url = new URL(value || "");
    const host = url.hostname.toLowerCase();
    const local = url.protocol === "http:" && LOCAL_HOSTS.has(host);
    if ((url.protocol === "https:" || local) && allowedSignInHost(host) && !url.username && !url.password) {
      return url.origin;
    }
  } catch {
    // Use the fallback below.
  }
  return backup;
}
