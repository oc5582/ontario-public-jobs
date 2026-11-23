/**
 * GitHub Pages signup endpoint.
 * Creates a Resend contact on the PublicJobs.ca subscribers segment.
 * RESEND_API_KEY is a Worker secret — never put it in the static site.
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

function htmlPage(status, origin) {
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PublicJobs.ca</title>
</head>
<body>
  <main>
    <h1>You're on the list.</h1>
    <p>We'll email new Toronto Crown and agency openings to this address.</p>
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

function respond(request, origin, status, error) {
  const accept = request.headers.get("accept") || "";
  if (accept.includes("application/json")) {
    if (status >= 400) return json({ ok: false, error }, status, origin);
    return json({ ok: true }, status, origin);
  }
  if (status >= 400) {
    return withCors(new Response(error, { status }), origin);
  }
  return htmlPage(status, origin);
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

  if (!originAllowed(origin)) {
    return respond(request, origin, 403, "Origin not allowed");
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

  if (!env || !env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set");
    return respond(request, origin, 500, "Something went wrong. Please try again.");
  }

  if (!isInternal(request)) {
    const passed = await turnstilePasses(
      data.turnstile_token,
      env.TURNSTILE_SECRET_KEY,
      clientIp(request)
    );
    if (!passed) return respond(request, origin, 403, TURNSTILE_MESSAGE);
  }

  const properties = contactProperties(
    String(data.soft_pay || "").trim(),
    now.toISOString()
  );
  const saved = await saveContact(email, properties, env);
  if (!saved.ok) {
    console.error("Resend contact save failed", saved.status || "");
    return respond(request, origin, 502, "Something went wrong. Please try again.");
  }
  await sendWelcome(email, env);
  return respond(request, origin, 200);
}

export default {
  fetch(request, env) {
    return handleSignup(request, env);
  },
};
