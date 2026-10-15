import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applicationKey, hideAppliedHits, isMarkedApplied } from "../web/lib/application-key.ts";

assert.equal(applicationKey("/jobs/ttc/operator/"), "jobs/ttc/operator");
assert.equal(applicationKey("jobs/ttc/operator"), "jobs/ttc/operator");
assert.equal(applicationKey("https://publicjobs.ca/jobs/ttc/operator/?q=1"), "jobs/ttc/operator");
assert.equal(applicationKey("https://publicjobs.ca/employers/ttc/"), null);
assert.equal(applicationKey(""), null);
assert.equal(applicationKey("/jobs/ttc/"), null);

const applied = new Set(["jobs/ttc/operator"]);
assert.equal(isMarkedApplied("https://publicjobs.ca/jobs/ttc/operator/", applied), true);
assert.equal(isMarkedApplied("/jobs/ttc/clerk/", applied), false);

const hits = [
  { url: "https://publicjobs.ca/jobs/ttc/operator/", title: "Operator" },
  { url: "/jobs/ttc/clerk/", title: "Clerk" },
];
assert.deepEqual(
  hideAppliedHits(hits, applied, false).map((hit) => hit.title),
  ["Operator", "Clerk"],
);
assert.deepEqual(
  hideAppliedHits(hits, applied, true).map((hit) => hit.title),
  ["Clerk"],
);

const matchRoute = readFileSync(new URL("../web/app/api/match/route.ts", import.meta.url), "utf8");
const matchLib = readFileSync(new URL("../web/lib/match.ts", import.meta.url), "utf8");
const publicJob = readFileSync(
  new URL("../web/app/(public)/jobs/[employer]/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const applyRow = readFileSync(new URL("../web/components/ApplyRow.tsx", import.meta.url), "utf8");

assert.match(matchRoute, /reportEvent\(\s*"match_run"/);
assert.equal(matchRoute.includes("applications"), false);
assert.equal(matchRoute.includes("mark_applied"), false);
assert.equal(matchLib.includes("applications"), false);
assert.equal(matchLib.includes("mark_applied"), false);
assert.equal(publicJob.includes("revalidate = 900"), true);
assert.equal(publicJob.includes("applications"), false);
assert.equal(publicJob.includes("getViewer"), false);
assert.equal(applyRow.includes("onClick"), false);
assert.equal(applyRow.includes("applications"), false);

console.log("application checks passed");

// Jobs I applied to (account page). Pure helpers and wiring.
import { appliedEntryHref, safeHttpUrl } from "../web/lib/application-key.ts";

assert.equal(safeHttpUrl("https://jobs.ttc.ca/job/123"), "https://jobs.ttc.ca/job/123");
assert.equal(safeHttpUrl("javascript:alert(1)"), "");
assert.equal(safeHttpUrl("not a url"), "");
assert.equal(safeHttpUrl(""), "");
assert.equal(appliedEntryHref("jobs/ttc/operator", true), "/jobs/ttc/operator/");
assert.equal(appliedEntryHref("jobs/ttc/operator", false), "");
assert.equal(appliedEntryHref("../evil", true), "");

const appliedPage = readFileSync(new URL("../web/app/(info)/account/applied/page.tsx", import.meta.url), "utf8");
const appliedLib = readFileSync(new URL("../web/lib/applications.ts", import.meta.url), "utf8");
const snapshotSql = readFileSync(
  new URL("../supabase/migrations/20261015200000_applications_snapshot.sql", import.meta.url),
  "utf8",
);
assert.match(appliedPage, /if \(!viewer\.isMember\)/, "non-members get the upgrade prompt");
assert.match(appliedPage, /href="\/pricing\/"/);
assert.match(appliedPage, /Posting closed/);
assert.equal(appliedPage.includes("delete from"), false, "a lapsed membership never deletes marks");
assert.match(appliedLib, /left join jobs j on j\.id = a\.job_id/, "list reads the stored copy, not only live jobs");
assert.match(snapshotSql, /alter table public\.applications owner to publicjobs_app/);
assert.equal(/on delete cascade/.test(snapshotSql), false);

console.log("applied history checks passed");

// 30-day retention wiring.
const cleanupRoute = readFileSync(new URL("../web/app/api/cron/applied-cleanup/route.ts", import.meta.url), "utf8");
const retentionLib = readFileSync(new URL("../web/lib/applied-retention.ts", import.meta.url), "utf8");
const vercelJson = JSON.parse(readFileSync(new URL("../web/vercel.json", import.meta.url), "utf8")) as {
  crons: { path: string }[];
};
assert.match(cleanupRoute, /Bearer \$\{secret\}/, "cleanup cron requires CRON_SECRET");
assert.ok(vercelJson.crons.some((cron) => cron.path === "/api/cron/applied-cleanup/"));
assert.match(retentionLib, /p\.membership_status <> 'active'/, "active members are never purged");
assert.match(retentionLib, /APPLIED_RETENTION_DAYS = 30/);
console.log("applied retention checks passed");
