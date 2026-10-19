import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FREE_RESULTS,
  GUEST_NETWORK_DAILY,
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
  return { email: "", resumeText: RESUME, consent: false, usedCookie: false, ip: `198.51.100.${ipSeq}`, ...over };
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

  // 2. Second run, same email: blocked before the Worker, with membership and sign-in links
  let before = calls.length;
  const again = await runGuestMatch(guest({ email: "guest.one+again@example.com" }), deps);
  assert.equal(again.status, 429);
  assert.equal(again.body.code, "free_used");
  assert.equal(again.body.error, MSG.guestUsed);
  assert.equal(again.body.upgrade, "/pricing/");
  assert.equal(again.body.login, "/login/?next=/match/");
  assert.equal(calls.length, before);

  // Gmail dots and +tags count as the same person
  assert.equal((await runGuestMatch(guest({ email: "first.last@gmail.com" }), deps)).status, 200);
  before = calls.length;
  const dotted = await runGuestMatch(guest({ email: "FirstLast+2@googlemail.com" }), deps);
  assert.equal(dotted.status, 429);
  assert.equal(calls.length, before);

  // 3. Second run, same browser (cookie), new email: blocked, nothing reserved
  const cookieBlocked = await runGuestMatch(guest({ email: "new-browser@example.com", usedCookie: true }), deps);
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
  // Unchecked never calls the consent hook
  let uncheckedHook = 0;
  await runGuestMatch(guest({ email: "guest-noalerts@example.com", beforeWorker: async () => { uncheckedHook += 1; } }), deps);
  assert.equal(uncheckedHook, 0);

  // 5. Worker failure: no run used, network slot handed back, then a retry works
  const failIp = "203.0.113.50";
  for (const failure of ["error", "partial", "throw", "paused"]) {
    mode = failure;
    const netBefore = await networkCount();
    const failed = await runGuestMatch(guest({ email: "guest-fail@example.com", ip: failIp }), deps);
    assert.notEqual(failed.status, 200, failure);
    assert.equal(failed.body.ok, false);
    assert.equal(await ledger("guest-fail@example.com"), null, `${failure} used the free run`);
    assert.equal(await networkCount(), netBefore, `${failure} kept the network slot`);
  }
  mode = "ok";
  assert.equal((await runGuestMatch(guest({ email: "guest-fail@example.com", ip: failIp }), deps)).status, 200);

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
  // The next Toronto day is a fresh count
  const tomorrow = await runGuestMatch(guest({ email: "net-over@example.com", ip: sharedIp }), { ...deps, now: new Date(Date.now() + 86_400_000) });
  assert.equal(tomorrow.status, 200);
  // Raw IPs are never stored
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

  // 9. Guest first, then a free account with the same email: the account does not get a second free run
  assert.equal((await runGuestMatch(guest({ email: "guest-later-account@example.com" }), deps)).status, 200);
  before = calls.length;
  const acct = await runMatch(
    { profileId: FREE_ID, email: "guest-later-account@example.com", isMember: false, resumeText: RESUME, consent: false },
    deps,
  );
  assert.equal(acct.status, 429);
  assert.equal(acct.body.error, MSG.freeUsed);
  assert.equal(calls.length, before);

  // Free account first, then the guest form with that email: blocked too
  await query("delete from match_free_runs where email_key = $1", ["guest-later-account@example.com"]);
  const acctFirst = await runMatch(
    { profileId: FREE_ID, email: "guest-later-account@example.com", isMember: false, resumeText: RESUME, consent: false },
    deps,
  );
  assert.equal(acctFirst.status, 200);
  assert.equal(acctFirst.body.shown, 10);
  assert.equal(acctFirst.body.locked, 4);
  assert.equal((await ledger("guest-later-account@example.com"))?.source, "account");
  before = calls.length;
  const guestAfter = await runGuestMatch(guest({ email: "guest-later-account@example.com" }), deps);
  assert.equal(guestAfter.status, 429);
  assert.equal(calls.length, before);

  // 10. Paid member unaffected, even with a guest record for the same email
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
    const noTable = await runGuestMatch(guest({ email: "no-table@example.com" }), deps);
    assert.equal(noTable.status, 503);
    assert.equal(noTable.body.error, MSG.unavailable);
    assert.equal(calls.length, before);
    const member = await runMatch(
      { profileId: MEMBER_ID, email: "guest-member@example.com", isMember: true, resumeText: RESUME, consent: false },
      deps,
    );
    assert.equal(member.status, 200);
    await query("delete from resume_match_usage where profile_id = $1", [FREE_ID]);
    const free = await runMatch(
      { profileId: FREE_ID, email: "guest-later-account@example.com", isMember: false, resumeText: RESUME, consent: false },
      deps,
    );
    assert.equal(free.status, 200);
  } finally {
    await query("alter table match_free_runs_hidden rename to match_free_runs");
  }

  // 12. Two requests at once for the same email: only one runs
  before = calls.length;
  const [a, b] = await Promise.all([
    runGuestMatch(guest({ email: "race@example.com" }), deps),
    runGuestMatch(guest({ email: "race@example.com" }), deps),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 429]);
  assert.equal(calls.length, before + 1);

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
