import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WEEKLY_CANDIDATE_SQL,
  WEEKLY_MIN_REASON_WORDS,
  WEEKLY_RESULT_CAP,
  WEEKLY_SPEND_SLICE_USD,
  assumedCostUsd,
  canEnableWeeklyEmail,
  cronAuthorized,
  isTorontoSaturday,
  prepareResumeText,
  reasonWordCount,
  runWeeklyQueue,
  selectTightMatches,
  showWeeklyMatchTools,
  weeklyCallTimeout,
  weeklyMemberGuard,
  weeklyReadyEmail,
  weeklySampleEmail,
  type TightHit,
  type WeeklyCandidate,
} from "../web/lib/weekly-match.ts";

function hit(title: string, reason: string, fitNote = ""): TightHit {
  return {
    title,
    employer: "City of Toronto",
    location: "Toronto",
    closing_date: "2026-11-06",
    url: `https://publicjobs.ca/jobs/city-of-toronto/${title.toLowerCase().replace(/\s+/g, "-")}/`,
    reason: fitNote || reason,
  };
}

const longReason = "Your eight years at a public counter fit this clerk role.";
assert.ok(reasonWordCount(longReason) >= WEEKLY_MIN_REASON_WORDS);
assert.equal(reasonWordCount("Your experience matches this role."), 5);

const strong = [
  hit("Short", "Too short to keep."),
  ...Array.from({ length: 20 }, (_, index) => hit(`Clerk ${index + 1}`, longReason)),
];
const maybe = [hit("Stretch role", "Your transferable skills might fit this different kind of work later.")];
const tight = selectTightMatches(strong, maybe);
assert.equal(tight.length, WEEKLY_RESULT_CAP);
assert.equal(tight.some((row) => row.title === "Short"), false);
assert.equal(tight.some((row) => row.title === "Stretch role"), false);
assert.equal(tight[0]?.title, "Clerk 1");

assert.equal(showWeeklyMatchTools(false), false);
assert.equal(showWeeklyMatchTools(true), true);
assert.equal(canEnableWeeklyEmail(false, true), false);
assert.equal(canEnableWeeklyEmail(true, false), false);
assert.equal(canEnableWeeklyEmail(true, true), true);

assert.deepEqual(weeklyMemberGuard({ email: null, profile: null, isMember: false }), {
  ok: false,
  status: 401,
  error: "Sign in to use weekly matches.",
});
assert.equal(weeklyMemberGuard({ email: "free@example.com", profile: { id: "1" }, isMember: false }).ok, false);
assert.equal(
  weeklyMemberGuard({ email: "free@example.com", profile: { id: "1" }, isMember: false }).status,
  403,
);
assert.deepEqual(weeklyMemberGuard({ email: "member@example.com", profile: { id: "1" }, isMember: true }), { ok: true });

assert.equal(cronAuthorized(null, undefined), "missing");
assert.equal(cronAuthorized("Bearer no", "secret"), "denied");
assert.equal(cronAuthorized("Bearer secret", "secret"), "ok");

assert.equal(isTorontoSaturday(new Date("2026-10-24T13:00:00Z")), true);
assert.equal(isTorontoSaturday(new Date("2026-10-23T13:00:00Z")), false);
assert.equal(weeklyCallTimeout(0), 100_000);
assert.equal(weeklyCallTimeout(80_000), 30_000);
assert.equal(weeklyCallTimeout(100_000), null);
assert.equal(assumedCostUsd(null), 0.25);
assert.equal(assumedCostUsd(0.04), 0.04);

const prepared = prepareResumeText("  word ".repeat(30));
assert.equal(prepared.ok, true);
assert.equal(prepareResumeText("too short").ok, false);

