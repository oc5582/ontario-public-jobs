import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PAYWALL_HIGH_SALARY } from "../web/lib/paywall.ts";
import { EXCLUDED_SOURCE_KEYS, OPEN_JOB_SQL } from "../web/lib/open-job.ts";
import {
  buildPublicJobStats,
  CLOSING_WINDOW_DAYS,
  closesWithin7Days,
  datasetDescription,
  datasetJsonLd,
  formatAsOfLabel,
  salaryBandId,
  salaryPercent,
  statsSql,
  statsToCsv,
  statsToJson,
  type PublicJobStats,
} from "../web/lib/stats.ts";

const SITE = "https://publicjobs.ca";

function bands(withSalary: number) {
  return {
    under_60: withSalary,
    from_60_to_80: 0,
    from_80_to_100: 0,
    from_100_to_120: 0,
    from_120: 0,
  };
}

function employer(overrides: Record<string, unknown> = {}) {
  return {
    slug: "city-of-toronto",
    name: "City of Toronto",
    open_jobs: 10,
    with_salary: 4,
    salary_min: 45000,
    salary_max: 150000,
    closing_in_7_days: 3,
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}) {
  const openJobs = (overrides.open_jobs as number | undefined) ?? 10;
  const withSalary = (overrides.with_salary as number | undefined) ?? 4;
  const closing = (overrides.closing_in_7_days as number | undefined) ?? 3;
  return {
    as_of: "2026-10-20T22:00:00.000Z",
    open_jobs: openJobs,
    with_salary: withSalary,
    closing_in_7_days: closing,
    no_closing_date: 2,
    median_posted_minimum: withSalary > 0 ? 89300 : null,
    top_of_range_at_least_100k: withSalary > 0 ? 2 : 0,
    posted_minimum: withSalary > 0 ? 45000 : null,
    posted_maximum: withSalary > 0 ? 150000 : null,
    employers: [
      employer({
        open_jobs: openJobs,
        with_salary: withSalary,
        closing_in_7_days: closing,
        salary_min: withSalary > 0 ? 45000 : null,
        salary_max: withSalary > 0 ? 150000 : null,
      }),
    ],
    cities: [{ city: "Toronto", open_jobs: openJobs }],
    bands: bands(withSalary),
    ...overrides,
  };
}

function build(overrides: Record<string, unknown> = {}): PublicJobStats {
  return buildPublicJobStats(row(overrides), { siteUrl: SITE });
}

function keysOf(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) keysOf(item, into);
    return into;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      into.add(key);
      keysOf(child, into);
    }
  }
  return into;
}

assert.equal(salaryPercent(393, 750), 52);
assert.equal(salaryPercent(0, 10), 0);
assert.equal(salaryPercent(1, 1), 100);
assert.equal(salaryPercent(1, 2), 50);
assert.equal(salaryPercent(1, 3), 33);
assert.equal(salaryPercent(2, 3), 67);
assert.equal(salaryPercent(64, 66), 97);
assert.throws(() => salaryPercent(1, 0), /no open jobs/);
assert.throws(() => salaryPercent(0, 0), /no open jobs/);
assert.throws(() => salaryPercent(5, 4), /salary count out of range/);

assert.equal(closesWithin7Days("2026-10-21", "2026-10-21"), true);
assert.equal(closesWithin7Days("2026-10-28", "2026-10-21"), true);
assert.equal(closesWithin7Days("2026-10-29", "2026-10-21"), false);
assert.equal(closesWithin7Days("2026-10-20", "2026-10-21"), false);
assert.equal(closesWithin7Days(null, "2026-10-21"), false);
assert.equal(closesWithin7Days("", "2026-10-21"), false);
assert.equal(closesWithin7Days("not-a-date", "2026-10-21"), false);
assert.equal(CLOSING_WINDOW_DAYS, 7);

assert.equal(salaryBandId(59999), "under_60");
assert.equal(salaryBandId(60000), "from_60_to_80");
assert.equal(salaryBandId(79999), "from_60_to_80");
assert.equal(salaryBandId(80000), "from_80_to_100");
assert.equal(salaryBandId(99999), "from_80_to_100");
assert.equal(salaryBandId(100000), "from_100_to_120");
assert.equal(salaryBandId(119999), "from_100_to_120");
assert.equal(salaryBandId(120000), "from_120");
assert.equal(salaryBandId(PAYWALL_HIGH_SALARY), "from_100_to_120");

