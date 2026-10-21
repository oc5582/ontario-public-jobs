import { englishList } from "./format";
import { EXCLUDED_SOURCE_KEYS, OPEN_JOB_SQL } from "./open-job";
import { PAYWALL_HIGH_SALARY } from "./paywall";
import { BRAND } from "./site";

export const STATS_NAME = "GTA public-sector job stats";
export const STATS_LICENSE = "https://creativecommons.org/licenses/by/4.0/";
export const STATS_LICENSE_NOTE = "Free to reuse if you cite PublicJobs.ca";
/** Closing date of today through this many days later, in America/Toronto. */
export const CLOSING_WINDOW_DAYS = 7;
export const BAND_60 = 60_000;
export const BAND_80 = 80_000;
export const BAND_100 = 100_000;
export const BAND_120 = 120_000;

export const SALARY_BANDS = [
  { id: "under_60", label: "Under $60,000" },
  { id: "from_60_to_80", label: "$60,000 to $79,999" },
  { id: "from_80_to_100", label: "$80,000 to $99,999" },
  { id: "from_100_to_120", label: "$100,000 to $119,999" },
  { id: "from_120", label: "$120,000 and over" },
] as const;

export type SalaryBandId = (typeof SALARY_BANDS)[number]["id"];

const HOW_WE_COUNT = [
  "An open job has not been removed, and its closing date is today or later in America/Toronto, or it has no closing date. That is the same rule as the homepage, the jobs list, and the employer pages. The paused Toronto Police Service feed is left out, the same way the site leaves that feed out of its public source list.",
  `A job posts a salary when the posting included a yearly minimum or maximum. An employer's salary range is the lowest of those minimums and the highest of those maximums. Salary bands use the posted yearly minimum: under $60,000, $60,000 to $79,999, $80,000 to $99,999, $100,000 to $119,999, and $120,000 and over. Closing in 7 days means the closing date is today or within the next ${CLOSING_WINDOW_DAYS} days. A job listed in more than one city is counted in each of those cities. These are counts only. Job titles are not included.`,
];

export type EmployerStat = {
  name: string;
  slug: string;
  url: string;
  openJobs: number;
  withSalary: number;
  salaryPercent: number;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryRange: string;
  closingIn7Days: number;
};

export type CityStat = {
  city: string;
  openJobs: number;
};

export type SalaryBandStat = {
  id: SalaryBandId;
  label: string;
  openJobs: number;
};

export type PublicJobStats = {
  name: typeof STATS_NAME;
  url: string;
  asOf: string;
  asOfLabel: string;
  openJobs: number;
  employerCount: number;
  withSalary: number;
  salaryPercent: number;
  closingIn7Days: number;
  noClosingDate: number;
  medianPostedMinimum: number | null;
  topOfRangeAtLeast100k: number;
  postedMinimum: number | null;
  postedMaximum: number | null;
  facts: string[];
  howWeCount: string[];
  license: typeof STATS_LICENSE;
  licenseNote: typeof STATS_LICENSE_NOTE;
  downloads: { json: string; csv: string };
  employers: EmployerStat[];
  cities: CityStat[];
  salaryBands: SalaryBandStat[];
};

export function salaryPercent(withSalary: number, openJobs: number): number {
  if (!Number.isInteger(openJobs) || openJobs <= 0) throw new Error("stats: no open jobs");
  if (!Number.isInteger(withSalary) || withSalary < 0 || withSalary > openJobs) {
    throw new Error("stats: salary count out of range");
  }
  return Math.round((withSalary / openJobs) * 100);
}

