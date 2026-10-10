import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { query } from "./db";
import type { Profile, Viewer } from "./types";

const COOKIE = "pj_local";
const MAX_AGE = 60 * 60 * 24 * 30;

type ProfileRow = {
  id: string;
  email: string;
  membership_status: Profile["membership_status"];
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string | null;
  current_period_end: string | null;
};

export function publishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && publishableKey());
}

export function localLoginAllowed(host: string | null): boolean {
  if (process.env.ALLOW_LOCAL_LOGIN !== "true") return false;
  const name = (host || "").split(":")[0];
  return name === "localhost" || name === "127.0.0.1";
}

export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

function memberActive(profile: Profile | null): boolean {
  if (!profile || profile.membership_status !== "active") return false;
  if (!profile.current_period_end) return true;
  return new Date(profile.current_period_end).getTime() > Date.now();
}

async function profileById(id: string): Promise<Profile | null> {
  const rows = await query<ProfileRow>(
    `select id, email, membership_status, stripe_customer_id, stripe_subscription_id, plan,
            current_period_end::text as current_period_end
     from profiles where id = $1`,
    [id],
  );
  return rows[0] || null;
}

async function profileByEmail(email: string): Promise<Profile | null> {
  const rows = await query<ProfileRow>(
    `select id, email, membership_status, stripe_customer_id, stripe_subscription_id, plan,
            current_period_end::text as current_period_end
     from profiles where lower(email) = lower($1)`,
    [email],
  );
  return rows[0] || null;
}

async function ensureProfile(id: string, email: string): Promise<Profile | null> {
  await query(
    `insert into profiles (id, email)
     values ($1, $2)
     on conflict (id) do update set email = excluded.email, updated_at = now()`,
    [id, email],
  );
  return profileById(id);
}

function signLocal(email: string, exp: number): string {
  const secret = process.env.AUTH_SECRET || "";
  const body = `${email}|${exp}`;
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}|${sig}`;
}

function readSigned(token: string): string | null {
  const secret = process.env.AUTH_SECRET || "";
  if (!secret) return null;
  const parts = token.split("|");
  if (parts.length !== 3) return null;
  const [email, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!email || !Number.isFinite(exp) || exp < Date.now() / 1000) return null;
  const expected = createHmac("sha256", secret).update(`${email}|${expRaw}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return email;
}

export async function setLocalSession(email: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const store = await cookies();
  store.set(COOKIE, signLocal(email, exp), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function safeNext(value: string | null | undefined, fallback = "/account/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

export async function clearLocalSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getViewer(): Promise<Viewer> {
  if (supabaseConfigured()) {
    const { createClient } = await import("./supabase");
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (user?.id && user.email) {
      const profile = await ensureProfile(user.id, user.email);
      return { email: user.email, profile, isMember: memberActive(profile) };
    }
  }
  const h = await headers();
  if (localLoginAllowed(h.get("host"))) {
    const store = await cookies();
    const email = readSigned(store.get(COOKIE)?.value || "");
    if (email) {
      const profile = await profileByEmail(email);
      if (profile) return { email: profile.email, profile, isMember: memberActive(profile) };
    }
  }
  return { email: null, profile: null, isMember: false };
}
