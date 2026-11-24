/**
 * Job-alert signup endpoint.
 * A new address gets one confirmation email. The contact is added to the
 * Resend segment, and the welcome email is sent, only after the link is opened.
 * Someone already on the list is left as they are.
 * RESEND_API_KEY and ALERT_CONFIRM_SECRET are Worker secrets.
 */

export const SEGMENT_ID = "e749c971-4701-4a99-9448-c315ff27a47b";

export const CONSENT_TEXT =
  "I agree to receive job alert emails from PublicJobs.ca at this address. I can unsubscribe anytime.";

export const CONSENT_SOURCE = "https://publicjobs.ca/";

export const WELCOME_TEMPLATE_ID = "job-alerts-welcome";
export const WELCOME_FROM = "PublicJobs.ca <alerts@publicjobs.ca>";

const SITE_URL = CONSENT_SOURCE;
const ALLOWED_ORIGINS = new Set([
  "https://publicjobs.ca",
  "https://www.publicjobs.ca",
]);
const MAX_BODY = 10_000;
const SOFT_PAY = new Set(["yes", "maybe", "no"]);
const TEN_MINUTES = 10 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const RATE_MESSAGE = "Please wait a few minutes and try again.";
const TURNSTILE_MESSAGE = "The security check did not pass. Please try again.";
export const CONFIRM_TTL_SECONDS = 48 * 60 * 60;
const MAILING_FOOTER =
  "PublicJobs.ca, 603-65 Thorncliffe Park Drive, Toronto, Ontario M4H 1L2, Canada · hello@publicjobs.ca · (647) 917-3942 · Privacy policy: https://publicjobs.ca/privacy/";
const buckets = new Map();

export function clearSignupLimits() {
  buckets.clear();
}

function isInternal(request) {
  try {
    return new URL(request.url).hostname === "signup.internal";
  } catch {
    return false;
  }
}

function clientIp(request) {
  if (isInternal(request)) return "";
  return (request.headers.get("cf-connecting-ip") || "").trim().slice(0, 64);
}

function pruneBuckets(now) {
  if (buckets.size < 2000) return;
  for (const [key, times] of buckets) {
    const fresh = times.filter((t) => now - t < DAY);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
  if (buckets.size > 4000) buckets.clear();
}

function tooMany(key, limit, windowMs, now) {
  pruneBuckets(now);
  const fresh = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (fresh.length >= limit) {
    buckets.set(key, fresh);
    return true;
  }
  fresh.push(now);
  buckets.set(key, fresh);
  return false;
}

async function bindingBlocked(binding, key) {
  if (!binding || typeof binding.limit !== "function") return false;
  try {
    const result = await binding.limit({ key: String(key).slice(0, 128) });
    return !result || result.success === false;
  } catch (err) {
    console.error("signup rate limit failed", err && err.message ? err.message : "error");
    return false;
  }
}

async function publicLimited(request, env, email, now) {
  const ip = clientIp(request);
  if (!ip) return false;
  if (
    tooMany(`ip10:${ip}`, 5, TEN_MINUTES, now) ||
    tooMany(`ipday:${ip}`, 20, DAY, now) ||
    (await bindingBlocked(env && env.SIGNUP_IP_LIMIT, `ip:${ip}`))
  ) {
    return true;
  }
  if (!email) return false;
  if (
    tooMany(`email:${email}`, 3, HOUR, now) ||
    tooMany(`emailday:${email}`, 8, DAY, now) ||
    (await bindingBlocked(env && env.SIGNUP_EMAIL_LIMIT, `email:${email}`))
  ) {
    return true;
  }
  return false;
}

async function turnstilePasses(token, secret, ip) {
  const key = String(secret || "");
  if (!key) return true;
  const value = String(token || "").trim();
  if (!value || value.length > 2048) return false;
  const body = new URLSearchParams({ secret: key, response: value });
  if (ip) body.set("remoteip", ip);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await response.json();
    return Boolean(data && data.success);
  } catch (err) {
    console.error("turnstile failed", err && err.message ? err.message : "error");
    return false;
  }
}

