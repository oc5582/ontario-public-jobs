import { unstable_cache } from "next/cache";
import { query } from "./db";
import { hasFilters, type JobFilters } from "./filters";
import { neighbourRanks } from "./neighbour-jobs";
import { selectSimilarJobs, type SimilarJobCandidate } from "./similar-jobs";
import {
  PAYWALL_HIGH_SALARY,
  PAYWALL_TEASER_LIMIT,
  PAYWALL_TEASER_SELECT,
  parsePaywallTeasers,
  type PaywallPreview,
} from "./paywall";
import { EXCLUDED_SOURCE_KEYS, OPEN_JOB_SQL as OPEN } from "./open-job";
import { FREE_LIST_LIMIT } from "./site";
import type { Facets, JobDetail, ListJob } from "./types";

const PUBLIC_REVALIDATE_SECONDS = 900;

function publicCache<T>(key: string[], fn: () => Promise<T>): Promise<T> {
  return unstable_cache(fn, key, { revalidate: PUBLIC_REVALIDATE_SECONDS })();
}

/** Unfiltered lists, and an employer page with no other filters, are shared. */
function listIsShared(filters: JobFilters): boolean {
  return !hasFilters({ ...filters, employer: "" });
}

const HAS_DESCRIPTION = `(btrim(j.description) <> '' or (jsonb_typeof(j.paragraphs) = 'array' and jsonb_array_length(j.paragraphs) > 0))`;

/** Feed posted date, or the day we first stored the job. */
export const EFFECTIVE_POSTED = "coalesce(j.posted_date, j.first_seen_at::date)";

/** Newest effective posted date, then fetch time, then title. Every job list uses this. */
export const JOB_ORDER = `${EFFECTIVE_POSTED} desc nulls last, j.fetched_at desc nulls last, j.title asc`;

type ListRow = {
  title: string;
  employer_name: string;
  location: string;
  location_places?: unknown;
  closing: string | null;
  employment_type: string;
  path: string;
  total_count: string;
};

function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

function whereFor(filters: JobFilters, params: unknown[]): string {
  const parts = [OPEN];
  if (filters.q) {
    params.push(likePattern(filters.q));
    parts.push(
      `(j.title ilike $${params.length} escape '\\' or e.name ilike $${params.length} escape '\\' or j.search_alias ilike $${params.length} escape '\\')`,
    );
  }
  if (filters.location) {
    params.push(filters.location);
    parts.push(`$${params.length} = any(j.cities)`);
  }
  if (filters.employer) {
    params.push(filters.employer);
    parts.push(`j.employer_slug = $${params.length}`);
  }
  if (filters.category) {
    params.push(filters.category);
    parts.push(`j.category = $${params.length}`);
  }
  if (filters.type) {
    params.push(filters.type);
    parts.push(`$${params.length} = any(j.job_types)`);
  }
  if (filters.salaryMin != null) {
    params.push(filters.salaryMin);
    parts.push(`j.salary_annual_max is not null and j.salary_annual_max >= $${params.length}`);
  }
  if (filters.salaryMax != null) {
    params.push(filters.salaryMax);
    parts.push(`j.salary_annual_min is not null and j.salary_annual_min <= $${params.length}`);
  }
  if (filters.salaryMin != null || filters.salaryMax != null) {
    parts.push("j.salary_annual_min is not null");
  }
  if (filters.postedSince) {
    params.push(filters.postedSince);
    parts.push(`${EFFECTIVE_POSTED} >= $${params.length}::date`);
  }
  if (filters.closesBy) {
    params.push(filters.closesBy);
    parts.push(`j.closing_date is not null and j.closing_date <= $${params.length}::date`);
  }
  return parts.join("\n  and ");
}

function jobHref(path: string): string {
  const normalized = path.endsWith("/") ? path : `${path}/`;
  return `/${normalized}`;
}

function toListJob(row: ListRow): ListJob {
  const path = row.path.endsWith("/") ? row.path : `${row.path}/`;
  return {
    title: row.title,
    employer: row.employer_name,
    location: row.location || "",
    location_places: row.location_places,
    closing: (row.closing || "").slice(0, 10),
    type: row.employment_type || "",
    href: jobHref(row.path),
    path,
  };
}

