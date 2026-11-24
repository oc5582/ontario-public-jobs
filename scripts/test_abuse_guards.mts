import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isCheckoutEmail } from "../web/lib/guest-checkout.ts";
import { boundedEmailLower, isBasicEmail } from "../web/lib/email-address.ts";
import { isValidEmail } from "../web/lib/match.ts";
import { clearRateLimits, requestAllowed } from "../web/lib/rate-limit.ts";
import { turnstileOk } from "../web/lib/turnstile.ts";

const huge = `${"a".repeat(50000)}@example.com`;
const started = performance.now();
assert.equal(boundedEmailLower(huge), "");
assert.equal(isBasicEmail(huge), false);
assert.equal(isCheckoutEmail(huge), false);
assert.equal(isValidEmail(huge), false);
assert.ok(performance.now() - started < 50, "long emails must fail before the pattern matcher");
assert.equal(boundedEmailLower("  Reader@Example.com "), "reader@example.com");
assert.equal(isBasicEmail("reader@example.com"), true);
assert.equal(isBasicEmail("a".repeat(254)), false);

clearRateLimits();
const ipRule = { limit: 2, windowMs: 1000 };
const emailRule = { limit: 1, windowMs: 1000 };
assert.equal(
  await requestAllowed({ scope: "t", ip: "203.0.113.1", ipRule, now: 1_000 }),
  true,
);
assert.equal(
  await requestAllowed({ scope: "t", ip: "203.0.113.1", ipRule, now: 1_000 }),
  true,
);
assert.equal(
  await requestAllowed({ scope: "t", ip: "203.0.113.1", ipRule, now: 1_000 }),
  false,
);
assert.equal(
  await requestAllowed({ scope: "t", ip: "203.0.113.1", ipRule, now: 2_500 }),
  true,
);
assert.equal(
  await requestAllowed({
    scope: "mail",
    ip: "203.0.113.2",
    email: "a@example.com",
    ipRule: { limit: 10, windowMs: 1000 },
    emailRule,
    now: 1_000,
  }),
  true,
);
assert.equal(
  await requestAllowed({
    scope: "mail",
    ip: "203.0.113.2",
    email: "a@example.com",
    ipRule: { limit: 10, windowMs: 1000 },
    emailRule,
    now: 1_000,
  }),
  false,
);
assert.equal(
  await requestAllowed({
    scope: "mail",
    ip: "203.0.113.2",
    email: "b@example.com",
    ipRule: { limit: 10, windowMs: 1000 },
    emailRule,
    now: 1_000,
  }),
  true,
);

const savedSecret = process.env.TURNSTILE_SECRET_KEY;
const savedFetch = globalThis.fetch;
delete process.env.TURNSTILE_SECRET_KEY;
assert.equal(await turnstileOk("", "203.0.113.5"), true);
process.env.TURNSTILE_SECRET_KEY = "secret";
assert.equal(await turnstileOk("", "203.0.113.5"), false);
globalThis.fetch = async () => new Response(JSON.stringify({ success: true }), { status: 200 });
assert.equal(await turnstileOk("token", "203.0.113.5"), true);
globalThis.fetch = async () => new Response(JSON.stringify({ success: false }), { status: 200 });
assert.equal(await turnstileOk("token", "203.0.113.5"), false);
globalThis.fetch = savedFetch;
if (savedSecret == null) delete process.env.TURNSTILE_SECRET_KEY;
else process.env.TURNSTILE_SECRET_KEY = savedSecret;

for (const name of ["applied-cleanup", "renewal-reminders", "weekly-matches"]) {
  const source = readFileSync(new URL(`../web/app/api/cron/${name}/route.ts`, import.meta.url), "utf8");
  assert.match(source, /cronAuthorized/);
  assert.equal(source.includes("!== `Bearer"), false, name);
}

const login = readFileSync(new URL("../web/app/login/actions.ts", import.meta.url), "utf8");
assert.match(login, /boundedEmailLower/);
assert.match(login, /isBasicEmail/);
assert.equal(/\.test\(email\)/.test(login), false);

console.log("abuse guard tests passed");