function isEmail(value) {
  if (typeof value !== "string") return false;
  const email = value.trim();
  if (email.length < 3 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function originAllowed(origin) {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

function json(body, status, origin) {
  return withCors(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }),
    origin
  );
}

function htmlPage(origin, kind) {
  const pending = kind === "confirm";
  const heading = pending ? "Check your email" : "You're on the list.";
  const detail = pending
    ? "We sent a confirmation email. Open it and click Confirm my job alerts. We won't send job alerts until you do."
    : "We'll email new openings to this address.";
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PublicJobs.ca</title>
</head>
<body>
  <main>
    <h1>${heading}</h1>
    <p>${detail}</p>
    <p><a href="${SITE_URL}">Back to the job board</a></p>
  </main>
</body>
</html>`;
  return withCors(
    new Response(page, {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
    origin
  );
}

function withCors(response, origin) {
  const headers = new Headers(response.headers);
  if (originAllowed(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Accept");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return new Response(response.body, { status: response.status, headers });
}

function respond(request, origin, status, error, extra) {
  const accept = request.headers.get("accept") || "";
  const more = extra && typeof extra === "object" ? extra : {};
  if (accept.includes("application/json")) {
    if (status >= 400) return json({ ok: false, error, ...more }, status, origin);
    return json({ ok: true, ...more }, status, origin);
  }
  if (status >= 400) {
    return withCors(new Response(error, { status }), origin);
  }
  return htmlPage(origin, more.status);
}

async function readBody(request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) {
    return { error: "too_large" };
  }
  const type = (request.headers.get("content-type") || "").toLowerCase();
  if (type.includes("application/json")) {
    try {
      const data = JSON.parse(raw || "{}");
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { error: "invalid" };
      }
      return { data };
    } catch {
      return { error: "invalid" };
    }
  }
  if (
    type.includes("application/x-www-form-urlencoded") ||
    type.includes("multipart/form-data") ||
    raw.includes("=")
  ) {
    const params = new URLSearchParams(raw);
    const data = {};
    for (const [key, value] of params.entries()) data[key] = value;
    return { data };
  }
  return { error: "invalid" };
}

function consented(value) {
  return value === true || value === "yes" || value === "true" || value === "on";
}

function contactProperties(softPay, nowIso) {
  const properties = {
    casl_consent: "express",
    consent_text: CONSENT_TEXT,
    consent_source: CONSENT_SOURCE,
    consented_at: nowIso,
  };
  if (SOFT_PAY.has(softPay)) properties.soft_pay = softPay;
  return properties;
}

async function readError(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function isDuplicate(status, body) {
  if (status === 409) return true;
  const message = `${body.message || ""} ${body.name || ""}`;
  return /already exists/i.test(message);
}

async function saveContact(email, properties, env) {
  const headers = {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  };
  const created = await fetch("https://api.resend.com/contacts", {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      unsubscribed: false,
      properties,
      segments: [{ id: SEGMENT_ID }],
    }),
  });
  if (created.ok) return { ok: true };

  const errorBody = await readError(created);
  if (!isDuplicate(created.status, errorBody)) {
    return { ok: false, status: created.status };
  }

  const encoded = encodeURIComponent(email);
  const updated = await fetch(`https://api.resend.com/contacts/${encoded}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ unsubscribed: false, properties }),
  });
  if (!updated.ok) return { ok: false, status: updated.status };

  const added = await fetch(
    `https://api.resend.com/contacts/${encoded}/segments/${SEGMENT_ID}`,
    { method: "POST", headers: { Authorization: headers.Authorization } }
  );
  if (added.ok) return { ok: true };
  const addBody = await readError(added);
  if (isDuplicate(added.status, addBody)) return { ok: true };
  return { ok: false, status: added.status };
}

async function sendWelcome(email, env) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `welcome-email/${email}`,
      },
      body: JSON.stringify({
        from: WELCOME_FROM,
        to: [email],
        template: { id: WELCOME_TEMPLATE_ID },
      }),
    });
    if (!response.ok) {
      const body = await readError(response);
      console.error(
        "Welcome email failed",
        response.status,
        body.message || body.name || ""
      );
    }
  } catch (err) {
    console.error("Welcome email failed", err && err.message ? err.message : "error");
  }
}

function bytesToB64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlToBytes(value) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function confirmBody(email, at, pay, exp) {
  return JSON.stringify({ v: 1, email, at, pay: pay || "", exp });
}

async function hmacBytes(secret, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return new Uint8Array(signed);
}

export async function signAlertConfirm(email, at, pay, exp, secret) {
  const body = bytesToB64url(new TextEncoder().encode(confirmBody(email, at, pay, exp)));
  const sig = bytesToB64url(await hmacBytes(secret, body));
  return `${body}.${sig}`;
}