async function searchJobsUncached(
  filters: JobFilters,
  member: boolean,
): Promise<{ jobs: ListJob[]; total: number }> {
  const params: unknown[] = [];
  const where = whereFor(filters, params);
  const limit = member ? "" : `limit ${FREE_LIST_LIMIT}`;
  const rows = await query<ListRow>(
    `select j.title, e.name as employer_name, j.location, j.location_places, j.closing_date::text as closing,
            j.employment_type, j.path, count(*) over() as total_count
     from jobs j
     join employers e on e.id = j.employer_id
     where ${where}
     order by ${JOB_ORDER}
     ${limit}`,
    params,
  );
  const total = rows.length ? Number(rows[0].total_count) : await countJobs(filters);
  return { jobs: rows.map(toListJob), total };
}

export function searchJobs(
  filters: JobFilters,
  member: boolean,
): Promise<{ jobs: ListJob[]; total: number }> {
  if (!listIsShared(filters)) return searchJobsUncached(filters, member);
  return publicCache(
    ["search-jobs", JSON.stringify(filters), member ? "member" : "public"],
    () => searchJobsUncached(filters, member),
  );
}

async function paywallPreviewUncached(filters: JobFilters, offset: number): Promise<PaywallPreview> {
  const params: unknown[] = [offset, PAYWALL_HIGH_SALARY];
  const where = whereFor(filters, params);
  const rows = await query<{ remaining: string; high_pay: string; teasers: unknown }>(
    `select
       count(*) filter (where rn > $1)::text as remaining,
       count(*) filter (where rn > $1 and salary_annual_max >= $2)::text as high_pay,
       coalesce(
         jsonb_agg(
           jsonb_build_object(
             'salary', salary,
             'salary_min', salary_annual_min,
             'salary_max', salary_annual_max,
             'type', employment_type,
             'closing', closing
           )
           order by rn
         ) filter (where rn > $1 and rn <= $1 + ${PAYWALL_TEASER_LIMIT}),
         '[]'::jsonb
       ) as teasers
     from (
       select ${PAYWALL_TEASER_SELECT},
              row_number() over (order by ${JOB_ORDER}) as rn
       from jobs j
       join employers e on e.id = j.employer_id
       where ${where}
     ) ranked`,
    params,
  );
  const row = rows[0];
  return {
    highPay: Number(row?.high_pay || 0),
    teasers: parsePaywallTeasers(row?.teasers),
  };
}

/** Remaining posted-salary count and locked-row fields. Null when the query fails. */
export async function paywallPreview(filters: JobFilters, offset: number): Promise<PaywallPreview | null> {
  try {
    return await publicCache(["paywall-preview", JSON.stringify(filters), String(offset)], () =>
      paywallPreviewUncached(filters, offset),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    console.error(JSON.stringify({ event: "paywall_preview_failed", message: message.slice(0, 160) }));
    return null;
  }
}

async function countJobs(filters: JobFilters): Promise<number> {
  const params: unknown[] = [];
  const where = whereFor(filters, params);
  const rows = await query<{ total: string }>(
    `select count(*)::text as total
     from jobs j
     join employers e on e.id = j.employer_id
     where ${where}`,
    params,
  );
  return Number(rows[0]?.total || 0);
}

type DetailRow = {
  id: string;
  title: string;
  employer_name: string;
  employer_slug: string;
  job_slug: string;
  path: string;
  page_title: string;
  meta_description: string;
  location: string;
  location_places: unknown;
  closing: string | null;
  posted: string | null;
  first_seen: string | null;
  fetched: string | null;
  employment_type: string;
  work_mode: string;
  salary: string;
  department: string;
  description: string | null;
  paragraphs: string[] | string;
  apply_url: string;
  category: string;
  cities: string[] | null;
  closed: boolean;
  removed: boolean;
  website: string | null;
  logo_url: string | null;
  jobposting: Record<string, unknown> | string | null;
  fully_remote: boolean;
};

function asObject(value: DetailRow["jobposting"]): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return value;
}