/** True when closingIso is today through CLOSING_WINDOW_DAYS later. Blank and past dates are false. */
export function closesWithin7Days(closingIso: string | null | undefined, todayIso: string): boolean {
  const closing = (closingIso || "").slice(0, 10);
  const today = (todayIso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(closing) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  const close = Date.parse(`${closing}T00:00:00Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  const diff = Math.round((close - start) / 86400000);
  return diff >= 0 && diff <= CLOSING_WINDOW_DAYS;
}

export function salaryBandId(annualMinimum: number): SalaryBandId {
  if (annualMinimum < BAND_60) return "under_60";
  if (annualMinimum < BAND_80) return "from_60_to_80";
  if (annualMinimum < BAND_100) return "from_80_to_100";
  if (annualMinimum < BAND_120) return "from_100_to_120";
  return "from_120";
}

export function formatDollars(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-CA")}`;
}

export function formatCount(amount: number): string {
  return Math.round(amount).toLocaleString("en-CA");
}

export function formatSalaryRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Not posted";
  if (min == null) return formatDollars(max as number);
  if (max == null || min === max) return formatDollars(min);
  return `${formatDollars(min)}\u2013${formatDollars(max)}`;
}

export function formatAsOfLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error("stats: missing refresh time");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  const label = `${get("weekday")} ${get("month")} ${get("day")}, ${get("year")}, ${get("hour")}:${get("minute")} ${get("dayPeriod")} ET`;
  if (!/^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M ET$/.test(label)) {
    throw new Error("stats: missing refresh time");
  }
  return label;
}

function requiredCount(value: unknown, name: string): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) throw new Error(`stats: bad ${name}`);
  return n;
}

function optionalMoney(value: unknown, name: string): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) throw new Error(`stats: bad ${name}`);
  return Math.round(n);
}

function asRecord(value: unknown): Record<string, unknown> {
  let parsed = value;
  if (typeof parsed === "string") parsed = JSON.parse(parsed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("stats: bad query result");
  return parsed as Record<string, unknown>;
}

function asArray(value: unknown, name: string): Record<string, unknown>[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`stats: bad ${name}`);
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`stats: bad ${name}`);
    return item as Record<string, unknown>;
  });
}

function jobsNoun(count: number): string {
  return count === 1 ? "job" : "jobs";
}

function employerNoun(count: number): string {
  return count === 1 ? "employer" : "employers";
}

function factSentences(input: {
  openJobs: number;
  employerCount: number;
  withSalary: number;
  salaryPercent: number;
  closingIn7Days: number;
  noClosingDate: number;
  medianPostedMinimum: number | null;
  topOfRangeAtLeast100k: number;
  cities: CityStat[];
}): string[] {
  const facts = [
    `PublicJobs.ca lists ${formatCount(input.openJobs)} open public-sector ${jobsNoun(input.openJobs)} at ${formatCount(input.employerCount)} GTA ${employerNoun(input.employerCount)}.`,
  ];
  if (input.withSalary === 0) {
    facts.push(`None of the ${formatCount(input.openJobs)} open ${jobsNoun(input.openJobs)} post a salary.`);
  } else if (input.withSalary === input.openJobs) {
    facts.push(`All ${formatCount(input.openJobs)} open ${jobsNoun(input.openJobs)} post a salary.`);
  } else if (input.withSalary === 1) {
    facts.push(`1 of ${formatCount(input.openJobs)} open ${jobsNoun(input.openJobs)} posts a salary (${input.salaryPercent}%).`);
  } else {
    facts.push(
      `${formatCount(input.withSalary)} of ${formatCount(input.openJobs)} open ${jobsNoun(input.openJobs)} post a salary (${input.salaryPercent}%).`,
    );
  }
  if (input.closingIn7Days === 0) facts.push("None close in the next 7 days.");
  else if (input.closingIn7Days === 1) facts.push("1 closes in the next 7 days.");
  else facts.push(`${formatCount(input.closingIn7Days)} close in the next 7 days.`);
  if (input.noClosingDate === 0) facts.push("Every open job has a closing date.");
  else if (input.noClosingDate === 1) facts.push("1 has no closing date.");
  else facts.push(`${formatCount(input.noClosingDate)} have no closing date.`);
  if (input.medianPostedMinimum != null) {
    facts.push(`The median posted minimum is ${formatDollars(input.medianPostedMinimum)}.`);
  }
  if (input.topOfRangeAtLeast100k === 0) {
    facts.push(`None list a top of range of ${formatDollars(PAYWALL_HIGH_SALARY)} or more.`);
  } else if (input.topOfRangeAtLeast100k === 1) {
    facts.push(`1 open job lists a top of range of ${formatDollars(PAYWALL_HIGH_SALARY)} or more.`);
  } else {
    facts.push(
      `${formatCount(input.topOfRangeAtLeast100k)} open jobs list a top of range of ${formatDollars(PAYWALL_HIGH_SALARY)} or more.`,
    );
  }
  if (input.cities.length) {
    const top = input.cities[0].openJobs;
    const names = input.cities.filter((city) => city.openJobs === top).map((city) => city.city);
    const listed = englishList(names);
    facts.push(
      names.length === 1
        ? `${listed} has the most open jobs, ${formatCount(top)}.`
        : `${listed} have the most open jobs, ${formatCount(top)} each.`,
    );
  }
  if (facts.length < 5 || facts.length > 7) throw new Error("stats: fact count out of range");
  return facts;
}