export async function readAlertConfirm(token, secret, nowMs) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !secret) return { ok: false, reason: "invalid" };
  let expected;
  try {
    expected = await hmacBytes(secret, parts[0]);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  let got;
  try {
    got = b64urlToBytes(parts[1]);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!sameBytes(expected, got)) return { ok: false, reason: "invalid" };
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const email = String((data && data.email) || "");
  const at = String((data && data.at) || "");
  const pay = String((data && data.pay) || "");
  const exp = Number(data && data.exp);
  if (!isEmail(email) || !at || !Number.isFinite(exp)) return { ok: false, reason: "invalid" };
  if (pay && !SOFT_PAY.has(pay)) return { ok: false, reason: "invalid" };
  if (exp * 1000 <= nowMs) return { ok: false, reason: "expired" };
  return { ok: true, email, at, pay, exp };
}

function confirmSecret(env) {
  return String((env && env.ALERT_CONFIRM_SECRET) || "");
}

export function confirmPageOrigin(env) {
  const raw = String((env && env.ALERT_CONFIRM_SITE_URL) || "https://publicjobs.ca").trim();
  try {
    const url = new URL(raw);
    const host = url.hostname;
    const httpsOk =
      url.protocol === "https:" &&
      (host === "publicjobs.ca" || host === "www.publicjobs.ca" || host.endsWith(".vercel.app"));
    const local = url.protocol === "http:" && (host === "localhost" || host === "127.0.0.1");
    if (httpsOk || local) return url.origin;
  } catch {
    // Fall through to the public site.
  }
  return "https://publicjobs.ca";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function authHeaders(env) {
  return {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function segmentListed(body) {
  const rows = []
    .concat((body && body.segments) || [])
    .concat((body && body.data) || [])
    .concat((body && body.segment_ids) || []);
  return rows.some((item) => {
    if (typeof item === "string") return item === SEGMENT_ID;
    return Boolean(item && (item.id === SEGMENT_ID || item.segment_id === SEGMENT_ID));
  });
}

async function lookupSubscriber(email, env) {
  const headers = authHeaders(env);
  const contact = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}`, { headers });
  if (contact.status === 404) return "no";
  const body = await readError(contact);
  if (!contact.ok) return "error";
  if (body.unsubscribed === true) return "no";
  const props = body.properties || {};
  if (props.casl_consent === "express") return "yes";
  if (segmentListed(body)) return "yes";
  if (!body.id) return "no";
  const segments = await fetch(`https://api.resend.com/contacts/${body.id}/segments`, { headers });
  if (segments.status === 404) return "no";
  const list = await readError(segments);
  if (!segments.ok) return "error";
  return segmentListed(list) ? "yes" : "no";
}

async function sendConfirm(email, at, pay, exp, env) {
  const token = await signAlertConfirm(email, at, pay, exp, confirmSecret(env));
  const link = `${confirmPageOrigin(env)}/alerts/confirm/?token=${encodeURIComponent(token)}`;
  const text = [
    "Confirm your PublicJobs.ca job alerts.",
    "",
    "Confirm my job alerts:",
    link,
    "",
    "We won't send job alerts until you open that link.",
    "",
    "The link expires in 48 hours. If you did not ask for this, you can ignore this email.",
    "",
    MAILING_FOOTER,
  ].join("\n");
  const html = `<!DOCTYPE html><html lang="en"><body style="font-family:Georgia,serif;color:#16202c;line-height:1.45">
<p>Confirm your PublicJobs.ca job alerts.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#16202c;color:#ffffff;padding:12px 18px;text-decoration:none">Confirm my job alerts</a></p>
<p>We won't send job alerts until you click the link. It expires in 48 hours. If you did not ask for this, you can ignore this email.</p>
<p style="color:#5c6b7a;font-size:14px">${escapeHtml(MAILING_FOOTER)}</p>
</body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      ...authHeaders(env),
      "Idempotency-Key": `alert-confirm/${email}/${exp}`,
    },
    body: JSON.stringify({
      from: WELCOME_FROM,
      to: [email],
      subject: "Confirm your PublicJobs.ca job alerts",
      text,
      html,
    }),
  });
  if (!response.ok) {
    const failure = await readError(response);
    console.error("Confirm email failed", response.status, failure.message || failure.name || "");
    return false;
  }
  return true;
}

function forwardedIp(request) {
  const raw = (request.headers.get("x-publicjobs-forwarded-for") || "").trim().slice(0, 64);
  if (/^[0-9a-fA-F:.]+$/.test(raw)) return raw;
  return clientIp(request);
}

async function handleConfirm(request, env, data, deps) {
  const origin = request.headers.get("origin") || "";
  const now = (deps.now || (() => new Date()))();
  const ip = forwardedIp(request);
  if (ip && tooMany(`confirm-ip:${ip}`, 30, HOUR, now.getTime())) {
    return respond(request, origin, 429, RATE_MESSAGE, { code: "limited" });
  }
  const secret = confirmSecret(env);
  if (!secret || !env || !env.RESEND_API_KEY) {
    console.error(secret ? "RESEND_API_KEY is not set" : "ALERT_CONFIRM_SECRET is not set");
    return respond(request, origin, 500, "Something went wrong. Please try again.", { code: "config" });
  }
  const read = await readAlertConfirm(data.confirm_token, secret, now.getTime());
  if (!read.ok) {
    return respond(request, origin, 400, "This confirmation link is not valid.", { code: read.reason });
  }
  if (tooMany(`confirm-email:${read.email}`, 10, HOUR, now.getTime())) {
    return respond(request, origin, 429, RATE_MESSAGE, { code: "limited" });
  }
  const existing = await lookupSubscriber(read.email, env);
  if (existing === "error") {
    return respond(request, origin, 502, "Something went wrong. Please try again.", { code: "error" });
  }
  if (existing === "no") {
    const saved = await saveContact(read.email, contactProperties(read.pay, read.at), env);
    if (!saved.ok) {
      console.error("Resend contact save failed", saved.status || "");
      return respond(request, origin, 502, "Something went wrong. Please try again.", { code: "error" });
    }
    await sendWelcome(read.email, env);
  }
  return respond(request, origin, 200, "", { status: "confirmed" });
}

export async function handleSignup(request, env, deps = {}) {
  const origin = request.headers.get("origin") || "";

  if (request.method === "OPTIONS") {
    if (!originAllowed(origin)) return new Response(null, { status: 403 });
    return withCors(new Response(null, { status: 204 }), origin);
  }

  if (request.method === "GET") {
    return withCors(
      new Response("PublicJobs.ca signup endpoint\n", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
      origin
    );
  }

  if (request.method !== "POST") {
    return respond(request, origin, 405, "Method not allowed");
  }

  const parsed = await readBody(request);
  if (parsed.error) {
    return respond(
      request,
      origin,
      400,
      "Enter your email and check the box to agree to job alert emails."
    );
  }

  const data = parsed.data;
  if (data.confirm_token) return handleConfirm(request, env, data, deps);

  if (!originAllowed(origin)) {
    return respond(request, origin, 403, "Origin not allowed");
  }

  const now = (deps.now || (() => new Date()))();
  const email = String(data.email || "").trim().toLowerCase();
  if (await publicLimited(request, env, isEmail(email) ? email : "", now.getTime())) {
    return respond(request, origin, 429, RATE_MESSAGE);
  }
  if (String(data._gotcha || "").trim()) {
    return respond(request, origin, 200);
  }

  if (!isEmail(email) || !consented(data.casl_consent)) {
    return respond(
      request,
      origin,
      400,
      "Enter your email and check the box to agree to job alert emails."
    );
  }

  if (!isInternal(request)) {
    const passed = await turnstilePasses(
      data.turnstile_token,
      env && env.TURNSTILE_SECRET_KEY,
      clientIp(request)
    );
    if (!passed) return respond(request, origin, 403, TURNSTILE_MESSAGE);
  }

  if (!env || !env.RESEND_API_KEY || !confirmSecret(env)) {
    console.error(!env || !env.RESEND_API_KEY ? "RESEND_API_KEY is not set" : "ALERT_CONFIRM_SECRET is not set");
    return respond(request, origin, 500, "Something went wrong. Please try again.");
  }

  const existing = await lookupSubscriber(email, env);
  if (existing === "error") {
    return respond(request, origin, 502, "Something went wrong. Please try again.");
  }
  if (existing === "yes") return respond(request, origin, 200, "", { status: "subscribed" });

  const pay = SOFT_PAY.has(String(data.soft_pay || "").trim()) ? String(data.soft_pay).trim() : "";
  const exp = Math.floor(now.getTime() / 1000) + CONFIRM_TTL_SECONDS;
  const sent = await sendConfirm(email, now.toISOString(), pay, exp, env);
  if (!sent) return respond(request, origin, 502, "Something went wrong. Please try again.");
  return respond(request, origin, 200, "", { status: "confirm" });
}

export default {
  fetch(request, env) {
    return handleSignup(request, env);
  },
};