function asParagraphs(value: DetailRow["paragraphs"]): string[] {
  const raw = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
}

function asCities(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item !== "");
}

function toDetail(row: DetailRow): JobDetail {
  const list = toListJob({
    title: row.title,
    employer_name: row.employer_name,
    location: row.location,
    location_places: row.location_places,
    closing: row.closing,
    employment_type: row.employment_type,
    path: row.path,
    total_count: "0",
  });
  return {
    ...list,
    id: row.id,
    employer_slug: row.employer_slug,
    job_slug: row.job_slug,
    page_title: row.page_title,
    meta_description: row.meta_description,
    posted: (row.posted || "").slice(0, 10),
    first_seen: (row.first_seen || "").slice(0, 10),
    fetched: (row.fetched || "").slice(0, 10),
    employment_type: row.employment_type || "",
    work_mode: row.work_mode || "",
    salary: row.salary || "",
    department: row.department || "",
    description: row.description || "",
    paragraphs: asParagraphs(row.paragraphs),
    apply_url: row.apply_url || "",
    category: row.category,
    cities: asCities(row.cities),
    closed: row.closed,
    removed: row.removed,
    website: row.website || "",
    logo_url: row.logo_url || "",
    jobposting: asObject(row.jobposting),
    fully_remote: row.fully_remote,
  };
}

const DETAIL_SQL = `select j.id, j.title, e.name as employer_name, j.employer_slug, j.job_slug,
  j.path, j.page_title, j.meta_description, j.location, j.location_places, j.closing_date::text as closing,
  j.posted_date::text as posted, j.first_seen_at::date::text as first_seen, j.fetched_at::date::text as fetched,
  j.employment_type, j.work_mode, j.salary, j.department,
  j.description, j.paragraphs, j.apply_url, j.category, j.cities, j.fully_remote, e.website, e.logo_url, j.jobposting,
  (j.removed_at is not null) as removed,
  (j.removed_at is not null or (j.closing_date is not null and j.closing_date < (timezone('America/Toronto', now()))::date)) as closed
  from jobs j
  join employers e on e.id = j.employer_id`;

async function getJobUncached(employer: string, slug: string): Promise<JobDetail | null> {
  const rows = await query<DetailRow>(
    `${DETAIL_SQL} where j.employer_slug = $1 and j.job_slug = $2 limit 1`,
    [employer, slug],
  );
  return rows[0] ? toDetail(rows[0]) : null;
}

export function getJob(employer: string, slug: string): Promise<JobDetail | null> {
  return publicCache(["job", employer, slug], () => getJobUncached(employer, slug));
}

type SimilarRow = {
  id: string;
  title: string;
  employer_name: string;
  employer_slug: string;
  category: string;
  cities: string[] | null;
  location: string | null;
  location_places: unknown;
  closing: string | null;
  employment_type: string | null;
  path: string;
};

async function similarOpenJobsUncached(job: JobDetail): Promise<ListJob[]> {
  const category = job.category || "";
  const rows = await query<SimilarRow>(
    `select j.id, j.title, e.name as employer_name, j.employer_slug, j.category, j.cities,
            j.location, j.location_places, j.closing_date::text as closing, j.employment_type, j.path
     from jobs j
     join employers e on e.id = j.employer_id
     where ${OPEN}
       and j.id <> $1
       and (
         ($3 <> '' and j.category = $3)
         or j.employer_slug = $2
       )`,
    [job.id, job.employer_slug, category],
  );
  const candidates: SimilarJobCandidate[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    employer: row.employer_name,
    employerSlug: row.employer_slug,
    category: row.category || "",
    cities: asCities(row.cities),
    location: row.location || "",
    location_places: row.location_places,
    closing: (row.closing || "").slice(0, 10),
    type: row.employment_type || "",
    path: row.path,
  }));
  return selectSimilarJobs(
    { id: job.id, category, employerSlug: job.employer_slug, cities: job.cities },
    candidates,
  );
}

export function similarOpenJobs(job: JobDetail): Promise<ListJob[]> {
  return publicCache(["similar-jobs", job.id], () => similarOpenJobsUncached(job));
}

type RankedRow = ListRow & { id: string; rn: string };