assert.equal(formatAsOfLabel("2026-10-20T22:00:00.000Z"), "Tue Oct 20, 2026, 6:00 PM ET");
assert.equal(formatAsOfLabel("2026-01-15T17:00:00.000Z"), "Thu Jan 15, 2026, 12:00 PM ET");
assert.throws(() => formatAsOfLabel(""), /missing refresh time/);
assert.throws(() => formatAsOfLabel("yesterday"), /missing refresh time/);

assert.throws(() => buildPublicJobStats({}, { siteUrl: SITE }), /bad query result|bad open_jobs/);
assert.throws(() => buildPublicJobStats(null, { siteUrl: SITE }), /bad query result/);
assert.throws(() => buildPublicJobStats({ open_jobs: 0 }, { siteUrl: SITE }), /no open jobs/);
assert.throws(() => buildPublicJobStats(row({ open_jobs: 0, employers: [], with_salary: 0, closing_in_7_days: 0, no_closing_date: 0, cities: [], bands: bands(0) }), { siteUrl: SITE }), /no open jobs/);
const mismatch = row();
mismatch.open_jobs = 11;
assert.throws(() => buildPublicJobStats(mismatch, { siteUrl: SITE }), /employer totals do not match/);

const stats = build();
assert.equal(stats.name, "GTA public-sector job stats");
assert.equal(stats.asOfLabel, "Tue Oct 20, 2026, 6:00 PM ET");
assert.equal(stats.openJobs, 10);
assert.equal(stats.salaryPercent, 40);
assert.equal(stats.closingIn7Days, 3);
assert.ok(stats.facts.length >= 5 && stats.facts.length <= 7, stats.facts.join(" | "));
assert.match(stats.facts.join(" "), /4 of 10 open jobs post a salary \(40%\)/);
assert.match(stats.facts.join(" "), /3 close in the next 7 days/);
assert.equal(stats.employers[0].closingIn7Days, 3);
assert.equal(stats.employers[0].salaryPercent, 40);
assert.equal(stats.employers[0].url, `${SITE}/employers/city-of-toronto/`);
assert.equal(stats.license, "https://creativecommons.org/licenses/by/4.0/");
assert.equal(stats.licenseNote, "Free to reuse if you cite PublicJobs.ca");

const big = build({
  open_jobs: 750,
  with_salary: 393,
  closing_in_7_days: 211,
  no_closing_date: 243,
  top_of_range_at_least_100k: 227,
  employers: [employer({ open_jobs: 750, with_salary: 393, closing_in_7_days: 211, salary_min: 45000, salary_max: 200000 })],
  cities: [{ city: "Toronto", open_jobs: 483 }, { city: "Oakville", open_jobs: 57 }],
  bands: { under_60: 40, from_60_to_80: 80, from_80_to_100: 46, from_100_to_120: 100, from_120: 127 },
});
assert.equal(big.salaryPercent, 52);
assert.match(big.facts.join(" "), /393 of 750 open jobs post a salary \(52%\)/);
assert.match(big.facts.join(" "), /211 close in the next 7 days/);
assert.equal(big.facts.length, 7);
assert.equal(big.cities[0].city, "Toronto");

const none = build({
  open_jobs: 4,
  with_salary: 0,
  closing_in_7_days: 1,
  no_closing_date: 4,
  median_posted_minimum: null,
  top_of_range_at_least_100k: 0,
  posted_minimum: null,
  posted_maximum: null,
  employers: [employer({ open_jobs: 4, with_salary: 0, salary_min: null, salary_max: null, closing_in_7_days: 1 })],
  cities: [],
  bands: bands(0),
});
assert.equal(none.salaryPercent, 0);
assert.match(none.facts.join(" "), /None of the 4 open jobs post a salary/);
assert.match(none.facts.join(" "), /1 closes in the next 7 days/);
assert.equal(none.employers[0].salaryRange, "Not posted");
assert.equal(none.cities.length, 0);
assert.ok(none.facts.length >= 5 && none.facts.length <= 7);

