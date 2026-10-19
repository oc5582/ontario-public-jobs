import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FREE_RESULTS,
  FREE_RUNS_PER_EMAIL,
  GUEST_NETWORK_DAILY,
  cleanRunId,
  cookieRuns,
  MSG,
  isValidEmail,
  normalizeEmail,
  runGuestMatch,
  runMatch,
  type GuestInput,
  type MatchHit,
} from "../web/lib/match.ts";
import { query } from "../web/lib/db.ts";
import { FREE_MATCH_RETENTION_DAYS, purgeFreeMatchRecords } from "../web/lib/match-retention.ts";

const envFile = readFileSync(new URL("../web/.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && process.env[match[1]] == null) process.env[match[1]] = match[2];
}

const SECRET = "local-match-test-secret";
const RESUME = "Customer service lead at a public counter for eight years. Trained new staff, handled cash, and kept the daily records. Looking for clerk or coordinator work in Toronto.";
const FREE_ID = "00000000-0000-4000-8000-000000000012";
const MEMBER_ID = "00000000-0000-4000-8000-000000000011";

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
const strong = hits("Strong", 8);
const maybe = hits("Maybe", 6);

let mode = "ok";
const calls: { email: string; casl_consent: string }[] = [];
async function fetchImpl(_url: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const body = JSON.parse(String(init?.body || "{}")) as { email?: string; casl_consent?: string; resume_text?: string };
  assert.equal(headers.get("x-publicjobs-trusted"), SECRET);
  calls.push({ email: body.email || "", casl_consent: body.casl_consent || "" });
  if (mode === "throw") throw new Error("socket hang up");
  if (mode === "partial") return Response.json({ ok: true, partial: true, strong, maybe, jobs_checked: 100 });
  if (mode === "error") return Response.json({ ok: false, code: "error", error: "nope" }, { status: 502 });
  if (mode === "paused") return Response.json({ ok: false, code: "paused", error: "paused" }, { status: 503 });
  return Response.json({ ok: true, partial: false, strong, maybe, jobs_checked: 100 });
}
const deps = { fetchImpl: fetchImpl as typeof fetch, trustedSecret: SECRET, workerUrl: "http://match.test/match" };

let ipSeq = 0;
function guest(over: Partial<GuestInput> = {}): GuestInput {
  ipSeq += 1;
  return { email: "", resumeText: RESUME, consent: false, browserRuns: 0, ip: `198.51.100.${ipSeq}`, ...over };
}

async function ledger(email: string) {
  const rows = await query<{ email: string; alerts_consent: boolean; runs: number; source: string }>(
    "select email, alerts_consent, runs, source from match_free_runs where email_key = $1",
    [normalizeEmail(email)],
  );
  return rows[0] || null;
}
async function networkCount(): Promise<number> {
  const rows = await query<{ n: number }>("select coalesce(sum(n), 0)::int as n from match_free_networks");
  return Number(rows[0]?.n || 0);
}
async function cleanup() {
  await query("delete from match_free_runs where email_key like '%@example.com' or email_key like '%@gmail.com'");
  await query("delete from match_free_networks");
  await query("delete from resume_match_usage where profile_id = any($1::uuid[])", [[FREE_ID, MEMBER_ID]]);
}
async function ensure(id: string, email: string, status: string) {
  await query(
    `insert into profiles (id, email, membership_status)
     values ($1, $2, $3)
     on conflict (id) do update set email = excluded.email, membership_status = excluded.membership_status, updated_at = now()`,
    [id, email, status],
  );
}

await cleanup();
await ensure(FREE_ID, "guest-later-account@example.com", "none");
await ensure(MEMBER_ID, "guest-member@example.com", "active");

try {
  // Email rules
  assert.equal(normalizeEmail("  Jane.Doe+jobs@GoogleMail.com "), "janedoe@gmail.com");
  assert.equal(normalizeEmail("j.doe+x@example.com"), "j.doe@example.com");
  assert.equal(isValidEmail("someone@example.com"), true);
  assert.equal(isValidEmail("someone@example"), false);
  assert.equal(isValidEmail("a b@example.com"), false);
  assert.equal(isValidEmail("<x>@example.com"), false);

  // 1. Signed-out happy path, alerts unchecked: top 10 only, hidden count, nothing sent to the mailing list
  const first = await runGuestMatch(guest({ email: "Guest.One@example.com" }), deps);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.guest, true);
  assert.equal(first.body.shown, FREE_RESULTS);
  assert.equal((first.body.strong?.length || 0) + (first.body.maybe?.length || 0), 10);
  assert.equal(first.body.locked, 4);
  assert.match(first.body.summary || "", /top 10/);
  const json = JSON.stringify(first.body);
  for (const hidden of ["Maybe 3", "Maybe 4", "Maybe 5", "Maybe 6", "maybe-6"]) {
    assert.equal(json.includes(hidden), false, `hidden match leaked: ${hidden}`);
  }
  assert.equal(calls.at(-1)?.email, "");
  assert.equal(calls.at(-1)?.casl_consent, "");
  const row1 = await ledger("guest.one@example.com");
  assert.equal(row1?.email, "guest.one@example.com");
  assert.equal(row1?.alerts_consent, false);
  assert.equal(row1?.runs, 1);
  assert.equal(row1?.source, "guest");

  // 2. Runs 1-5 for one email are allowed (fresh browser each time), run 6 is blocked before the Worker
  assert.equal(FREE_RUNS_PER_EMAIL, 5);
  for (let i = 2; i <= FREE_RUNS_PER_EMAIL; i++) {
    const r = await runGuestMatch(guest({ email: i % 2 ? "guest.one@example.com" : "guest.one+again@example.com" }), deps);
    assert.equal(r.status, 200, `run ${i}: ${JSON.stringify(r.body)}`);
    assert.equal(r.body.shown, 10);
    assert.equal(r.body.locked, 4);
    assert.equal((await ledger("guest.one@example.com"))?.runs, i);
  }
  let before = calls.length;
  const sixth = await runGuestMatch(guest({ email: "guest.one+again@example.com" }), deps);
  assert.equal(sixth.status, 429);
  assert.equal(sixth.body.code, "free_used");
  assert.equal(sixth.body.error, MSG.guestUsed);
  assert.equal(sixth.body.upgrade, "/pricing/");
  assert.equal(sixth.body.login, "/login/?next=/match/");
  assert.equal(calls.length, before);
  assert.equal((await ledger("guest.one@example.com"))?.runs, 5);

  // Gmail dots and +tags count as the same person
  for (let i = 1; i <= FREE_RUNS_PER_EMAIL; i++) {
    assert.equal((await runGuestMatch(guest({ email: i % 2 ? "first.last@gmail.com" : "FirstLast+2@googlemail.com" }), deps)).status, 200);
  }
  before = calls.length;
  assert.equal((await runGuestMatch(guest({ email: "f.i.r.s.t.l.a.s.t@gmail.com" }), deps)).status, 429);
  assert.equal(calls.length, before);

  // 3. Browser counter: runs 2-5 are not blocked by the cookie, the 6th is (even with a new email)
  assert.equal(cookieRuns(undefined), 0);
  assert.equal(cookieRuns("1"), 1);
  assert.equal(cookieRuns("4"), 4);
  assert.equal(cookieRuns("99"), 5);
  assert.equal(cookieRuns("junk"), 0);
  for (let n = 1; n < FREE_RUNS_PER_EMAIL; n++) {
    assert.equal((await runGuestMatch(guest({ email: `browser-${n}@example.com`, browserRuns: n }), deps)).status, 200);
  }
  before = calls.length;
  const cookieBlocked = await runGuestMatch(guest({ email: "new-browser@example.com", browserRuns: 5 }), deps);
  assert.equal(cookieBlocked.status, 429);
  assert.equal(cookieBlocked.body.code, "free_used");
  assert.equal(calls.length, before);
  assert.equal(await ledger("new-browser@example.com"), null);

  // 4. Alerts checked: consent forwarded to the Worker (it subscribes, same as the homepage signup) and recorded
  let consentHook = 0;
  const alerts = await runGuestMatch(
    guest({ email: "guest-alerts@example.com", consent: true, beforeWorker: async () => { consentHook += 1; } }),
    deps,
  );
  assert.equal(alerts.status, 200);
  assert.equal(alerts.body.alerts, true);
  assert.match(alerts.body.summary || "", /inbox/);
  assert.equal(calls.at(-1)?.email, "guest-alerts@example.com");
  assert.equal(calls.at(-1)?.casl_consent, "yes");
  assert.equal(consentHook, 1);
  assert.equal((await ledger("guest-alerts@example.com"))?.alerts_consent, true);
  let uncheckedHook = 0;
  await runGuestMatch(guest({ email: "guest-noalerts@example.com", beforeWorker: async () => { uncheckedHook += 1; } }), deps);
  assert.equal(uncheckedHook, 0);
  assert.equal(calls.at(-1)?.email, "");

  // 5. Worker failure: no run used, network slot handed back, then a retry works
  const failIp = "203.0.113.50";
  for (const failure of ["error", "partial", "throw", "paused"]) {
    mode = failure;
    const netBefore = await networkCount();
    const failed = await runGuestMatch(guest({ email: "guest-fail@example.com", ip: failIp, runId: `fail-${failure}-run` }), deps);
    assert.notEqual(failed.status, 200, failure);
    assert.equal(failed.body.ok, false);
    assert.equal(await ledger("guest-fail@example.com"), null, `${failure} used the free run`);
    assert.equal(await networkCount(), netBefore, `${failure} kept the network slot`);
  }
  mode = "ok";
  assert.equal((await runGuestMatch(guest({ email: "guest-fail@example.com", ip: failIp }), deps)).status, 200);
  // A failure on a later run gives back only that run
  mode = "error";
  assert.notEqual((await runGuestMatch(guest({ email: "guest-fail@example.com", ip: failIp }), deps)).status, 200);
  mode = "ok";
  assert.equal((await ledger("guest-fail@example.com"))?.runs, 1);

  // 6. Per-network daily limit
  const sharedIp = "203.0.113.77";
  for (let i = 1; i <= GUEST_NETWORK_DAILY; i++) {
    const ok = await runGuestMatch(guest({ email: `net-${i}@example.com`, ip: sharedIp }), deps);
    assert.equal(ok.status, 200, `network run ${i}`);
  }
  before = calls.length;
  const netBlocked = await runGuestMatch(guest({ email: "net-over@example.com", ip: sharedIp }), deps);
  assert.equal(netBlocked.status, 429);
  assert.equal(netBlocked.body.code, "network");
  assert.equal(calls.length, before);
  assert.equal(await ledger("net-over@example.com"), null);
  const tomorrow = await runGuestMatch(guest({ email: "net-over@example.com", ip: sharedIp }), { ...deps, now: new Date(Date.now() + 86_400_000) });
  assert.equal(tomorrow.status, 200);
  const stored = await query<{ net_hash: string }>("select net_hash from match_free_networks");
  assert.ok(stored.length > 0);
  for (const row of stored) assert.match(row.net_hash, /^[0-9a-f]{64}$/);

  // 7. Server-side email check and honeypot
  before = calls.length;
  const badEmail = await runGuestMatch(guest({ email: "not-an-email" }), deps);
  assert.equal(badEmail.status, 400);
  assert.equal(badEmail.body.code, "email");
  const bot = await runGuestMatch(guest({ email: "bot@example.com", gotcha: "http://spam" }), deps);
  assert.equal(bot.status, 200);
  assert.equal(bot.body.shown, 0);
  assert.equal(await ledger("bot@example.com"), null);
  const shortResume = await runGuestMatch(guest({ email: "short@example.com", resumeText: "too short" }), deps);
  assert.equal(shortResume.status, 400);
  assert.equal(calls.length, before);

  // 8. Not configured: refuse before reserving anything
  const offline = await runGuestMatch(guest({ email: "offline@example.com" }), { ...deps, trustedSecret: "" });
  assert.equal(offline.status, 503);
  assert.equal(await ledger("offline@example.com"), null);

  // 9. Guest and free account share the 5 runs per email
  for (let i = 1; i <= 4; i++) {
    assert.equal((await runGuestMatch(guest({ email: "guest-later-account@example.com" }), deps)).status, 200);
  }
  const acct5 = await runMatch(
    { profileId: FREE_ID, email: "guest-later-account@example.com", isMember: false, resumeText: RESUME, consent: false },
    deps,
  );
  assert.equal(acct5.status, 200, JSON.stringify(acct5.body));
  assert.equal(acct5.body.shown, 10);
  assert.equal((await ledger("guest-later-account@example.com"))?.runs, 5);
  before = calls.length;
  const acct6 = await runMatch(
    { profileId: FREE_ID, email: "guest-later-account@example.com", isMember: false, resumeText: RESUME, consent: false },
    deps,
  );
  assert.equal(acct6.status, 429);
  assert.equal(acct6.body.error, MSG.freeUsed);
  assert.equal((await runGuestMatch(guest({ email: "guest-later-account@example.com" }), deps)).status, 429);
  assert.equal(calls.length, before);
  // Free-account runs recorded before the ledger existed still count for the guest form
  await query("delete from match_free_runs where email_key = $1", ["guest-later-account@example.com"]);
  await query("delete from resume_match_usage where profile_id = $1", [FREE_ID]);
  for (let i = 0; i < 5; i++) {
    await query("insert into resume_match_usage (profile_id, email_hash, used_on) values ($1, 'x', current_date)", [FREE_ID]);
  }
  assert.equal((await runGuestMatch(guest({ email: "guest-later-account@example.com" }), deps)).status, 429);
  await query("delete from resume_match_usage where profile_id = $1", [FREE_ID]);

  // 10. Paid member unaffected, even with guest records for the same email
  assert.equal((await runGuestMatch(guest({ email: "guest-member@example.com" }), deps)).status, 200);
  for (let i = 0; i < 3; i++) {
    const member = await runMatch(
      { profileId: MEMBER_ID, email: "guest-member@example.com", isMember: true, resumeText: RESUME, consent: false },
      deps,
    );
    assert.equal(member.status, 200);
    assert.equal(member.body.locked, 0);
    assert.equal(member.body.strong?.length, 8);
    assert.equal(member.body.maybe?.length, 6);
  }

  // 11. Ledger table missing (migration not applied): guests are refused before any AI spend,
  //     signed-in accounts keep working
  await query("alter table match_free_runs rename to match_free_runs_hidden");
  try {
    before = calls.length;
    const noTable = await runGuestMatch(guest({ email: "no-table@example.com", runId: "no-table-run-1" }), deps);
    assert.equal(noTable.status, 503);
    assert.equal(noTable.body.error, MSG.unavailable);
    assert.equal(calls.length, before);
    const member = await runMatch(
      { profileId: MEMBER_ID, email: "guest-member@example.com", isMember: true, resumeText: RESUME, consent: false },
      deps,
    );
    assert.equal(member.status, 200);
    const free = await runMatch(
      { profileId: FREE_ID, email: "guest-later-account@example.com", isMember: false, resumeText: RESUME, consent: false },
      deps,
    );
    assert.equal(free.status, 200);
    await query("delete from resume_match_usage where profile_id = $1", [FREE_ID]);
  } finally {
    await query("alter table match_free_runs_hidden rename to match_free_runs");
  }

  // 12. Duplicate submits (same email + run id)
  assert.equal(cleanRunId("abc").fromClient, false);
  assert.equal(cleanRunId("2b7f4c1e-8d0a-4a51-9a3e-0f6c2b1d9e77").fromClient, true);
  assert.equal(cleanRunId("bad id with spaces").fromClient, false);
  //   a) concurrent copies: both get results, the run and the network slot are counted once
  let netBefore = await networkCount();
  before = calls.length;
  const [a, b] = await Promise.all([
    runGuestMatch(guest({ email: "race@example.com", runId: "race-run-0001", ip: "203.0.113.90" }), deps),
    runGuestMatch(guest({ email: "race@example.com", runId: "race-run-0001", ip: "203.0.113.90" }), deps),
  ]);
  assert.deepEqual([a.status, b.status], [200, 200], JSON.stringify([a.body, b.body]));
  assert.deepEqual([a.body.repeat, b.body.repeat].sort(), [false, true]);
  assert.equal((await ledger("race@example.com"))?.runs, 1);
  assert.equal(await networkCount(), netBefore + 1);
  assert.equal(calls.length, before + 2);
  //   b) a later resend (the browser never saw the first answer) is the same run
  const resend = await runGuestMatch(guest({ email: "race@example.com", runId: "race-run-0001", browserRuns: 0 }), deps);
  assert.equal(resend.status, 200);
  assert.equal(resend.body.repeat, true);
  assert.equal((await ledger("race@example.com"))?.runs, 1);
  //   c) repeats of one run id are capped
  before = calls.length;
  const capped = await runGuestMatch(guest({ email: "race@example.com", runId: "race-run-0001" }), deps);
  assert.equal(capped.status, 429);
  assert.equal(calls.length, before);
  assert.equal((await ledger("race@example.com"))?.runs, 1);
  //   d) a new run id is a new run
  const next = await runGuestMatch(guest({ email: "race@example.com", runId: "race-run-0002" }), deps);
  assert.equal(next.status, 200);
  assert.equal(next.body.repeat, false);
  assert.equal((await ledger("race@example.com"))?.runs, 2);
  //   e) the same run id after the window is a new run
  await query("update match_free_runs set run_id_at = now() - interval '6 minutes' where email_key = 'race@example.com'");
  const late = await runGuestMatch(guest({ email: "race@example.com", runId: "race-run-0002" }), deps);
  assert.equal(late.status, 200);
  assert.equal(late.body.repeat, false);
  assert.equal((await ledger("race@example.com"))?.runs, 3);
  //   f) the duplicate of the 5th run is not blocked and does not make a 6th
  await query("update match_free_runs set runs = 4 where email_key = 'race@example.com'");
  const fifth = await runGuestMatch(guest({ email: "race@example.com", runId: "race-run-0005" }), deps);
  assert.equal(fifth.status, 200);
  const fifthAgain = await runGuestMatch(guest({ email: "race@example.com", runId: "race-run-0005", browserRuns: 4 }), deps);
  assert.equal(fifthAgain.status, 200);
  assert.equal(fifthAgain.body.repeat, true);
  assert.equal((await ledger("race@example.com"))?.runs, 5);
  assert.equal((await runGuestMatch(guest({ email: "race@example.com", runId: "race-run-0006" }), deps)).status, 429);
  //   g) if the first copy failed, a resend runs as a new counted run
  mode = "error";
  assert.notEqual((await runGuestMatch(guest({ email: "flaky@example.com", runId: "flaky-run-001" }), deps)).status, 200);
  mode = "ok";
  assert.equal(await ledger("flaky@example.com"), null);
  const flakyResend = await runGuestMatch(guest({ email: "flaky@example.com", runId: "flaky-run-001" }), deps);
  assert.equal(flakyResend.status, 200);
  assert.equal(flakyResend.body.repeat, false);
  assert.equal((await ledger("flaky@example.com"))?.runs, 1);
  //   h) a failed repeat gives nothing back (it never counted)
  mode = "error";
  assert.notEqual((await runGuestMatch(guest({ email: "flaky@example.com", runId: "flaky-run-001" }), deps)).status, 200);
  mode = "ok";
  assert.equal((await ledger("flaky@example.com"))?.runs, 1);
  //   i) concurrent different run ids at the last run: only one gets it
  await query("update match_free_runs set runs = 4, run_id = null where email_key = 'flaky@example.com'");
  netBefore = calls.length;
  const [x, y] = await Promise.all([
    runGuestMatch(guest({ email: "flaky@example.com", runId: "flaky-run-00x" }), deps),
    runGuestMatch(guest({ email: "flaky@example.com", runId: "flaky-run-00y" }), deps),
  ]);
  assert.deepEqual([x.status, y.status].sort(), [200, 429]);
  assert.equal(calls.length, netBefore + 1);
  assert.equal((await ledger("flaky@example.com"))?.runs, 5);

  // 13. Retention: free-match emails deleted 90 days after the last run, network rows after 7 days
  assert.equal(FREE_MATCH_RETENTION_DAYS, 90);
  await query("delete from match_free_runs where email_key like '%@example.com'");
  await query("delete from match_free_networks");
  await query(
    `insert into match_free_runs (email_key, email, created_at, last_run_at) values
       ('old@example.com', 'old@example.com', now() - interval '91 days', now() - interval '91 days'),
       ('edge@example.com', 'edge@example.com', now() - interval '89 days', now() - interval '89 days'),
       ('rerun@example.com', 'rerun@example.com', now() - interval '200 days', now() - interval '10 days'),
       ('fresh@example.com', 'fresh@example.com', now(), now())`,
  );
  await query(
    `insert into match_free_networks (net_hash, used_on, n) values
       ('a', (now() at time zone 'America/Toronto')::date - 8, 1),
       ('b', (now() at time zone 'America/Toronto')::date - 6, 1),
       ('c', (now() at time zone 'America/Toronto')::date, 1)`,
  );
  const purged = await purgeFreeMatchRecords();
  assert.deepEqual(purged, { freeRunsDeleted: 1, networksDeleted: 1 });
  assert.equal(await ledger("old@example.com"), null);
  assert.ok(await ledger("edge@example.com"));
  assert.ok(await ledger("rerun@example.com"));
  assert.ok(await ledger("fresh@example.com"));
  const nets = await query<{ net_hash: string }>("select net_hash from match_free_networks order by net_hash");
  assert.deepEqual(nets.map((r) => r.net_hash), ["b", "c"]);
  // After deletion the same email can have another free run (accepted)
  assert.equal((await runGuestMatch(guest({ email: "old@example.com" }), deps)).status, 200);
  // Missing table: reports an error, never throws
  await query("alter table match_free_runs rename to match_free_runs_hidden");
  try {
    const missing = await purgeFreeMatchRecords();
    assert.ok("error" in missing);
  } finally {
    await query("alter table match_free_runs_hidden rename to match_free_runs");
  }

  console.log("guest match tests passed");
} finally {
  await cleanup();
  const pool = (await import("../web/lib/db.ts")).getPool();
  await pool.end();
}