async function neighbourJobsUncached(job: JobDetail): Promise<ListJob[]> {
  try {
    const rows = await query<RankedRow>(
      `with ranked as (
         select j.id, j.title, e.name as employer_name, j.location, j.location_places,
                j.closing_date::text as closing, j.employment_type, j.path,
                row_number() over (order by ${JOB_ORDER}) as rn
         from jobs j
         join employers e on e.id = j.employer_id
         where ${OPEN} and j.employer_slug = $1
       )
       select id, title, employer_name, location, location_places, closing, employment_type, path,
              rn::text as rn, '0' as total_count
       from ranked
       order by rn::int`,
      [job.employer_slug],
    );
    const me = rows.find((row) => row.id === job.id);
    if (!me) return [];
    const ranks = new Set(neighbourRanks(Number(me.rn), rows.length));
    return rows.filter((row) => ranks.has(Number(row.rn))).map(toListJob);
  } catch (error) {
    console.error("neighbour jobs failed", error);
    return [];
  }
}

/** Open jobs just before and after this one in the employer's JOB_ORDER list. */
export function neighbourJobs(job: JobDetail): Promise<ListJob[]> {
  return publicCache(["neighbours", job.id], () => neighbourJobsUncached(job));
}

async function elsewhereJobsUncached(job: JobDetail, excludePaths: string[]): Promise<ListJob[]> {
  try {
    if (!job.category) return [];
    const rows = await query<ListRow>(
      `select j.title, e.name as employer_name, j.location, j.location_places, j.closing_date::text as closing,
              j.employment_type, j.path, '0' as total_count
       from jobs j
       join employers e on e.id = j.employer_id
       where ${OPEN}
         and j.category = $1
         and j.employer_slug <> $2
         and not (j.path = any($3::text[]))
       order by (j.cities && $4::text[]) desc, lower(j.title) asc, j.title asc, j.path asc
       limit 2`,
      [job.category, job.employer_slug, excludePaths.length ? excludePaths : [""], job.cities],
    );
    return rows.map(toListJob);
  } catch (error) {
    console.error("elsewhere jobs failed", error);
    return [];
  }
}

/** Two open jobs at other employers: same category and city, then same category. */
export function elsewhereJobs(job: JobDetail, excludePaths: string[]): Promise<ListJob[]> {
  return publicCache(["elsewhere", job.id, excludePaths.join("\n")], () => elsewhereJobsUncached(job, excludePaths));
}

async function getFacetsUncached(): Promise<Facets> {
  const [locations, employers, categories, types] = await Promise.all([
    query<{ city: string }>(
      `select distinct city from (
         select unnest(j.cities) as city from jobs j where ${OPEN}
       ) cities where city <> '' order by city`,
    ),
    query<{ slug: string; name: string }>(
      `select e.slug, e.name
       from employers e
       where exists (select 1 from jobs j where j.employer_id = e.id and ${OPEN})
       order by e.name`,
    ),
    query<{ category: string }>(
      `select distinct j.category from jobs j where ${OPEN} and j.category <> '' order by j.category`,
    ),
    query<{ job_type: string }>(
      `select distinct job_type from (
         select unnest(j.job_types) as job_type from jobs j where ${OPEN}
       ) types where job_type <> '' order by job_type`,
    ),
  ]);
  return {
    locations: locations.map((row) => row.city),
    employers,
    categories: categories.map((row) => row.category),
    types: types.map((row) => row.job_type),
  };
}

export function getFacets(): Promise<Facets> {
  return publicCache(["facets"], () => getFacetsUncached());
}

async function listEmployersUncached(): Promise<{ slug: string; name: string; open_count: number }[]> {
  const rows = await query<{ slug: string; name: string; open_count: number | string }>(
    `select e.slug, e.name,
            count(j.id) filter (where ${OPEN})::int as open_count
     from employers e
     left join jobs j on j.employer_id = e.id
     group by e.id
     order by lower(e.name), e.name`,
  );
  return rows.map((row) => ({ ...row, open_count: Number(row.open_count) }));
}

export function listEmployers(): Promise<{ slug: string; name: string; open_count: number }[]> {
  return publicCache(["employers"], () => listEmployersUncached());
}