const planted = row();
(planted as { title?: string }).title = "Chief Planner";
(planted.employers[0] as { title?: string }).title = "Chief Planner";
const hidden = buildPublicJobStats(planted, { siteUrl: SITE });
const blob = `${statsToJson(hidden)}${statsToCsv(hidden)}${hidden.facts.join(" ")}${hidden.howWeCount.join(" ")}`;
assert.equal(blob.includes("Chief Planner"), false);
assert.equal(keysOf(hidden).has("title"), false);
assert.equal(keysOf(JSON.parse(statsToJson(hidden))).has("title"), false);
assert.doesNotMatch(statsToCsv(hidden), /^title|title,/m);
assert.match(statsToCsv(hidden), /3 close|closing_in_7_days/);
const csvLines = statsToCsv(hidden).trim().split("\n");
assert.equal(
  csvLines[0],
  "as_of,section,name,open_jobs,with_salary,salary_percent,salary_range,closing_in_7_days",
);
assert.match(csvLines[1], /summary,All open jobs,10,4,40/);
assert.match(csvLines[1], /3$/);
assert.match(csvLines[2], /employer,City of Toronto,10,4,40/);
assert.equal(csvLines[2].endsWith(",3"), true);

const quoted = build({
  employers: [employer({ name: 'Board, "Quoted"', slug: "board" })],
});
assert.match(statsToCsv(quoted), /"Board, ""Quoted"""/);
assert.equal(quoted.employers[0].name, 'Board, "Quoted"');

const data = datasetJsonLd(hidden);
assert.equal(data["@type"], "Dataset");
assert.equal(data.name, "GTA public-sector job stats");
const description = String(data.description);
assert.ok(description.length >= 50 && description.length <= 5000);
assert.equal(description, datasetDescription(hidden));
assert.match(description, /4 of 10 open jobs post a salary/);
assert.match(description, /3 close in the next 7 days/);
const distribution = data.distribution as { contentUrl: string }[];
assert.deepEqual(
  distribution.map((item) => item.contentUrl),
  [`${SITE}/stats.json`, `${SITE}/stats.csv`],
);
assert.equal((data.license as string), "https://creativecommons.org/licenses/by/4.0/");

const sql = statsSql();
assert.equal(/\b(title|page_title|description|apply_url|job_slug)\b/i.test(sql), false);
assert.ok(sql.includes(OPEN_JOB_SQL));
assert.ok(sql.includes(`+ ${CLOSING_WINDOW_DAYS}`));
assert.ok(sql.includes("= any($1::text[])"));
assert.ok(sql.includes(String(PAYWALL_HIGH_SALARY)));
assert.deepEqual([...EXCLUDED_SOURCE_KEYS], ["peoplesoft_tps"]);

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const jobs = read("web/lib/jobs.ts");
const dataFile = read("web/lib/stats-data.ts");
const page = read("web/app/(public)/stats/page.tsx");
const footer = read("web/components/SiteFooter.tsx");
const employers = read("web/components/views/EmployersView.tsx");
const sitemap = read("web/app/sitemap.xml/route.ts");
const llms = read("web/app/llms.txt/route.ts");
assert.match(jobs, /OPEN_JOB_SQL as OPEN/);
assert.match(jobs, /EXCLUDED_SOURCE_KEYS/);
assert.match(dataFile, /unstable_cache/);
assert.match(dataFile, /statsSql\(\)/);
assert.match(dataFile, /excludedSourceKeys\(\)/);
assert.doesNotMatch(dataFile, /try\s*\{/);
assert.match(page, /revalidate = 900/);
assert.match(page, /STATS_NAME/);
assert.doesNotMatch(page, /j\.title|job\.title/);
assert.match(footer, /Job stats", "\/stats\/"/);
assert.match(employers, /href="\/stats\/"/);
assert.match(sitemap, /"\/stats\/"/);
assert.match(llms, /Daily email alerts stay free/);
assert.doesNotMatch(llms, /Weekly email alerts/);
assert.match(llms, /\/stats\//);
assert.match(read("web/app/stats.json/route.ts"), /s-maxage=900, stale-while-revalidate=86400/);
assert.match(read("web/app/stats.csv/route.ts"), /s-maxage=900, stale-while-revalidate=86400/);

console.log("stats ok");
