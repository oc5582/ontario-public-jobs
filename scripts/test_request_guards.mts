import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AUTH_COOKIE_MAX_AGE, authCookieSettings } from "../web/lib/auth-cookie.ts";
import { safeNext } from "../web/lib/safe-next.ts";
import { CONTENT_SECURITY_POLICY, securityHeaders } from "../web/lib/security-headers.ts";
import { SIGNUP_ENDPOINT } from "../web/lib/site.ts";
import { weeklyAlertPayload } from "../web/lib/weekly-alert.ts";

function locationFor(next: string, origin = "https://publicjobs.ca"): string {
  return new URL(safeNext(next), origin).href;
}

assert.equal(locationFor("/\t/evil.example"), "https://publicjobs.ca/account/");
assert.equal(locationFor("/\n/evil.example"), "https://publicjobs.ca/account/");
assert.equal(locationFor("/\r/evil.example"), "https://publicjobs.ca/account/");
assert.equal(locationFor("//evil.example"), "https://publicjobs.ca/account/");
assert.equal(locationFor("\\\\evil.example"), "https://publicjobs.ca/account/");
assert.equal(locationFor("/\\evil.example"), "https://publicjobs.ca/account/");
assert.equal(locationFor("https://evil.example/phish"), "https://publicjobs.ca/account/");
assert.equal(locationFor("http://evil.example"), "https://publicjobs.ca/account/");
assert.equal(locationFor("/%09/evil.example"), "https://publicjobs.ca/account/");
assert.equal(locationFor("/%0a/evil.example"), "https://publicjobs.ca/account/");
assert.equal(locationFor("/%0d/evil.example"), "https://publicjobs.ca/account/");
assert.equal(locationFor("/%5c/evil.example"), "https://publicjobs.ca/account/");
assert.equal(locationFor("/%2f%2fevil.example"), "https://publicjobs.ca/account/");
assert.equal(locationFor("/%252f%252fevil.example"), "https://publicjobs.ca/account/");
assert.equal(locationFor("/%2509/evil.example"), "https://publicjobs.ca/account/");
assert.equal(safeNext("/pricing/"), "/pricing/");
assert.equal(safeNext("/account/?x=1#top"), "/account/?x=1#top");
assert.equal(safeNext("pricing"), "/account/");
assert.equal(safeNext(""), "/account/");
assert.equal(safeNext(null), "/account/");
assert.equal(locationFor("/\t/evil.example", "https://preview.example"), "https://preview.example/account/");

assert.deepEqual(weeklyAlertPayload(" Reader@Example.com "), {
  email: "reader@example.com",
  casl_consent: "yes",
  _gotcha: "",
});
if (!process.env.NEXT_PUBLIC_SIGNUP_ENDPOINT) {
  assert.equal(SIGNUP_ENDPOINT, "https://ontario-public-jobs-signup.publicjobs.workers.dev");
}

const worker = readFileSync(new URL("../worker/signup.js", import.meta.url), "utf8");
assert.match(worker, /https:\/\/publicjobs\.ca/);
assert.match(worker, /https:\/\/www\.publicjobs\.ca/);
assert.match(worker, /casl_consent/);
assert.match(worker, /_gotcha/);

const headers = Object.fromEntries(securityHeaders().map((header) => [header.key, header.value]));
assert.equal(headers["X-Frame-Options"], "DENY");
assert.equal(headers["X-Content-Type-Options"], "nosniff");
assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
assert.match(headers["Permissions-Policy"], /camera=\(\)/);
assert.match(headers["Permissions-Policy"], /payment=\(\)/);
assert.match(headers["Strict-Transport-Security"], /max-age=63072000; includeSubDomains; preload/);
for (const host of [
  "js.stripe.com",
  "connect.facebook.net",
  "static.cloudflareinsights.com",
  "supabase.co",
  "cdn.jsdelivr.net",
  "ontario-public-jobs-signup.publicjobs.workers.dev",
]) {
  assert.match(CONTENT_SECURITY_POLICY, new RegExp(host.replaceAll(".", "\\.")));
}

const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
const cookie = authCookieSettings({
  maxAge: 400 * 24 * 60 * 60,
  httpOnly: false,
  secure: false,
  sameSite: "none",
  expires: new Date("2099-01-01"),
});
assert.equal(cookie.httpOnly, true);
assert.equal(cookie.secure, true);
assert.equal(cookie.sameSite, "lax");
assert.equal(cookie.maxAge, AUTH_COOKIE_MAX_AGE);
assert.equal(cookie.expires, undefined);
assert.equal(authCookieSettings({ maxAge: 0 }).maxAge, 0);
process.env.NODE_ENV = previousNodeEnv;

console.log("request guard tests passed");
