import { unstable_cache } from "next/cache";
import { query } from "./db";
import { hasFilters, type JobFilters } from "./filters";
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

const OPEN = `j.removed_at is null
  and (j.closing_date is null or j.closing_date >= (timezone('America/Toronto', now()))::date)`;

type ListRow = {
  title: string;
  employer_name: string;
  location: string;
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
    parts.push(`j.posted_date >= $${params.length}::date`);
  }
  if (filters.closesBy) {
    params.push(filters.closesBy);
    parts.push(`j.closing_date is not null and j.closing_date <= $${params.length}::date`);
  }
  return parts.join("\n  and ");
}

function toListJob(row: ListRow): ListJob {
  const path = row.path.endsWith("/") ? row.path : `${row.path}/`;
  return {
    title: row.title,
    employer: row.employer_name,
    location: row.location || "",
    closing: (row.closing || "").slice(0, 10),
    type: row.employment_type || "",
    href: `/${path}`,
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
    `select j.title, e.name as employer_name, j.location, j.closing_date::text as closing,
            j.employment_type, j.path, count(*) over() as total_count
     from jobs j
     join employers e on e.id = j.employer_id
     where ${where}
     order by j.posted_date desc nulls last, j.fetched_at desc nulls last, j.title asc
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
  closing: string | null;
  posted: string | null;
  employment_type: string;
  work_mode: string;
  salary: string;
  department: string;
  description: string | null;
  paragraphs: string[] | string;
  apply_url: string;
  category: string;
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

function toDetail(row: DetailRow): JobDetail {
  const list = toListJob({
    title: row.title,
    employer_name: row.employer_name,
    location: row.location,
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
    employment_type: row.employment_type || "",
    work_mode: row.work_mode || "",
    salary: row.salary || "",
    department: row.department || "",
    description: row.description || "",
    paragraphs: asParagraphs(row.paragraphs),
    apply_url: row.apply_url || "",
    category: row.category,
    closed: row.closed,
    removed: row.removed,
    website: row.website || "",
    logo_url: row.logo_url || "",
    jobposting: asObject(row.jobposting),
    fully_remote: row.fully_remote,
  };
}

const DETAIL_SQL = `select j.id, j.title, e.name as employer_name, j.employer_slug, j.job_slug,
  j.path, j.page_title, j.meta_description, j.location, j.closing_date::text as closing,
  j.posted_date::text as posted, j.employment_type, j.work_mode, j.salary, j.department,
  j.description, j.paragraphs, j.apply_url, j.category, j.fully_remote, e.website, e.logo_url, j.jobposting,
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

async function similarOpenJobsUncached(job: JobDetail): Promise<ListJob[]> {
  const rows = await query<ListRow>(
    `select j.title, e.name as employer_name, j.location, j.closing_date::text as closing,
            j.employment_type, j.path, '0' as total_count
     from jobs j
     join employers e on e.id = j.employer_id
     where ${OPEN}
       and j.id <> $1
       and (j.employer_slug = $2 or j.category = $3)
     order by (j.employer_slug = $2) desc, j.posted_date desc nulls last
     limit 5`,
    [job.id, job.employer_slug, job.category],
  );
  return rows.map(toListJob);
}

export function similarOpenJobs(job: JobDetail): Promise<ListJob[]> {
  return publicCache(["similar", job.id], () => similarOpenJobsUncached(job));
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
    if (!key) continue;
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
            coalesce(j.posted_date::text, j.fetched_at::date::text, '') as lastmod
     from jobs j
     where ${OPEN}
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
