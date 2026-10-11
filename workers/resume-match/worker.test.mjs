import assert from "node:assert/strict";
import worker from "./worker.js";

const SECRET = "test-trusted-secret";
const resume = "Customer service lead at a public counter for eight years. Trained new staff, handled cash, and kept the daily records. Looking for clerk or coordinator work in Toronto.";

const listings = Array.from({ length: 11 }, (_, i) => ({
  title: `Clerk ${i + 1}`,
  employer: "City of Toronto",
  location: "Toronto",
  employment_type: "Full-time",
  closing_date: "2026-12-01",
  description: "What you will do: help residents with applications and records at the counter every day.",
  apply_url: `https://jobs.example.com/j${i + 1}`,
}));

const rows = new Map();
let mode = "ok";
let runCalls = 0;
let signupOk = true;
const signups = [];

function createDb() {
  return {
    prepare(sql) {
      const state = { args: [] };
      const api = {
        bind(...args) {
          state.args = args;
          return api;
        },
        async first() {
          const [key, cap] = state.args;
          if (sql.includes("WHERE n <")) {
            const current = rows.get(key) || 0;
            if (current >= cap) return null;
            const n = current + 1;
            rows.set(key, n);
            return { n };
          }
          if (sql.trim().startsWith("SELECT")) {
            const n = rows.get(key);
            return n == null ? null : { n };
          }
          return null;
        },
        async run() {
          const [key, micro] = state.args;
          if (sql.includes("MAX(n - 1")) rows.set(key, Math.max((rows.get(key) || 0) - 1, 0));
          else if (sql.includes("n + ?2")) rows.set(key, (rows.get(key) || 0) + micro);
          return { success: true };
        },
      };
      return api;
    },
  };
}

globalThis.caches = { default: { async match() { return null; }, async put() {} } };
globalThis.fetch = async (url) => {
  if (mode === "crash") return new Response("no", { status: 500 });
  if (String(url).includes("listings.json")) return new Response(JSON.stringify(listings), { status: 200 });
  throw new Error(`unexpected fetch ${url}`);
};

function env(extra = {}) {
  return {
    MATCH_TRUSTED_SECRET: SECRET,
    AI: {
      async run() {
        runCalls += 1;
        if (mode === "fail-all" || (mode === "fail-second" && runCalls === 2)) throw new Error("batch failed");
        return {
          response: { matches: [{ id: 1, fit: "strong", reason: "Your counter work fits this clerk role at the city." }] },
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        };
      },
    },
    USAGE: { async get(key) { return key === "config_batch" ? "10" : null; } },
    DB: createDb(),
    SIGNUP: {
      async fetch(_url, init) {
        const body = JSON.parse(init.body);
        signups.push(body);
        return { ok: signupOk };
      },
    },
    ...extra,
  };
}

const ctx = { waitUntil(p) { return p; } };

function post(body, { ip = "203.0.113.10", origin = "https://publicjobs.ca", trusted = false, secret = SECRET } = {}) {
  const headers = new Headers({
    origin,
    "content-type": "application/json",
    "cf-connecting-ip": ip,
  });
  if (trusted) headers.set("x-publicjobs-trusted", secret);
  return new Request("https://worker.test/match", { method: "POST", headers, body: JSON.stringify(body) });
}

async function call(body, opts, extraEnv) {
  runCalls = 0;
  const res = await worker.fetch(post(body, opts), env(extraEnv), ctx);
  return { status: res.status, json: await res.json() };
}

function sum(prefix) {
  let n = 0;
  for (const [key, value] of rows) if (key.startsWith(prefix)) n += value;
  return n;
}

function direct(email, ip) {
  return call(
    { email, casl_consent: "yes", resume_text: resume },
    { ip },
  );
}

const personMsg = "You have used your 3 free resume matches. New jobs will still come to your inbox every week.";
const ipMsg = "Resume matching from this network is busy today. Please try again tomorrow.";

// A crash after the counters are taken must give the use back.
{
  mode = "crash";
  const before = signups.length;
  const result = await direct("crash@publicjobs.test", "203.0.113.20");
  assert.equal(result.status, 500);
  assert.equal(result.json.ok, false);
  assert.equal(sum("person:"), 0);
  assert.equal(sum("ipday:"), 0);
  assert.equal(sum("day:"), 0);
  assert.equal(signups.length, before + 1);
  mode = "ok";
}

// Honeypot does not count or subscribe.
{
  const before = signups.length;
  const result = await call({ email: "bot@publicjobs.test", casl_consent: "yes", resume_text: resume, _gotcha: "bot" });
  assert.equal(result.json.ok, true);
  assert.equal(signups.length, before);
  assert.equal(sum("person:"), 0);
}