export function buildPublicJobStats(value: unknown, options: { siteUrl: string }): PublicJobStats {
  const siteUrl = options.siteUrl.replace(/\/$/, "");
  const row = asRecord(value);
  const openJobs = requiredCount(row.open_jobs, "open_jobs");
  if (openJobs === 0) throw new Error("stats: no open jobs");

  const withSalary = requiredCount(row.with_salary, "with_salary");
  const closingIn7Days = requiredCount(row.closing_in_7_days, "closing_in_7_days");
  const noClosingDate = requiredCount(row.no_closing_date, "no_closing_date");
  const topOfRangeAtLeast100k = requiredCount(row.top_of_range_at_least_100k, "top_of_range_at_least_100k");
  if (withSalary > openJobs) throw new Error("stats: salary count out of range");
  if (closingIn7Days > openJobs) throw new Error("stats: closing count out of range");
  if (noClosingDate > openJobs) throw new Error("stats: closing date count out of range");
  if (topOfRangeAtLeast100k > withSalary) throw new Error("stats: high salary count out of range");

  const asOfRaw = row.as_of;
  if (typeof asOfRaw !== "string" || asOfRaw.trim() === "") throw new Error("stats: missing refresh time");
  const asOfDate = new Date(asOfRaw);
  if (Number.isNaN(asOfDate.getTime())) throw new Error("stats: missing refresh time");
  const asOf = asOfDate.toISOString();
  const asOfLabel = formatAsOfLabel(asOf);

  const medianPostedMinimum = optionalMoney(row.median_posted_minimum, "median_posted_minimum");
  const postedMinimum = optionalMoney(row.posted_minimum, "posted_minimum");
  const postedMaximum = optionalMoney(row.posted_maximum, "posted_maximum");
  if (withSalary === 0 && (medianPostedMinimum != null || postedMinimum != null || postedMaximum != null)) {
    throw new Error("stats: salary range without salaries");
  }
  if (withSalary > 0 && postedMinimum == null && postedMaximum == null) {
    throw new Error("stats: missing salary range");
  }

  const employers = asArray(row.employers, "employers")
    .map((item) => {
      const slug = typeof item.slug === "string" ? item.slug : "";
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (!name || !/^[a-z0-9-]+$/.test(slug)) throw new Error("stats: bad employer");
      const jobs = requiredCount(item.open_jobs, "employer open_jobs");
      if (jobs < 1) throw new Error("stats: bad employer");
      const salary = requiredCount(item.with_salary, "employer with_salary");
      const closing = requiredCount(item.closing_in_7_days, "employer closing_in_7_days");
      if (salary > jobs || closing > jobs) throw new Error("stats: bad employer");
      const salaryMin = optionalMoney(item.salary_min, "employer salary_min");
      const salaryMax = optionalMoney(item.salary_max, "employer salary_max");
      if (salary === 0 && (salaryMin != null || salaryMax != null)) throw new Error("stats: bad employer");
      if (salary > 0 && salaryMin == null && salaryMax == null) throw new Error("stats: bad employer");
      return {
        name,
        slug,
        url: `${siteUrl}/employers/${slug}/`,
        openJobs: jobs,
        withSalary: salary,
        salaryPercent: salaryPercent(salary === 0 ? 0 : salary, jobs),
        salaryMin,
        salaryMax,
        salaryRange: formatSalaryRange(salaryMin, salaryMax),
        closingIn7Days: closing,
      };
    })
    .sort((a, b) => b.openJobs - a.openJobs || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  if (employers.reduce((sum, item) => sum + item.openJobs, 0) !== openJobs) {
    throw new Error("stats: employer totals do not match open jobs");
  }
  if (employers.reduce((sum, item) => sum + item.withSalary, 0) !== withSalary) {
    throw new Error("stats: employer salary totals do not match");
  }
  if (employers.reduce((sum, item) => sum + item.closingIn7Days, 0) !== closingIn7Days) {
    throw new Error("stats: employer closing totals do not match");
  }

  const cities = asArray(row.cities, "cities")
    .map((item) => {
      const city = typeof item.city === "string" ? item.city.trim() : "";
      const jobs = requiredCount(item.open_jobs, "city open_jobs");
      if (!city || jobs < 1 || jobs > openJobs) throw new Error("stats: bad city");
      return { city, openJobs: jobs };
    })
    .sort((a, b) => b.openJobs - a.openJobs || a.city.localeCompare(b.city, "en", { sensitivity: "base" }));

  const bands = asRecord(row.bands);
  const salaryBands = SALARY_BANDS.map((band) => ({
    id: band.id,
    label: band.label,
    openJobs: requiredCount(bands[band.id], `band ${band.id}`),
  }));
  if (salaryBands.reduce((sum, band) => sum + band.openJobs, 0) !== withSalary) {
    throw new Error("stats: salary bands do not match");
  }

  const percent = salaryPercent(withSalary, openJobs);
  const facts = factSentences({
    openJobs,
    employerCount: employers.length,
    withSalary,
    salaryPercent: percent,
    closingIn7Days,
    noClosingDate,
    medianPostedMinimum,
    topOfRangeAtLeast100k,
    cities,
  });

  const stats: PublicJobStats = {
    name: STATS_NAME,
    url: `${siteUrl}/stats/`,
    asOf,
    asOfLabel,
    openJobs,
    employerCount: employers.length,
    withSalary,
    salaryPercent: percent,
    closingIn7Days,
    noClosingDate,
    medianPostedMinimum,
    topOfRangeAtLeast100k,
    postedMinimum,
    postedMaximum,
    facts,
    howWeCount: HOW_WE_COUNT,
    license: STATS_LICENSE,
    licenseNote: STATS_LICENSE_NOTE,
    downloads: { json: `${siteUrl}/stats.json`, csv: `${siteUrl}/stats.csv` },
    employers,
    cities,
    salaryBands,
  };
  const description = datasetDescription(stats);
  if (description.length < 50 || description.length > 5000) throw new Error("stats: dataset description length");
  return stats;
}

export function datasetDescription(stats: PublicJobStats): string {
  return [...stats.facts, ...stats.howWeCount, `Data license: CC BY 4.0. ${stats.licenseNote}.`].join(" ");
}

export function datasetJsonLd(stats: PublicJobStats): Record<string, unknown> {
  const description = datasetDescription(stats);
  if (description.length < 50 || description.length > 5000) throw new Error("stats: dataset description length");
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: stats.name,
    description,
    url: stats.url,
    creator: {
      "@type": "Organization",
      name: BRAND,
      url: new URL("/", stats.url).toString(),
    },
    license: stats.license,
    dateModified: stats.asOf,
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: stats.downloads.json,
      },
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: stats.downloads.csv,
      },
    ],
  };
}

