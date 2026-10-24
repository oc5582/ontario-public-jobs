import assert from "node:assert/strict";
import { employerHeading } from "../web/lib/employer-page.ts";
import { baseSalaryFromJob, baseSalaryFromText, employmentTypes, employmentTypesFor } from "../web/lib/schema-fill.ts";

function pay(salary: string, description = ""): [number, number | undefined, string] | null {
  const parsed = baseSalaryFromText(salary, description) as {
    value?: { minValue?: number; maxValue?: number; value?: number; unitText?: string };
  } | null;
  if (!parsed?.value) return null;
  const value = parsed.value;
  return [value.minValue ?? value.value ?? 0, value.maxValue, value.unitText || ""];
}

assert.deepEqual(pay("$25.50 - $26.98 /hour"), [25.5, 26.98, "HOUR"]);
assert.deepEqual(pay("$1,144.15 per week"), [1144.15, undefined, "WEEK"]);
assert.deepEqual(pay("$93,798.00 - $127,484.00"), [93798, 127484, "YEAR"]);
assert.deepEqual(pay("$3,750.68 - $3,990.02 / bi-weekly"), [97517.68, 103740.52, "YEAR"]);
assert.deepEqual(pay("$48.15 - $52.66"), [48.15, 52.66, "HOUR"]);
assert.deepEqual(pay("$23.81"), [23.81, undefined, "HOUR"]);
assert.equal(pay("$2,966.12 - $3,442.06"), null);
assert.deepEqual(
  pay("$3,610.06", "Hiring salary range:\n$3,610.06\n-\n$5,157.24\n/ Bi-weekly\nHydro One is proud"),
  [93861.56, 134088.24, "YEAR"],
);
assert.equal(pay("$1,500.00 - $1,800.00", "Salary/Hourly Range: $1,500.00 - $1,800.00 Work Details"), null);
assert.equal(pay("$4,000 per month"), null);
assert.equal(pay("$7"), null);
assert.deepEqual(pay("se situe généralement entre 82 586$ et 97 160$, (niveau de poste 15)"), [82586, 97160, "YEAR"]);
assert.deepEqual(pay("23.81$"), [23.81, undefined, "HOUR"]);
assert.deepEqual(pay("$126, 000.00 - $176,140.00"), [126000, 176140, "YEAR"]);
assert.deepEqual(pay("$4,102.00 - 5,508.40 / Bi-weekly"), [106652, 143218.4, "YEAR"]);
assert.deepEqual(
  pay("$50.72 - Plus $1.75/hour Skilled Trade Premium for all regular hours worked"),
  [50.72, undefined, "HOUR"],
);
assert.deepEqual(
  pay("$38.02 - $49.37 Plus $1.75/hr Skilled Trade Premium for all regular hours worked"),
  [38.02, 49.37, "HOUR"],
);
assert.deepEqual(pay("$28.75/hr (Training Rate); $36.75/hr - $47.50/hr upon completing training"), [36.75, 47.5, "HOUR"]);

const fromDescription = baseSalaryFromJob("", "Pay:\n$74,671.00 - $130,424\nAbout the role") as {
  currency: string;
  value: { minValue: number; maxValue: number; unitText: string };
};
assert.equal(fromDescription.currency, "CAD");
assert.equal(fromDescription.value.minValue, 74671);
assert.equal(fromDescription.value.unitText, "YEAR");
assert.equal(baseSalaryFromJob("$1,664.34 - $2,622.59", "Salary Range: $1,664.34 - $2,622.59"), null);

assert.deepEqual(employmentTypes("Permanent"), ["FULL_TIME"]);
assert.deepEqual(employmentTypes("Regular (Hybrid)"), ["FULL_TIME"]);
assert.deepEqual(employmentTypes("Permanent Part Time"), ["PART_TIME"]);
assert.deepEqual(employmentTypes("Full Time (FT), Regular (R)"), ["FULL_TIME"]);
assert.deepEqual(employmentTypesFor("", "Position Type: Non-Union Permanent\nDo the work."), ["FULL_TIME"]);
assert.deepEqual(
  employmentTypesFor("", "Benefits depend on employment type (e.g., full-time permanent or contracts)."),
  [],
);

const metrolinx = employerHeading("Metrolinx");
assert.equal(metrolinx.h1, "Metrolinx and GO Transit jobs");
assert.equal(metrolinx.title, "Metrolinx and GO Transit jobs | PublicJobs.ca");
assert.equal(metrolinx.lead, "Metrolinx runs GO Transit, UP Express and PRESTO.");
assert.match(metrolinx.alertName, /GO Transit/);

const ttc = employerHeading("Toronto Transit Commission");
assert.equal(ttc.h1, "TTC jobs (Toronto Transit Commission)");
assert.equal(ttc.title, "TTC jobs (Toronto Transit Commission) | PublicJobs.ca");

const toronto = employerHeading("City of Toronto");
assert.equal(toronto.h1, "City of Toronto jobs");
assert.equal(toronto.lead, "");

for (const name of [
  "Liquor Control Board of Ontario (LCBO)",
  "Ontario Lottery and Gaming Corporation (OLG)",
  "Canadian Broadcasting Corporation (CBC / Radio-Canada)",
  "Financial Services Regulatory Authority of Ontario (FSRA)",
]) {
  const heading = employerHeading(name);
  assert.match(heading.title, /^(LCBO|OLG|CBC|FSRA) jobs/);
  assert.ok(heading.title.length <= 60, heading.title);
}

const ajax = employerHeading("Town of Ajax");
assert.equal(ajax.h1, "City of Ajax jobs (Town of Ajax)");
assert.match(ajax.title, /^City of Ajax jobs/);
assert.ok(ajax.title.length <= 60, ajax.title);

console.log("schema fill ok");
