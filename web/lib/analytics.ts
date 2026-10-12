import { waitUntil } from "@vercel/functions";
import { track } from "@vercel/analytics/server";
import { query } from "./db";

type AnalyticsProperties = Record<string, string>;

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 160) : "failed";
}

async function requestHeaders(): Promise<Headers | undefined> {
  try {
    const { headers } = await import("next/headers");
    return await headers();
  } catch {
    return undefined;
  }
}

async function deliver(name: string, properties: AnalyticsProperties | undefined, request?: Request): Promise<void> {
  try {
    const headerSource = request?.headers ?? (await requestHeaders());
    await track(name, properties, headerSource ? { headers: headerSource } : undefined);
  } catch (error) {
    console.error(JSON.stringify({ event: "analytics_track_failed", name, message: failureMessage(error) }));
  }
}

/** Send a custom event. Failures are logged and never thrown. The call is not awaited by the caller. */
export function reportEvent(name: string, properties?: AnalyticsProperties, request?: Request): void {
  const pending = deliver(name, properties, request);
  try {
    waitUntil(pending);
  } catch (error) {
    console.error(JSON.stringify({ event: "analytics_track_failed", name, message: failureMessage(error) }));
  }
}

export function signupMethod(user: {
  app_metadata?: { provider?: unknown } | null;
  identities?: { provider?: string }[] | null;
}): "email" | "google" {
  if (user.app_metadata?.provider === "google") return "google";
  if (user.app_metadata?.provider === "email") return "email";
  if (user.identities?.some((identity) => identity.provider === "google")) return "google";
  return "email";
}

type SignInUser = {
  created_at?: string | null;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  identities?: { created_at?: string | null }[] | null;
};

function withinMinute(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = Date.parse(left || "");
  const b = Date.parse(right || "");
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 60_000;
}

/**
 * True on the first successful sign-in. A magic link can be clicked long after
 * the account row is created, so confirmation time is checked as well as created_at.
 * A later sign-in moves last_sign_in_at and leaves those timestamps behind.
 */
export function isFirstSignIn(user: SignInUser, now = Date.now()): boolean {
  if (withinMinute(user.created_at, user.last_sign_in_at)) return true;
  if (withinMinute(user.email_confirmed_at || user.confirmed_at, user.last_sign_in_at)) return true;
  if (user.identities?.some((identity) => withinMinute(identity.created_at, user.last_sign_in_at))) return true;
  if (!user.last_sign_in_at && withinMinute(user.created_at, new Date(now).toISOString())) return true;
  return false;
}

/** Insert the profile when the auth trigger has not. False if the row is still missing. */
export async function ensureProfileRow(id: string, email: string): Promise<boolean> {
  try {
    await query(
      `insert into profiles (id, email)
       values ($1, $2)
       on conflict (id) do nothing`,
      [id, email],
    );
    const rows = await query<{ id: string }>(`select id from profiles where id = $1`, [id]);
    return rows.length > 0;
  } catch (error) {
    console.error(JSON.stringify({ event: "profile_create_failed", message: failureMessage(error) }));
    return false;
  }
}