// Direct caller: 3 lifetime matches per email, then a distinct message. Signup only when allowed.
{
  const signupBefore = signups.length;
  for (let i = 1; i <= 3; i++) {
    const result = await direct("lifetime@publicjobs.test", `203.0.113.${30 + i}`);
    assert.equal(result.status, 200, JSON.stringify(result.json));
    assert.equal(result.json.ok, true);
    assert.equal(result.json.remaining, 3 - i);
    assert.equal(result.json.partial, false);
  }
  assert.equal(signups.length, signupBefore + 3);
  const blocked = await direct("lifetime@publicjobs.test", "203.0.113.80");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.json.error, personMsg);
  assert.equal(signups.length, signupBefore + 3);
  assert.equal(sum("person:"), 3);
}

// Same network, new emails: the 11th match is an IP-day message, and that email is not charged.
{
  const signupBefore = signups.length;
  for (let i = 1; i <= 10; i++) {
    const result = await direct(`ip${i}@publicjobs.test`, "203.0.113.50");
    assert.equal(result.status, 200, JSON.stringify(result.json));
  }
  const blocked = await direct("ip11@publicjobs.test", "203.0.113.50");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.json.error, ipMsg);
  assert.equal(blocked.json.error.includes("3 free"), false);
  assert.equal(signups.length, signupBefore + 10);
  const charged = [...rows.entries()].filter(([key, n]) => key.startsWith("person:") && n > 0).length;
  assert.equal(charged, 11);
}

// example.com is matched but never subscribed.
{
  const before = signups.length;
  const result = await direct("person@example.com", "203.0.113.90");
  assert.equal(result.status, 200, JSON.stringify(result.json));
  assert.equal(signups.length, before);
}

// Over the spend cap: no signup and no use.
{
  const month = new Date().toISOString().slice(0, 7);
  rows.set(`spend:${month}`, 10 * 1e6);
  const before = signups.length;
  const result = await direct("spend@publicjobs.test", "203.0.113.91");
  assert.equal(result.status, 503);
  assert.match(result.json.error, /paused/i);
  assert.equal(signups.length, before);
  rows.delete(`spend:${month}`);
}

// Partial and total AI failure do not leave a use charged.
{
  const personBefore = sum("person:");
  mode = "fail-second";
  const partial = await direct("partial@publicjobs.test", "203.0.113.92");
  assert.equal(partial.status, 502);
  assert.equal(partial.json.ok, false);
  assert.equal(sum("person:"), personBefore);
  mode = "fail-all";
  const failed = await direct("failed@publicjobs.test", "203.0.113.93");
  assert.equal(failed.status, 502);
  assert.equal(sum("person:"), personBefore);
  mode = "ok";
}

// Signup failure gives the use back.
{
  signupOk = false;
  const personBefore = sum("person:");
  const result = await direct("signup-down@publicjobs.test", "203.0.113.94");
  assert.equal(result.status, 502);
  assert.equal(sum("person:"), personBefore);
  signupOk = true;
}

// Trusted caller skips per-email and per-IP counters, still hits the daily cap, and subscribes only with consent.
{
  const personBefore = sum("person:");
  const ipBefore = sum("ipday:");
  const noConsent = await call({ resume_text: resume }, { trusted: true, ip: "198.51.100.10" });
  assert.equal(noConsent.status, 200, JSON.stringify(noConsent.json));
  assert.equal(noConsent.json.remaining, null);
  assert.equal(sum("person:"), personBefore);
  assert.equal(sum("ipday:"), ipBefore);

  const before = signups.length;
  const example = await call(
    { email: "member@example.com", casl_consent: "yes", resume_text: resume },
    { trusted: true, ip: "198.51.100.11" },
  );
  assert.equal(example.status, 200);
  assert.equal(signups.length, before);

  const opted = await call(
    { email: "member@publicjobs.test", casl_consent: "yes", resume_text: resume },
    { trusted: true, ip: "198.51.100.12" },
  );
  assert.equal(opted.status, 200);
  assert.equal(signups.length, before + 1);
  assert.equal(signups.at(-1).email, "member@publicjobs.test");

  rows.set(`day:${new Date().toISOString().slice(0, 10)}`, 2);
  const capped = await call({ resume_text: resume }, { trusted: true }, { MATCH_DAILY_CAP: "2" });
  assert.equal(capped.status, 503);
  assert.match(capped.json.error, /busy today/);
  assert.equal(capped.json.error.includes("3 free"), false);
}

// A missing or wrong secret is not trusted, so the live origin rule still applies.
{
  const denied = await call({ resume_text: resume }, { trusted: true, secret: "nope", origin: "https://evil.example" });
  assert.equal(denied.status, 403);
}

console.log("worker tests passed");
