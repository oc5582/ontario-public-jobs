import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CONSENT_SOURCE,
  CONSENT_TEXT,
  SEGMENT_ID,
  WELCOME_EVENT,
  WELCOME_FROM,
  clearSignupLimits,
  handleSignup,
  originAllowed,
} from "./signup.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://publicjobs.ca";

function post(body, headers = {}) {
  return new Request("https://signup.example/subscribe", {
    method: "POST",
    headers: {
      Origin: origin,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("creates a consented contact on the Ontario Public Jobs segment", async () => {
  const seen = [];
  globalThis.fetch = async (url, options) => {
    seen.push({ url: String(url), options });
    return new Response(JSON.stringify({ id: "contact_1" }), { status: 200 });
  };

  const response = await handleSignup(
    post({
      email: "Reader@Example.com",
      casl_consent: "yes",
      soft_pay: "maybe",
    }),
    { RESEND_API_KEY: "test-key" },
    { now: () => new Date("2026-09-24T12:00:00.000Z") }
  );

  assert.equal(response.status, 200);
  const payload = JSON.parse(seen[0].options.body);
  assert.equal(seen.length, 2);
  assert.equal(seen[0].url, "https://api.resend.com/contacts");
  assert.equal(seen[0].options.headers.Authorization, "Bearer test-key");
  assert.equal(payload.email, "reader@example.com");
  assert.equal(payload.unsubscribed, false);
  assert.deepEqual(payload.segments, [{ id: SEGMENT_ID }]);
  assert.equal(payload.properties.casl_consent, "express");
  assert.equal(payload.properties.consent_text, CONSENT_TEXT);
  assert.equal(payload.properties.consent_source, CONSENT_SOURCE);
  assert.equal(payload.properties.consented_at, "2026-09-24T12:00:00.000Z");
  assert.equal(payload.properties.soft_pay, "maybe");
  assert.equal(payload.properties.region, undefined);

  const welcome = JSON.parse(seen[1].options.body);
  assert.equal(seen[1].url, "https://api.resend.com/events/send");
  assert.equal(seen[1].options.headers["Idempotency-Key"], "welcome-email/reader@example.com");
  assert.equal(welcome.event, WELCOME_EVENT);
  assert.equal(welcome.email, "reader@example.com");
  assert.equal(welcome.html, undefined);
  assert.equal(welcome.template, undefined);
  assert.equal(WELCOME_FROM, "PublicJobs.ca <alerts@publicjobs.ca>");
});

test("existing contacts are updated and added to the segment", async () => {
  const seen = [];
  globalThis.fetch = async (url, options) => {
    seen.push({ url: String(url), method: options.method });
    if (seen.length === 1) {
      return new Response(JSON.stringify({ message: "Contact already exists" }), {
        status: 409,
      });
    }
    return new Response("{}", { status: 200 });
  };

  const response = await handleSignup(
    post({ email: "reader@example.com", casl_consent: "yes" }),
    { RESEND_API_KEY: "test-key" }
  );
  assert.equal(response.status, 200);
  assert.equal(seen[1].method, "PATCH");
  assert.equal(
    seen[1].url,
    "https://api.resend.com/contacts/reader%40example.com"
  );
  assert.equal(seen[2].method, "POST");
  assert.equal(
    seen[2].url,
    `https://api.resend.com/contacts/reader%40example.com/segments/${SEGMENT_ID}`
  );
  assert.equal(seen[3].method, "POST");
  assert.equal(seen[3].url, "https://api.resend.com/events/send");
});

test("a failed welcome email still accepts the signup", async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/events/send")) {
      return new Response(JSON.stringify({ message: "domain not verified" }), {
        status: 403,
      });
    }
    return new Response(JSON.stringify({ id: "contact_1" }), { status: 200 });
  };
  const response = await handleSignup(
    post({ email: "reader@example.com", casl_consent: "yes" }),
    { RESEND_API_KEY: "test-key" }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("rejects missing consent and does not call Resend", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  const response = await handleSignup(
    post({ email: "reader@example.com", casl_consent: "" }),
    { RESEND_API_KEY: "test-key" }
  );
  assert.equal(response.status, 400);
  assert.equal(called, false);
  const body = await response.json();
  assert.match(body.error, /agree/);
});

test("honeypot submissions do not create a contact", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  const response = await handleSignup(
    post({ email: "reader@example.com", casl_consent: "yes", _gotcha: "spam" }),
    { RESEND_API_KEY: "test-key" }
  );
  assert.equal(response.status, 200);
  assert.equal(called, false);
});

test("allows the custom domain and local dev only", () => {
  assert.equal(originAllowed("https://publicjobs.ca"), true);
  assert.equal(originAllowed("https://www.publicjobs.ca"), true);
  assert.equal(originAllowed("http://localhost:8000"), true);
  assert.equal(originAllowed("http://127.0.0.1:8787"), true);
  assert.equal(originAllowed("https://oc5582.github.io"), false);
  assert.equal(originAllowed("https://evil.example"), false);
});

test("blocks other websites", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  const response = await handleSignup(
    post(
      { email: "reader@example.com", casl_consent: "yes" },
      { Origin: "https://evil.example" }
    ),
    { RESEND_API_KEY: "test-key" }
  );
  assert.equal(response.status, 403);
  assert.equal(called, false);
});

test("public signups are limited per IP and per email", async () => {
  clearSignupLimits();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ id: "contact_1" }), { status: 200 });
  };
  const ip = "203.0.113.10";
  for (let i = 1; i <= 5; i += 1) {
    const response = await handleSignup(
      post({ email: `person${i}@example.com`, casl_consent: "yes" }, { "CF-Connecting-IP": ip }),
      { RESEND_API_KEY: "test-key" }
    );
    assert.equal(response.status, 200, `signup ${i}`);
  }
  const blocked = await handleSignup(
    post({ email: "person6@example.com", casl_consent: "yes" }, { "CF-Connecting-IP": ip }),
    { RESEND_API_KEY: "test-key" }
  );
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).error, /wait/i);
  assert.equal(calls, 10);

  clearSignupLimits();
  calls = 0;
  for (let i = 1; i <= 3; i += 1) {
    const response = await handleSignup(
      post({ email: "same@example.com", casl_consent: "yes" }, { "CF-Connecting-IP": "203.0.113.11" }),
      { RESEND_API_KEY: "test-key" }
    );
    assert.equal(response.status, 200);
  }
  const again = await handleSignup(
    post({ email: "same@example.com", casl_consent: "yes" }, { "CF-Connecting-IP": "203.0.113.11" }),
    { RESEND_API_KEY: "test-key" }
  );
  assert.equal(again.status, 429);
  assert.equal(calls, 6);
});