function csvCell(value: string | number | null): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function statsToCsv(stats: PublicJobStats): string {
  const header = [
    "as_of",
    "section",
    "name",
    "open_jobs",
    "with_salary",
    "salary_percent",
    "salary_range",
    "closing_in_7_days",
  ];
  const lines = [header.join(",")];
  const push = (section: string, name: string, openJobs: number, withSalary: number | null, percent: number | null, range: string | null, closing: number | null) => {
    lines.push(
      [
        csvCell(stats.asOfLabel),
        section,
        csvCell(name),
        openJobs,
        withSalary == null ? "" : withSalary,
        percent == null ? "" : percent,
        range == null ? "" : csvCell(range),
        closing == null ? "" : closing,
      ].join(","),
    );
  };
  push(
    "summary",
    "All open jobs",
    stats.openJobs,
    stats.withSalary,
    stats.salaryPercent,
    formatSalaryRange(stats.postedMinimum, stats.postedMaximum),
    stats.closingIn7Days,
  );
  for (const employer of stats.employers) {
    push(
      "employer",
      employer.name,
      employer.openJobs,
      employer.withSalary,
      employer.salaryPercent,
      employer.salaryRange,
      employer.closingIn7Days,
    );
  }
  for (const city of stats.cities) push("city", city.city, city.openJobs, null, null, null, null);
  for (const band of stats.salaryBands) push("salary_band", band.label, band.openJobs, null, null, null, null);
  return `${lines.join("\n")}\n`;
}

