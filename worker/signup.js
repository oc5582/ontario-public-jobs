/**
 * GitHub Pages signup endpoint.
 * Creates a Resend contact on the Ontario Public Jobs subscribers segment.
 * RESEND_API_KEY is a Worker secret — never put it in the static site.
 */

export const SEGMENT_ID = "e749c971-4701-4a99-9448-c315ff27a47b";

export const CONSENT_TEXT =
  "I agree to receive job alert emails from Ontario Public Jobs at this address. I can unsubscribe anytime.";

export const CONSENT_SOURCE = "https://oc5582.github.io/ontario-public-jobs/";

const SITE_URL = CONSENT_SOURCE;
const MAX_BODY = 10_000;
const SOFT_PAY = new Set(["yes", "maybe", "no"]);

function isEmail(value) {
  if (typeof value !== "string") return false;
  const email = value.trim();
  if (email.length < 3 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function originAllowed(origin) {
  if (origin === "https://oc5582.github.io") return true;
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
  <title>Ontario Public Jobs</title>
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

export async function handleSignup(request, env, deps = {}) {
  const origin = request.headers.get("origin") || "";

  if (request.method === "OPTIONS") {
    if (!originAllowed(origin)) return new Response(null, { status: 403 });
    return withCors(new Response(null, { status: 204 }), origin);
  }

  if (request.method === "GET") {
    return withCors(
      new Response("Ontario Public Jobs signup endpoint\n", {
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
  if (String(data._gotcha || "").trim()) {
    return respond(request, origin, 200);
  }

  const email = String(data.email || "").trim().toLowerCase();
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

  const now = (deps.now || (() => new Date()))();
  const properties = contactProperties(
    String(data.soft_pay || "").trim(),
    now.toISOString()
  );
  const saved = await saveContact(email, properties, env);
  if (!saved.ok) {
    console.error("Resend contact save failed", saved.status || "");
    return respond(request, origin, 502, "Something went wrong. Please try again.");
  }
  return respond(request, origin, 200);
}

export default {
  fetch(request, env) {
    return handleSignup(request, env);
  },
};
