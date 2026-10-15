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