export function statsToJson(stats: PublicJobStats): string {
  return `${JSON.stringify(stats, null, 2)}\n`;
}

/** One aggregate against jobs. Counts only: no titles, descriptions, or apply links. */
export function statsSql(): string {
  return `with open_jobs as (
  select
    e.slug as employer_slug,
    e.name as employer_name,
    j.closing_date,
    j.salary_annual_min,
    j.salary_annual_max,
    j.fetched_at,
    (
      select coalesce(array_agg(distinct btrim(c)), '{}'::text[])
      from unnest(j.cities) as c
      where btrim(c) <> ''
    ) as cities,
    (j.salary_annual_min is not null or j.salary_annual_max is not null) as has_salary,
    (
      j.closing_date is not null
      and j.closing_date <= (timezone('America/Toronto', now()))::date + ${CLOSING_WINDOW_DAYS}
    ) as closes_soon
  from jobs j
  join employers e on e.id = j.employer_id
  where ${OPEN_JOB_SQL}
    and not (split_part(coalesce(j.source, ''), ':', 1) = any($1::text[]))
)
select jsonb_build_object(
  'as_of', max(fetched_at),
  'open_jobs', count(*)::int,
  'with_salary', count(*) filter (where has_salary)::int,
  'closing_in_7_days', count(*) filter (where closes_soon)::int,
  'no_closing_date', count(*) filter (where closing_date is null)::int,
  'median_posted_minimum', (
    select round((percentile_cont(0.5) within group (order by salary_annual_min))::numeric)::int
    from open_jobs
    where salary_annual_min is not null
  ),
  'top_of_range_at_least_100k', count(*) filter (where salary_annual_max >= ${PAYWALL_HIGH_SALARY})::int,
  'posted_minimum', round(min(salary_annual_min) filter (where has_salary))::int,
  'posted_maximum', round(max(salary_annual_max) filter (where has_salary))::int,
  'employers', (
    select coalesce(jsonb_agg(to_jsonb(s) order by s.open_jobs desc, lower(s.name), s.name), '[]'::jsonb)
    from (
      select employer_slug as slug,
             employer_name as name,
             count(*)::int as open_jobs,
             count(*) filter (where has_salary)::int as with_salary,
             round(min(salary_annual_min) filter (where has_salary))::int as salary_min,
             round(max(salary_annual_max) filter (where has_salary))::int as salary_max,
             count(*) filter (where closes_soon)::int as closing_in_7_days
      from open_jobs
      group by employer_slug, employer_name
    ) s
  ),
  'cities', (
    select coalesce(jsonb_agg(to_jsonb(c) order by c.open_jobs desc, lower(c.city), c.city), '[]'::jsonb)
    from (
      select city, count(*)::int as open_jobs
      from open_jobs
      cross join lateral unnest(cities) as city
      group by city
    ) c
  ),
  'bands', (
    select jsonb_build_object(
      'under_60', count(*) filter (where has_salary and band_value < ${BAND_60})::int,
      'from_60_to_80', count(*) filter (where has_salary and band_value >= ${BAND_60} and band_value < ${BAND_80})::int,
      'from_80_to_100', count(*) filter (where has_salary and band_value >= ${BAND_80} and band_value < ${BAND_100})::int,
      'from_100_to_120', count(*) filter (where has_salary and band_value >= ${BAND_100} and band_value < ${BAND_120})::int,
      'from_120', count(*) filter (where has_salary and band_value >= ${BAND_120})::int
    )
    from (
      select has_salary, coalesce(salary_annual_min, salary_annual_max) as band_value
      from open_jobs
    ) b
  )
) as stats
from open_jobs`;
}

export function excludedSourceKeys(): string[] {
  return [...EXCLUDED_SOURCE_KEYS];
}
