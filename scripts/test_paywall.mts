import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFilters } from "../web/lib/filters.ts";
import {
  PAYWALL_HIGH_SALARY,
  PAYWALL_TEASER_LIMIT,
  PAYWALL_TEASER_SELECT,
  parsePaywallTeasers,
  paywallDetail,
  paywallFiltering,
  paywallFocus,
  postedSalaryLabel,
} from "../web/lib/paywall.ts";

assert.equal(PAYWALL_HIGH_SALARY, 100_000);
assert.equal(PAYWALL_TEASER_LIMIT, 5);
assert.equal(/\b(title|employer|path|apply_url|href|job_slug)\b/i.test(PAYWALL_TEASER_SELECT), false);
assert.match(PAYWALL_TEASER_SELECT, /j\.salary/);
assert.match(PAYWALL_TEASER_SELECT, /j\.employment_type/);
assert.match(PAYWALL_TEASER_SELECT, /j\.closing_date/);

assert.equal(
  paywallDetail({ place: "jobs", remaining: 47, highPay: 9, focus: "IT", filtering: true }),
  "47 more IT jobs match your filters, 9 paying over $100k.",
);
assert.equal(
  paywallDetail({ place: "home", remaining: 47, highPay: 0, focus: "IT", filtering: true }),
  "47 more IT jobs match your filters.",
);
assert.equal(
  paywallDetail({ place: "home", remaining: 12, highPay: 2, filtering: false }),
  "12 more open jobs, 2 paying over $100k.",
);
assert.equal(
  paywallDetail({ place: "jobs", remaining: 1, highPay: 0, filtering: true }),
  "1 more job matches your filters.",
);
assert.equal(
  paywallDetail({
    place: "employer",
    remaining: 19,
    highPay: 4,
    employerName: "Metrolinx",
    filtering: false,
  }),
  "Metrolinx has 19 more open jobs, 4 paying over $100k.",
);
assert.equal(
  paywallDetail({
    place: "employer",
    remaining: 19,
    highPay: 0,
    employerName: "City of Toronto",
    focus: "planner",
    filtering: true,
  }),
  "City of Toronto has 19 more planner jobs matching your filters.",
);
assert.equal(
  paywallDetail({
    place: "employer",
    remaining: 1,
    highPay: 1,
    employerName: "Metrolinx",
    filtering: false,
  }),
  "Metrolinx has 1 more open job, 1 paying over $100k.",
);

const filters = emptyFilters();
assert.equal(paywallFiltering(filters), false);
assert.equal(paywallFocus(filters), "");
assert.equal(paywallFiltering({ ...filters, employer: "metrolinx" }), false);
assert.equal(paywallFiltering({ ...filters, q: "IT" }), true);
assert.equal(paywallFocus({ ...filters, q: "IT" }), "IT");
assert.equal(paywallFocus({ ...filters, category: "information-technology" }), "Information technology");
assert.equal(paywallFocus({ ...filters, category: "other" }), "");
assert.equal(paywallFocus({ ...filters, q: "IT", category: "finance" }), "IT");
assert.equal(paywallFocus({ ...filters, type: "full-time" }), "");

assert.equal(postedSalaryLabel("$83,946 to $98,756", 83946, 98756), "$83,946 to $98,756");
assert.equal(postedSalaryLabel("", 90000, 110000), "$90,000–$110,000");
assert.equal(postedSalaryLabel("", null, null), "");
assert.equal(postedSalaryLabel("   ", 80000, 80000), "$80,000");

const teasers = parsePaywallTeasers([
  { salary: "$44.04/hourly", salary_min: 90000, salary_max: 91603, type: "full-time", closing: "2026-11-02" },
  { title: "Secret title", employer: "Metrolinx", path: "/jobs/secret/", type: "contract", closing: "2026-12-01T00:00:00" },
  ...Array.from({ length: 6 }, () => ({ salary: "$1", type: "x", closing: "2026-01-01" })),
]);
assert.equal(teasers.length, 5);
assert.equal(teasers[0].salary, "$44.04/hourly");
assert.equal(teasers[0].type, "full-time");
assert.equal(teasers[0].closing, "2026-11-02");
assert.equal("title" in teasers[1], false);
assert.equal("employer" in teasers[1], false);
assert.equal(teasers[1].salary, "");
assert.equal(teasers[1].closing, "2026-12-01");
assert.deepEqual(Object.keys(teasers[0]).sort(), ["closing", "salary", "type"]);

const card = readFileSync(new URL("../web/components/UnlockCard.tsx", import.meta.url), "utf8");
assert.match(card, /Member-only job/);
assert.match(card, /aria-hidden="true"/);
assert.match(card, /<div className="job-row job-teaser">/);
assert.doesNotMatch(card, /<a className="job-row job-teaser"/);
assert.doesNotMatch(card, /row\.title|row\.employer|row\.href|job\.title|job\.employer/);
assert.match(card, /<PaywallView \/>/);
