import { unstable_cache } from "next/cache";
import { query } from "./db";
import { hiringSystemName } from "./jobs";
import { EXCLUDED_SOURCE_KEYS, OPEN_JOB_SQL } from "./open-job";
import { asOfLabel, quizLabels, torontoToday, type QuizCatalog, type QuizJob } from "./quiz-logic";
import { annualAmount, areasFor, jobTypesForTitle, levelForTitle, payPeriod } from "./quiz-tag";

const REVALIDATE_SECONDS = 900;

type QuizRow = {
  title: string;
  employer: string;
  location: string | null;
  cities: string[] | null;
  salary_min: number | string | null;
  salary_max: number | string | null;
  salary_unit: string | null;
  posted: string | null;
  closing: string | null;
  path: string;
  source: string | null;
  fetched_at: string | null;
};

function money(value: number | string | null): number | null {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function jobHref(path: string): string {
  let value = path.trim();
  if (!value.startsWith("/")) value = `/${value}`;
  if (!value.endsWith("/")) value = `${value}/`;
  return value;
}

function asCities(value: string[] | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim() !== "");
}

async function loadQuizCatalog(): Promise<QuizCatalog> {
  const rows = await query<QuizRow>(
    `select j.title,
            e.name as employer,
            j.location,
            j.cities,
            j.salary_annual_min as salary_min,
            j.salary_annual_max as salary_max,
            j.salary_unit,
            coalesce(j.posted_date, j.first_seen_at::date)::text as posted,
            j.closing_date::text as closing,
            j.path,
            j.source,
            j.fetched_at::text as fetched_at
     from jobs j
     join employers e on e.id = j.employer_id
     where ${OPEN_JOB_SQL}
       and not (split_part(coalesce(j.source, ''), ':', 1) = any($1::text[]))`,
    [[...EXCLUDED_SOURCE_KEYS]],
  );
  const emps: string[] = [];
  const employerIndex = new Map<string, number>();
  const systems = new Set<string>();
  let newestFetch = 0;
  const jobs: QuizJob[] = [];
  for (const row of rows) {
    const employer = row.employer || "";
    let index = employerIndex.get(employer);
    if (index == null) {
      index = emps.length;
      emps.push(employer);
      employerIndex.set(employer, index);
    }
    const system = hiringSystemName(row.source);
    if (system) systems.add(system);
    const fetched = row.fetched_at ? Date.parse(row.fetched_at) : Number.NaN;
    if (Number.isFinite(fetched) && fetched > newestFetch) newestFetch = fetched;
    const unit = row.salary_unit || "";
    const min = annualAmount(money(row.salary_min), unit);
    const maxRaw = money(row.salary_max);
    const max = annualAmount(maxRaw == null ? money(row.salary_min) : maxRaw, unit);
    const cities = asCities(row.cities);
    const location = `${row.location || ""} ${cities.join(" ")}`.trim();
    jobs.push({
      t: row.title,
      e: index,
      c: jobTypesForTitle(row.title),
      r: areasFor(location, employer),
      l: levelForTitle(row.title),
      mn: min,
      mx: max || min,
      p: payPeriod(unit),
      po: (row.posted || "").slice(0, 10),
      cl: (row.closing || "").slice(0, 10),
      u: jobHref(row.path),
    });
  }
  const today = torontoToday();
  return {
    emps,
    jobs,
    labels: quizLabels(),
    systems: systems.size,
    asOf: asOfLabel(newestFetch ? new Date(newestFetch) : new Date()),
    today,
  };
}

/** Open jobs tagged for /start. Same 15-minute cache as the public job lists. */
export function quizCatalog(): Promise<QuizCatalog> {
  return unstable_cache(loadQuizCatalog, ["quiz-catalog"], { revalidate: REVALIDATE_SECONDS })();
}
