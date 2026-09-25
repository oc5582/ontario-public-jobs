import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CONSENT_SOURCE,
  CONSENT_TEXT,
  SEGMENT_ID,
  handleSignup,
} from "./signup.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://oc5582.github.io";

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
  assert.equal(seen.length, 1);
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

test("homepage form is email plus consent and listings stay in the HTML", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  const listingsAt = html.indexOf('id="listings-body"');
  const signupAt = html.indexOf('id="signup-form"');
  assert.ok(listingsAt > 0 && signupAt > listingsAt);
  assert.match(html, /Get new Toronto Crown &amp; agency openings by email — free\./);
  assert.match(html, /name="casl_consent"/);
  assert.match(html, /type="checkbox"/);
  assert.doesNotMatch(html.slice(signupAt, signupAt + 2500), /name="(region|keyword|employer)"/);
  assert.match(html, /href="jobs\/bdc-senior-business-advisor-business-strategy-toronto\.html"/);

  const config = readFileSync(join(root, "signup.config.js"), "utf8");
  assert.match(config, /SIGNUP_ENDPOINT\s*=\s*""/);
  assert.doesNotMatch(config, /re_[A-Za-z0-9]/);

  for (const name of readdirSync(join(root, "jobs"))) {
    if (!name.endsWith(".html")) continue;
    const page = readFileSync(join(root, "jobs", name), "utf8");
    assert.equal(page.includes('id="signup-form"'), false, name);
  }
});