const mail = weeklyReadyEmail({
  customerName: "Avery",
  accountUrl: "https://publicjobs.ca/account/#weekly-matches",
  unsubscribeUrl: "https://publicjobs.ca/api/weekly-matches/unsubscribe/?token=abc",
});
assert.equal(mail.subject, "Your weekly matches are ready");
assert.match(mail.text, /603-65 Thorncliffe Park Drive/);
assert.match(mail.text, /account\/#weekly-matches/);
assert.match(mail.text, /Stop these emails/);
assert.match(mail.html, /unsubscribe/);
assert.equal(mail.html.includes("Clerk"), false);
assert.equal(mail.text.includes("City of Toronto"), false);
assert.match(weeklySampleEmail().text, /dry-run-token-not-real/);
assert.match(WEEKLY_CANDIDATE_SQL, /membership_status = 'active'/);
assert.match(WEEKLY_CANDIDATE_SQL, /opted_in = true/);
assert.match(WEEKLY_CANDIDATE_SQL, /current_period_end/);
assert.match(WEEKLY_CANDIDATE_SQL, /saved_resumes/);

const accountPage = readFileSync(new URL("../web/app/(info)/account/page.tsx", import.meta.url), "utf8");
assert.match(accountPage, /showWeeklyMatchTools/);
const resumeRoute = readFileSync(new URL("../web/app/api/account/resume/route.ts", import.meta.url), "utf8");
const emailRoute = readFileSync(new URL("../web/app/api/account/weekly-email/route.ts", import.meta.url), "utf8");
const cronRoute = readFileSync(new URL("../web/app/api/cron/weekly-matches/route.ts", import.meta.url), "utf8");
assert.match(resumeRoute, /weeklyMemberGuard/);
assert.match(emailRoute, /weeklyMemberGuard/);
assert.match(emailRoute, /canEnableWeeklyEmail/);
assert.match(cronRoute, /cronAuthorized/);
assert.match(cronRoute, /dry_run/);
assert.match(readFileSync(new URL("../web/lib/account-delete.ts", import.meta.url), "utf8"), /saved_resumes/);

function candidate(id: string): WeeklyCandidate {
  return {
    profileId: id,
    email: `${id}@example.com`,
    customerName: "Avery",
    resumeText: "Customer service lead at a public counter for eight years, handling cash and training new staff in Toronto.",
    unsubscribeToken: "abcdefghijklmnopqrstuvwxyz012345",
  };
}

const calls: string[] = [];
const logs: { profileId: string | null; outcome: string }[] = [];
const saved: string[] = [];
const sent: string[] = [];

const paused = await runWeeklyQueue({
  now: new Date("2026-10-24T13:00:00Z"),
  dryRun: false,
  candidates: [candidate("a"), candidate("b")],
  spentUsd: 0,
  blockedReason: null,
  startedAt: Date.now(),
  callWorker: async (_resume, _timeout) => {
    calls.push("paused");
    return { ok: false, code: "paused" };
  },
  saveResult: async (profileId) => {
    saved.push(profileId);
  },
  logRow: async (profileId, _day, outcome) => {
    logs.push({ profileId, outcome });
  },
  sendEmail: async (person) => {
    sent.push(person.profileId);
    return "sent";
  },
  markEmailed: async () => {},
});
assert.equal(paused.calls, 1);
assert.equal(paused.skipped, "spend");
assert.equal(paused.deferred, 2);
assert.equal(saved.length, 0);
assert.equal(sent.length, 0);
assert.equal(logs.some((row) => row.outcome === "deferred_spend" && row.profileId === null), true);

calls.length = 0;
logs.length = 0;
const zero = await runWeeklyQueue({
  now: new Date("2026-10-24T14:00:00Z"),
  dryRun: false,
  candidates: [candidate("c")],
  spentUsd: 0,
  blockedReason: null,
  callWorker: async () => ({
    ok: true,
    strong: [hit("Clerk", "Too short.")],
    maybe: [hit("Stretch", longReason)],
    jobsChecked: 40,
    estCostUsd: 0.05,
  }),
  saveResult: async (profileId, jobs) => {
    saved.push(`${profileId}:${jobs.length}`);
  },
  logRow: async (profileId, _day, outcome, detail) => {
    logs.push({ profileId, outcome });
    assert.match(detail, /strong=0/);
  },
  sendEmail: async () => {
    throw new Error("should not email");
  },
  markEmailed: async () => {
    throw new Error("should not mark");
  },
});
assert.equal(zero.matched, 1);
assert.equal(zero.emailed, 0);
assert.equal(saved.at(-1), "c:0");

const budget = await runWeeklyQueue({
  now: new Date("2026-10-24T15:00:00Z"),
  dryRun: false,
  candidates: [candidate("d")],
  spentUsd: WEEKLY_SPEND_SLICE_USD,
  blockedReason: null,
  callWorker: async () => {
    throw new Error("should not call");
  },
  saveResult: async () => {},
  logRow: async (profileId, _day, outcome) => {
    logs.push({ profileId, outcome });
  },
  sendEmail: async () => "sent",
  markEmailed: async () => {},
});
assert.equal(budget.calls, 0);
assert.equal(budget.skipped, "budget");
assert.equal(logs.some((row) => row.outcome === "deferred_budget"), true);

const dry = await runWeeklyQueue({
  now: new Date("2026-10-23T15:00:00Z"),
  dryRun: true,
  candidates: [candidate("e")],
  spentUsd: 0,
  blockedReason: null,
  callWorker: async () => {
    throw new Error("dry run must not call");
  },
  saveResult: async () => {
    throw new Error("dry run must not save");
  },
  logRow: async () => {
    throw new Error("dry run must not log");
  },
  sendEmail: async () => {
    throw new Error("dry run must not send");
  },
  markEmailed: async () => {},
});
assert.equal(dry.skipped, "dry_run");
assert.equal(dry.calls, 0);
assert.match(dry.sampleEmail?.text || "", /Stop these emails/);
assert.equal((dry.sampleEmail?.html || "").includes("Clerk"), false);

const weekday = await runWeeklyQueue({
  now: new Date("2026-10-23T15:00:00Z"),
  dryRun: false,
  candidates: [candidate("f")],
  spentUsd: 0,
  blockedReason: null,
  callWorker: async () => {
    throw new Error("weekday must not call");
  },
  saveResult: async () => {},
  logRow: async () => {},
  sendEmail: async () => "sent",
  markEmailed: async () => {},
});
assert.equal(weekday.skipped, "not_saturday");
assert.equal(weekday.calls, 0);

console.log("weekly match tests passed");
