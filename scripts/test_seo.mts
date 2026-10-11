import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { displayPostedDate, employerPostingDate, parseLooseDate, validThrough } from "../web/lib/dates.ts";
import { homeCopy } from "../web/lib/home-copy.ts";
import { displayFilterLocation, locationCities, normalizeLocation } from "../web/lib/location.ts";
import { selectSimilarJobs, type SimilarJobCandidate } from "../web/lib/similar-jobs.ts";
import { displayPageTitle, displayTitle, isShoutyTitle } from "../web/lib/titles.ts";
import { INDEXNOW_KEY_RE, indexNowBody, loadServiceAccount } from "./notify_indexing.ts";

const listings = JSON.parse(readFileSync(new URL("../data/listings.json", import.meta.url), "utf8")) as {
  title?: string;
  employer?: string;
  location?: string;
  description?: string;
  posted_date?: string;
}[];

const labourer = listings.find(
  (job) =>
    (job.employer || "").includes("Richmond Hill") &&
    (job.title || "").includes("Seasonal Labourer") &&
    (job.description || "").includes("Posting Date"),
);
assert.ok(labourer, "Richmond Hill Seasonal Labourer fixture");
assert.equal(
  employerPostingDate({ description: labourer?.description || "", fields: {} }),
  "2026-08-17",
);
assert.equal(
  displayPostedDate({
    description: labourer?.description || "",
    firstCollected: "2026-10-10",
  }),
  "2026-08-17",
);
assert.equal(
  displayPostedDate({
    employerPosted: "2026-08-17",
    description: "Posting Date\n01/01/2026",
    firstCollected: "2026-10-10",
  }),
  "2026-08-17",
);
assert.equal(displayPostedDate({ firstCollected: "2026-10-10" }), "2026-10-10");
assert.equal(employerPostingDate({ description: "Unposting Date\n08/17/2026", fields: {} }), "");
assert.equal(
  employerPostingDate({ description: "Application Deadline\n10/26/2026\n\nThe job starts soon.", fields: {} }),
  "",
);
assert.equal(employerPostingDate({ description: "Posting Date: 10-2-2026", fields: {} }), "2026-10-02");
assert.equal(employerPostingDate({ description: "Posted On: October 7, 2026", fields: {} }), "2026-10-07");
assert.equal(parseLooseDate("5 October 2026"), "2026-10-05");
assert.equal(parseLooseDate("02/31/2026"), "");
assert.equal(employerPostingDate({ fields: { posted_date: "2026-10-10", posting_date: "2026-08-17" } }), "2026-08-17");

assert.equal(validThrough("2026-10-26"), "2026-10-26T23:59:00-04:00");
assert.equal(validThrough("2026-01-15"), "2026-01-15T23:59:00-05:00");
assert.equal(validThrough(""), "");
assert.equal(validThrough("2026-11-01"), "2026-11-01T23:59:00-05:00");

assert.equal(normalizeLocation("Richmond Hill"), "Richmond Hill, ON");
assert.equal(normalizeLocation("Richmondhill"), "Richmond Hill, ON");
assert.equal(normalizeLocation("RICHMOND HILL"), "Richmond Hill, ON");
assert.equal(normalizeLocation("Montreal"), "Montreal, QC");
assert.equal(normalizeLocation("Montréal"), "Montreal, QC");
assert.equal(normalizeLocation("Montréal, Quebec; Toronto, Ontario"), "Montreal, QC; Toronto, ON");
assert.equal(normalizeLocation("Calgary"), "Calgary, AB");
assert.equal(normalizeLocation("Calgary; Toronto"), "Calgary, AB; Toronto, ON");
assert.equal(normalizeLocation("New York"), "New York, NY");
assert.equal(normalizeLocation("New York; Toronto"), "New York, NY; Toronto, ON");
assert.equal(normalizeLocation("Regina, Saskatchewan; Toronto, Ontario"), "Regina, SK; Toronto, ON");
assert.equal(normalizeLocation("TORONT"), "Toronto, ON");
assert.equal(normalizeLocation("milton"), "Milton, ON");
assert.equal(normalizeLocation("Toronto, ON"), "Toronto, ON");
assert.equal(normalizeLocation("Toronto, ON"), normalizeLocation(normalizeLocation("Toronto, ON")));
assert.equal(normalizeLocation("1530 Markham Rd.; 850 Coxwell Ave."), "1530 Markham Rd.; 850 Coxwell Ave.");
assert.deepEqual(locationCities("1530 Markham Rd"), []);
assert.equal(
  normalizeLocation("3291 Stouffville Road, Whitchurch-Stouffville, Ontario"),
  "Whitchurch-Stouffville, ON",
);
assert.equal(normalizeLocation("Food & Beverage Toronto, Ontario"), "Toronto, ON");
assert.equal(normalizeLocation("London, ON"), "London, ON");
assert.equal(normalizeLocation("Ontario"), "Ontario");
assert.equal(displayFilterLocation("Toronto"), "Toronto, ON");
assert.equal(displayFilterLocation(""), "");

for (const job of listings) {
  const raw = job.location || "";
  const normalized = normalizeLocation(raw);
  const cities = locationCities(raw);
  if (cities.length) {
    assert.equal(normalized, cities.join("; "));
    for (const city of cities) assert.match(city, /, [A-Z]{2}$/);
  } else {
    assert.equal(normalized, raw.replace(/\s+/g, " ").trim());
  }
  assert.equal(normalizeLocation(normalized), normalized);
}