async function employerBySlugUncached(
  slug: string,
): Promise<{ slug: string; name: string; website: string; logo_url: string } | null> {
  const rows = await query<{ slug: string; name: string; website: string | null; logo_url: string | null }>(
    `select slug, name, website, logo_url from employers where slug = $1`,
    [slug],
  );
  const row = rows[0];
  if (!row) return null;
  return { slug: row.slug, name: row.name, website: row.website || "", logo_url: row.logo_url || "" };
}

export function employerBySlug(
  slug: string,
): Promise<{ slug: string; name: string; website: string; logo_url: string } | null> {
  return publicCache(["employer", slug], () => employerBySlugUncached(slug));
}

const SOURCE_LABELS: Record<string, string> = {
  adp_workforce_now: "ADP Workforce Now",
  bamboohr: "BambooHR",
  beapplied: "BeApplied",
  comeet: "Comeet",
  dayforce_geo: "Dayforce",
  greenhouse: "Greenhouse",
  hibob: "HiBob",
  humi_applytojobs: "Humi",
  jazzhr: "JazzHR",
  jobvite: "Jobvite",
  oracle_ce: "Oracle Candidate Experience",
  peoplesoft_tps: "Oracle PeopleSoft",
  sf_classic: "SAP SuccessFactors",
  sf_rmk: "SAP SuccessFactors",
  sf_rmk_search: "SAP SuccessFactors",
  taleo: "Oracle Taleo",
  ukg_ultipro: "UKG UltiPro",
  workable: "Workable",
  workday_cxs: "Workday",
};

async function listingFactsUncached(): Promise<{ sources: string[]; fetched: string; employerCount: number }> {
  const sources = await query<{ source: string | null }>(
    `select distinct source from jobs where removed_at is null`,
  );
  const names = new Set<string>();
  for (const row of sources) {
    const key = (row.source || "").split(":")[0];
    // Same paused-feed list as the public stats page (Toronto Police Service).
    if (!key || (EXCLUDED_SOURCE_KEYS as readonly string[]).includes(key)) continue;
    if (key.startsWith("site_")) names.add("employers' own websites");
    else names.add(SOURCE_LABELS[key] || key);
  }
  const dates = await query<{ first: string | null; last: string | null }>(
    `select min(fetched_at)::date::text as first, max(fetched_at)::date::text as last
     from jobs where removed_at is null and fetched_at is not null`,
  );
  const employers = await query<{ total: string }>(`select count(*)::text as total from employers`);
  const first = dates[0]?.first || "";
  const last = dates[0]?.last || "";
  let fetched = "The current listings do not record a fetch time.";
  if (first && last && first !== last) {
    fetched = `The listings on the site now were fetched between ${formatFetched(first)} and ${formatFetched(last)}.`;
  } else if (first) {
    fetched = `The listings on the site now were fetched on ${formatFetched(first)}.`;
  }
  return {
    sources: [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    fetched,
    employerCount: Number(employers[0]?.total || 0),
  };
}

export function listingFacts(): Promise<{ sources: string[]; fetched: string; employerCount: number }> {
  return publicCache(["listing-facts"], () => listingFactsUncached());
}

function formatFetched(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[month - 1]} ${day}, ${year}`;
}

function sitemapJobsUncached(): Promise<{ path: string; lastmod: string }[]> {
  return query<{ path: string; lastmod: string }>(
    `select j.path,
            coalesce(${EFFECTIVE_POSTED}::text, '') as lastmod
     from jobs j
     where ${OPEN}
       and ${HAS_DESCRIPTION}
     order by j.path`,
  );
}

export function sitemapJobs(): Promise<{ path: string; lastmod: string }[]> {
  return publicCache(["sitemap-jobs"], () => sitemapJobsUncached());
}

async function sitemapEmployersUncached(): Promise<string[]> {
  const rows = await query<{ slug: string }>(
    `select slug from employers order by slug`,
  );
  return rows.map((row) => row.slug);
}

export function sitemapEmployers(): Promise<string[]> {
  return publicCache(["sitemap-employers"], () => sitemapEmployersUncached());
}