test("Turnstile stays off until the worker secret is set", async () => {
  clearSignupLimits();
  let urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes("siteverify")) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: "contact_1" }), { status: 200 });
  };

  const open = await handleSignup(
    post({ email: "open@example.com", casl_consent: "yes" }, { "CF-Connecting-IP": "203.0.113.20" }),
    { RESEND_API_KEY: "test-key" }
  );
  assert.equal(open.status, 200);
  assert.equal(urls.some((url) => url.includes("siteverify")), false);

  const internal = await handleSignup(
    new Request("https://signup.internal/subscribe", {
      method: "POST",
      headers: {
        Origin: origin,
        Accept: "application/json",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "203.0.113.21",
      },
      body: JSON.stringify({ email: "internal@example.com", casl_consent: "yes" }),
    }),
    { RESEND_API_KEY: "test-key", TURNSTILE_SECRET_KEY: "secret" }
  );
  assert.equal(internal.status, 200);

  urls = [];
  const missing = await handleSignup(
    post({ email: "locked@example.com", casl_consent: "yes" }, { "CF-Connecting-IP": "203.0.113.22" }),
    { RESEND_API_KEY: "test-key", TURNSTILE_SECRET_KEY: "secret" }
  );
  assert.equal(missing.status, 403);
  assert.match((await missing.json()).error, /security check/i);
  assert.equal(urls.length, 0);

  const passed = await handleSignup(
    post(
      { email: "passed@example.com", casl_consent: "yes", turnstile_token: "ok-token" },
      { "CF-Connecting-IP": "203.0.113.23" }
    ),
    { RESEND_API_KEY: "test-key", TURNSTILE_SECRET_KEY: "secret" }
  );
  assert.equal(passed.status, 200);
  assert.equal(urls[0], "https://challenges.cloudflare.com/turnstile/v0/siteverify");
});

test("a very long email is rejected before the pattern matcher", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  const started = Date.now();
  const response = await handleSignup(
    post({ email: `${"a".repeat(50000)}@example.com`, casl_consent: "yes" }, { "CF-Connecting-IP": "203.0.113.40" }),
    { RESEND_API_KEY: "test-key" }
  );
  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.ok(Date.now() - started < 200);
});

test("homepage form is email plus consent and listings stay in the HTML", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  const listingsAt = html.indexOf('id="job-list"');
  const signupAt = html.indexOf('id="signup-form"');
  assert.ok(signupAt > 0 && listingsAt > signupAt);
  assert.match(html, /Or get new openings by email/);
  assert.match(html, /New openings by email/);
  assert.match(html, /name="casl_consent"/);
  assert.match(html, /type="checkbox"/);
  assert.doesNotMatch(html, /id="consent"[^>]*\schecked/);
  assert.match(html, /See which jobs fit your resume/);
  assert.match(html, /id="nav-more-btn"[^>]*aria-controls="nav-more-panel"/);
  assert.match(html, /src="\.\/nav\.js"/);
  assert.doesNotMatch(html.slice(signupAt, signupAt + 2500), /name="(region|keyword|employer)"/);
  assert.match(html, /href="jobs\/[^"]+\/[^"]+\/"/);

  const config = readFileSync(join(root, "signup.config.js"), "utf8");
  assert.match(
    config,
    /SIGNUP_ENDPOINT\s*=\s*"https:\/\/ontario-public-jobs-signup\.publicjobs\.workers\.dev"/
  );
  assert.doesNotMatch(config, /re_[A-Za-z0-9]/);

  for (const name of readdirSync(join(root, "jobs"))) {
    if (!name.endsWith(".html")) continue;
    const page = readFileSync(join(root, "jobs", name), "utf8");
    assert.equal(page.includes('id="signup-form"'), false, name);
  }
});