assert.equal(isShoutyTitle("HR CONSULTANT HEALTH & REHAB"), true);
assert.equal(displayTitle("HR CONSULTANT HEALTH & REHAB"), "HR Consultant Health & Rehab");
assert.equal(
  displayTitle("ANALYST, TRANSIT, SYSTEMS INTEGRATOR 1 (SERVICENOW DEVELOPER)"),
  "Analyst, Transit, Systems Integrator 1 (ServiceNow Developer)",
);
assert.equal(displayTitle("WINTER 2027 STUDENT - THRIVE VENTURE FUND"), "Winter 2027 Student - Thrive Venture Fund");
assert.equal(displayTitle("IT GIS TTC LTC OLG CUPE HR"), "IT GIS TTC LTC OLG CUPE HR");
assert.equal(displayTitle("ANALYST, KNOW YOUR CLIENT - Toronto"), "ANALYST, KNOW YOUR CLIENT - Toronto");
assert.equal(displayTitle("Seasonal Labourer - Parks"), "Seasonal Labourer - Parks");
assert.equal(displayPageTitle("HR CONSULTANT HEAL | City", "HR CONSULTANT HEALTH & REHAB"), "HR Consultant Heal | City");

const shouty = listings.filter((job) => isShoutyTitle(job.title || ""));
assert.ok(shouty.length > 0);
for (const job of shouty) {
  const shown = displayTitle(job.title || "");
  assert.equal(isShoutyTitle(shown), false);
  assert.notEqual(shown, job.title);
}
for (const job of listings) {
  if (!isShoutyTitle(job.title || "")) assert.equal(displayTitle(job.title || ""), job.title || "");
}

const similarSource = {
  id: "current",
  category: "operations",
  employerSlug: "city-of-richmond-hill",
  cities: ["Richmond Hill"],
};
const similarCandidate: SimilarJobCandidate = {
  id: "other",
  title: "HR CONSULTANT HEALTH & REHAB",
  employer: "City of Richmond Hill",
  employerSlug: "city-of-richmond-hill",
  category: "operations",
  cities: ["Richmond Hill"],
  location: "Richmondhill",
  closing: "2026-10-26",
  type: "Temporary",
  path: "jobs/city-of-richmond-hill/hr-consultant",
};
const similar = selectSimilarJobs(similarSource, [similarCandidate]);
assert.equal(similar[0]?.title, "HR Consultant Health & Rehab");
assert.equal(similar[0]?.location, "Richmond Hill, ON");

const names = [
  "City of Toronto",
  "Toronto Transit Commission",
  "Metrolinx",
  "Toronto Hydro Corporation",
  "Ontario Lottery and Gaming Corporation (OLG)",
];
for (const name of names) {
  assert.ok(
    listings.some((job) => job.employer === name),
    name,
  );
}
const copy = homeCopy(66, names);
assert.equal(
  copy.description,
  "Current openings at the City of Toronto, TTC, Metrolinx, Toronto Hydro, OLG and 61 other GTA public employers, collected every weekday. Apply free on each employer's site.",
);
assert.equal(
  copy.subhead,
  "The City of Toronto, TTC, Metrolinx, Toronto Hydro, OLG and 61 other GTA public employers.",
);
assert.equal(
  homeCopy(5, names).description,
  "Current openings at the City of Toronto, TTC, Metrolinx, Toronto Hydro, and OLG, collected every weekday. Apply free on each employer's site.",
);
assert.doesNotMatch(copy.description, /50\+|more than 50|more than 60/);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
const slugs = new Set(listings.map((job) => slugify(job.employer || "")).filter(Boolean));
const profiles = JSON.parse(readFileSync(new URL("../web/data/employers.json", import.meta.url), "utf8")) as Record<
  string,
  { level?: string; intro?: string }
>;
assert.equal(slugs.size, 66);
const levels = new Set(["municipal", "provincial", "federal", "agency"]);
for (const slug of slugs) {
  const profile = profiles[slug];
  assert.ok(profile, slug);
  assert.ok(levels.has(profile.level || ""), slug);
  assert.ok((profile.intro || "").trim(), slug);
  assert.doesNotMatch(profile.intro || "", /\d/);
}
assert.equal(profiles["city-of-richmond-hill"]?.level, "municipal");

assert.equal(INDEXNOW_KEY_RE.test("abcd1234"), true);
assert.equal(INDEXNOW_KEY_RE.test("short"), false);
assert.equal(indexNowBody("https://publicjobs.ca/", "abcd1234", ["https://publicjobs.ca/jobs/a/"]).keyLocation, "https://publicjobs.ca/indexnow.txt/");
assert.throws(() => loadServiceAccount("{}"), /client_email/);

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const skipped = spawnSync("node", ["--experimental-strip-types", "scripts/notify_indexing.ts"], {
  cwd: repoRoot,
  env: { ...process.env, GOOGLE_INDEXING_SA_JSON: "", INDEXNOW_KEY: "" },
  encoding: "utf8",
});
assert.equal(skipped.status, 0, skipped.stderr);
assert.match(skipped.stdout, /skipped/);

const badKey = spawnSync("node", ["--experimental-strip-types", "scripts/notify_indexing.ts"], {
  cwd: repoRoot,
  env: { ...process.env, GOOGLE_INDEXING_SA_JSON: "", INDEXNOW_KEY: "bad key" },
  encoding: "utf8",
});
assert.equal(badKey.status, 1);
assert.match(badKey.stderr, /INDEXNOW_KEY/);

console.log("seo dates, locations, titles ok");
