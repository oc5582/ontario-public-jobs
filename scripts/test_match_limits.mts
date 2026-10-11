import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG, capResults, runMatch, type MatchHit } from "../web/lib/match.ts";
import { query } from "../web/lib/db.ts";

const envFile = readFileSync(new URL("../web/.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && process.env[match[1]] == null) process.env[match[1]] = match[2];
}

const SECRET = "local-match-test-secret";
const RESUME = "Customer service lead at a public counter for eight years. Trained new staff, handled cash, and kept the daily records. Looking for clerk or coordinator work in Toronto.";
const FREE_ID = "00000000-0000-4000-8000-000000000002";
const FAIL_ID = "00000000-0000-4000-8000-000000000003";
const MEMBER_ID = "00000000-0000-4000-8000-000000000001";

function hits(prefix: string, count: number): MatchHit[] {
  return Array.from({ length: count }, (_, index) => ({
    title: `${prefix} ${index + 1}`,
    employer: "TTC",
    location: "Toronto",
    closing_date: "2026-12-01",
    url: `https://publicjobs.ca/jobs/example/${prefix.toLowerCase()}-${index + 1}/`,
    reason: "Your counter experience fits this clerk role.",
  }));
}

const strong = hits("Strong", 6);
const maybe = hits("Maybe", 3);

let mode = "ok";
const calls: { email: string; casl_consent: string; trusted: string }[] = [];

async function fetchImpl(_url: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const body = JSON.parse(String(init?.body || "{}")) as { email?: string; casl_consent?: string; resume_text?: string };
  calls.push({
    email: body.email || "",
    casl_consent: body.casl_consent || "",
    trusted: headers.get("x-publicjobs-trusted") || "",
  });
  assert.equal(headers.get("x-publicjobs-trusted"), SECRET);
  assert.ok((body.resume_text || "").length >= 80);
  if (mode === "throw") throw new Error("socket hang up");
  if (mode === "partial") {
    return Response.json({ ok: true, partial: true, strong, maybe, jobs_checked: 100 });
  }
  if (mode === "paused") return Response.json({ ok: false, code: "paused", error: "paused" }, { status: 503 });
  if (mode === "person") {
    return Response.json(
      { ok: false, code: "person_limit", error: "You have used your 3 free resume matches." },
      { status: 429 },
    );
  }
  if (mode === "error") return Response.json({ ok: false, code: "error", error: "nope" }, { status: 502 });
  return Response.json({ ok: true, partial: false, strong, maybe, jobs_checked: 100 });
}

const deps = { fetchImpl: fetchImpl as typeof fetch, trustedSecret: SECRET, workerUrl: "http://match.test/match" };

async function count(profileId: string): Promise<number> {
  const rows = await query<{ n: number }>(
    "select count(*)::int as n from resume_match_usage where profile_id = $1",
    [profileId],
  );
  return Number(rows[0]?.n || 0);
}

async function ensure(id: string, email: string, status: string) {
  await query(
    `insert into profiles (id, email, membership_status)
     values ($1, $2, $3)
     on conflict (id) do update set email = excluded.email, membership_status = excluded.membership_status, updated_at = now()`,
    [id, email, status],
  );
}

await ensure(FREE_ID, "free-match@example.com", "none");
await ensure(FAIL_ID, "fail-match@example.com", "none");
await ensure(MEMBER_ID, "test@example.com", "active");
await query("delete from resume_match_usage where profile_id = any($1::uuid[])", [[FREE_ID, FAIL_ID, MEMBER_ID]]);

try {
  const capped = capResults(strong, maybe, false);
  assert.equal(capped.strong.length, 5);
  assert.equal(capped.maybe.length, 0);
  assert.equal(capped.locked, 4);
  assert.equal(capResults(strong, maybe, true).locked, 0);
  assert.equal(capResults(strong, maybe, true).shown, 9);

  const first = await runMatch(
    { profileId: FREE_ID, email: "free-match@example.com", isMember: false, resumeText: RESUME, consent: false },
    deps,
  );
  assert.equal(first.status, 200);
  assert.equal(first.body.strong?.length, 5);
  assert.equal(first.body.maybe?.length, 0);
  assert.equal(first.body.shown, 5);
  assert.equal(first.body.locked, 4);
  assert.match(first.body.summary || "", /top 5/);
  assert.equal((first.body.summary || "").includes("inbox"), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].email, "");
  assert.equal(calls[0].casl_consent, "");
  assert.equal(await count(FREE_ID), 1);

  const second = await runMatch(
    { profileId: FREE_ID, email: "free-match@example.com", isMember: false, resumeText: RESUME, consent: true },
    deps,
  );
  assert.equal(second.status, 429);
  assert.equal(second.body.error, MSG.freeUsed);
  assert.equal(second.body.upgrade, "/pricing/");
  assert.equal(calls.length, 1);
  assert.equal(await count(FREE_ID), 1);

  mode = "error";
  const errored = await runMatch(
    { profileId: FAIL_ID, email: "fail-match@example.com", isMember: false, resumeText: RESUME, consent: false },
    deps,
  );
  assert.equal(errored.status, 502);
  assert.equal(await count(FAIL_ID), 0);

  mode = "partial";
  const partial = await runMatch(
    { profileId: FAIL_ID, email: "fail-match@example.com", isMember: false, resumeText: RESUME, consent: false },
    deps,
  );
  assert.equal(partial.status, 502);
  assert.equal(await count(FAIL_ID), 0);

  mode = "throw";
  const crashed = await runMatch(
    { profileId: FAIL_ID, email: "fail-match@example.com", isMember: false, resumeText: RESUME, consent: false },
    deps,
  );
  assert.equal(crashed.status, 502);
  assert.equal(await count(FAIL_ID), 0);

  mode = "person";
  const blamed = await runMatch(
    { profileId: FAIL_ID, email: "fail-match@example.com", isMember: false, resumeText: RESUME, consent: false },
    deps,
  );
  assert.equal(blamed.body.error, MSG.busy);
  assert.equal((blamed.body.error || "").includes("3 free"), false);
  assert.equal(await count(FAIL_ID), 0);

  mode = "paused";
  const paused = await runMatch(
    { profileId: FAIL_ID, email: "fail-match@example.com", isMember: false, resumeText: RESUME, consent: false },
    deps,
  );
  assert.equal(paused.body.error, MSG.paused);
  assert.equal(await count(FAIL_ID), 0);

  mode = "ok";
  const callsBefore = calls.length;
  for (let i = 1; i <= 20; i++) {
    const result = await runMatch(
      { profileId: MEMBER_ID, email: "test@example.com", isMember: true, resumeText: RESUME, consent: i === 1 },
      deps,
    );
    assert.equal(result.status, 200, `member match ${i}: ${JSON.stringify(result.body)}`);
    assert.equal(result.body.locked, 0);
    assert.equal(result.body.strong?.length, 6);
    assert.equal(result.body.maybe?.length, 3);
  }
  assert.equal(calls.length, callsBefore + 20);
  assert.equal(calls[callsBefore].email, "test@example.com");
  assert.equal(calls[callsBefore].casl_consent, "yes");
  assert.equal(calls[callsBefore + 1].email, "");
  assert.equal(await count(MEMBER_ID), 20);

  const over = await runMatch(
    { profileId: MEMBER_ID, email: "test@example.com", isMember: true, resumeText: RESUME, consent: false },
    deps,
  );
  assert.equal(over.status, 429);
  assert.equal(over.body.error, MSG.memberDaily);
  assert.equal(over.body.upgrade, undefined);
  assert.equal(calls.length, callsBefore + 20);
  assert.equal(await count(MEMBER_ID), 20);

  const callsAtEnd = calls.length;
  const offline = await runMatch(
    { profileId: FAIL_ID, email: "fail-match@example.com", isMember: false, resumeText: RESUME, consent: false },
    { ...deps, trustedSecret: "" },
  );
  assert.equal(offline.status, 503);
  assert.equal(offline.body.error, MSG.unavailable);
  assert.equal(calls.length, callsAtEnd);
  assert.equal(await count(FAIL_ID), 0);

  console.log("match limit tests passed");
} finally {
  await query("delete from resume_match_usage where profile_id = any($1::uuid[])", [[FREE_ID, FAIL_ID, MEMBER_ID]]);
  const pool = (await import("../web/lib/db.ts")).getPool();
  await pool.end();
}
