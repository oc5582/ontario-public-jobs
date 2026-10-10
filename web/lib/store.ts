import { Pool, type QueryResultRow } from "pg";
import {
  MEMBER_LIMIT,
  PUBLIC_LIMIT,
  jobIsOpen,
  loadJsonJobs,
  matches,
  newestFirst,
  queryJobs,
  toListing,
  type Filters,
  type JobRecord,
  type Listing,
} from "./jobs";
import { createClient } from "./supabase/server";
import { torontoToday } from "./text";

export type EmployerSummary = {
  name: string;
  slug: string;
  openCount: number;
  website: string | null;
};

export type FilterChoices = {
  locations: string[];
  employers: { slug: string; name: string }[];
  categories: string[];
};

type Backend = "json" | "postgres" | "supabase" | "none";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL!;
    const local = /localhost|127\.0\.0\.1/.test(connectionString);
    pool = new Pool({
      connectionString,
      max: 4,
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

function backend(): Backend {
  if (process.env.DATABASE_URL) return "postgres";
  if (loadJsonJobs()) return "json";
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return "supabase";
  return "none";
}

export function dataBackend(): Backend {
  return backend();
}

function limitFor(member: boolean): number {
  return member ? MEMBER_LIMIT : PUBLIC_LIMIT;
}

function jsonJobs(): JobRecord[] {
  return loadJsonJobs() || [];
}

function cap<T>(rows: T[], member: boolean): T[] {
  return rows.slice(0, limitFor(member));
}

export async function searchJobs(filters: Filters, member: boolean, today = torontoToday()): Promise<{ total: number; jobs: Listing[] }> {
  const kind = backend();
  if (kind === "json") {
    const result = queryJobs(jsonJobs(), filters, today, member);
    return { total: result.total, jobs: result.jobs.map(toListing) };
  }
  if (kind === "postgres") {
    const { where, params } = sqlWhere(filters, today);
    const db = getPool();
    const total = await db.query<{ count: string }>(`select count(*)::text as count from jobs j ${where}`, params);
    const listed = await db.query(
      `select j.title, e.name as employer, j.employer_slug, j.job_slug, j.path, j.location, j.city,
              j.category, j.closing_date, j.posted_date, j.employment_type, j.salary, j.work_mode
       from jobs j
       join employers e on e.id = j.employer_id
       ${where}
       order by j.posted_date desc nulls last, j.fetched_at desc nulls last, j.title asc
       limit ${limitFor(member)}`,
      params,
    );
    return { total: Number(total.rows[0]?.count || 0), jobs: listed.rows.map(rowToListing) };
  }
  if (kind === "supabase") {
    const supabase = await createClient();
    if (!supabase) return { total: 0, jobs: [] };
    const args = rpcArgs(filters);
    const [counted, listed] = await Promise.all([
      supabase.rpc("count_jobs", args),
      supabase.rpc("list_jobs", args),
    ]);
    if (counted.error) throw new Error(counted.error.message);
    if (listed.error) throw new Error(listed.error.message);
    const jobs = ((listed.data || []) as QueryResultRow[]).map(rowToListing);
    return { total: Number(counted.data || 0), jobs: cap(jobs, member) };
  }
  return { total: 0, jobs: [] };
}

export async function getJob(employerSlug: string, jobSlug: string): Promise<JobRecord | null> {
  const kind = backend();
  if (kind === "json") {
    return jsonJobs().find((job) => job.employerSlug === employerSlug && job.jobSlug === jobSlug) || null;
  }
  if (kind === "postgres") {
    const result = await getPool().query(
      `select j.*, e.name as employer_name, e.website, e.logo_url
       from jobs j join employers e on e.id = j.employer_id
       where j.employer_slug = $1 and j.job_slug = $2
       limit 1`,
      [employerSlug, jobSlug],
    );
    const row = result.rows[0];
    return row ? rowToJob(row) : null;
  }
  if (kind === "supabase") {
    const supabase = await createClient();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc("get_job", {
      p_employer_slug: employerSlug,
      p_job_slug: jobSlug,
    });
    if (error) throw new Error(error.message);
    if (!data) return null;
    return jsonbToJob(data as Record<string, unknown>);
  }
  return null;
}

export async function similarJobs(job: JobRecord, today = torontoToday()): Promise<Listing[]> {
  const kind = backend();
  if (kind === "json") {
    const open = jsonJobs().filter((item) => jobIsOpen(item, today) && item.path !== job.path);
    const sameEmployer = open.filter((item) => item.employerSlug === job.employerSlug).sort(newestFirst);
    const picked = sameEmployer.slice(0, 5);
    if (picked.length < 3) {
      const more = open
        .filter((item) => item.category === job.category && item.employerSlug !== job.employerSlug)
        .sort(newestFirst);
      for (const item of more) {
        if (picked.length >= 5) break;
        picked.push(item);
      }
    }
    return picked.map(toListing);
  }
  const filters: Filters = {
    q: "",
    location: "",
    employer: job.employerSlug,
    category: "",
    jobType: "",
    salaryMin: null,
    postedAfter: null,
    closingAfter: null,
    closingBefore: null,
  };
  const same = await searchJobs(filters, true, today);
  const picked = same.jobs.filter((item) => item.jobSlug !== job.jobSlug).slice(0, 5);
  if (picked.length < 3) {
    const byCategory = await searchJobs({ ...filters, employer: "", category: job.category }, true, today);
    for (const item of byCategory.jobs) {
      if (picked.length >= 5) break;
      if (item.employerSlug === job.employerSlug) continue;
      if (picked.some((have) => have.href === item.href)) continue;
      picked.push(item);
    }
  }
  return picked.slice(0, 5);
}

export async function listEmployers(today = torontoToday()): Promise<EmployerSummary[]> {
  const kind = backend();
  if (kind === "json" || kind === "none") {
    const jobs = jsonJobs();
    const map = new Map<string, EmployerSummary>();
    for (const job of jobs) {
      const current = map.get(job.employerSlug) || {
        name: job.employer,
        slug: job.employerSlug,
        openCount: 0,
        website: job.website,
      };
      if (jobIsOpen(job, today)) current.openCount += 1;
      map.set(job.employerSlug, current);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.name.localeCompare(b.name));
  }
  if (kind === "postgres") {
    const result = await getPool().query<{ name: string; slug: string; open_count: string; website: string | null }>(
      `select e.name, e.slug, e.website,
              count(j.id) filter (
                where j.in_feed and (j.closing_date is null or j.closing_date >= $1::date)
              )::text as open_count
       from employers e
       left join jobs j on j.employer_id = e.id
       group by e.id
       order by lower(e.name), e.name`,
      [today],
    );
    return result.rows.map((row) => ({
      name: row.name,
      slug: row.slug,
      openCount: Number(row.open_count),
      website: row.website,
    }));
  }
  const employers = await listEmployersFromJobs(today);
  return employers;
}

async function listEmployersFromJobs(today: string): Promise<EmployerSummary[]> {
  const all = await searchJobs(
    { q: "", location: "", employer: "", category: "", jobType: "", salaryMin: null, postedAfter: null, closingAfter: null, closingBefore: null },
    true,
    today,
  );
  const map = new Map<string, EmployerSummary>();
  for (const job of all.jobs) {
    const current = map.get(job.employerSlug) || { name: job.employer, slug: job.employerSlug, openCount: 0, website: null };
    current.openCount += 1;
    map.set(job.employerSlug, current);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function filterChoices(today = torontoToday()): Promise<FilterChoices> {
  const kind = backend();
  if (kind === "json" || kind === "none") {
    const open = jsonJobs().filter((job) => jobIsOpen(job, today));
    return choicesFrom(open.map(toListing));
  }
  if (kind === "postgres") {
    const db = getPool();
    const open = `j.in_feed and (j.closing_date is null or j.closing_date >= $1::date)`;
    const [locations, employers, categories] = await Promise.all([
      db.query<{ city: string }>(`select distinct city from jobs j where ${open} and city <> '' order by city`, [today]),
      db.query<{ slug: string; name: string }>(
        `select distinct j.employer_slug as slug, e.name
         from jobs j join employers e on e.id = j.employer_id
         where ${open}
         order by e.name`,
        [today],
      ),
      db.query<{ category: string }>(`select distinct category from jobs j where ${open} order by category`, [today]),
    ]);
    return {
      locations: locations.rows.map((row) => row.city),
      employers: employers.rows,
      categories: categories.rows.map((row) => row.category),
    };
  }
  const all = await searchJobs(
    { q: "", location: "", employer: "", category: "", jobType: "", salaryMin: null, postedAfter: null, closingAfter: null, closingBefore: null },
    true,
    today,
  );
  return choicesFrom(all.jobs);
}

function choicesFrom(jobs: Listing[]): FilterChoices {
  const locations = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const employers = new Map<string, string>();
  for (const job of jobs) employers.set(job.employerSlug, job.employer);
  const categories = [...new Set(jobs.map((job) => job.category))].sort((a, b) => a.localeCompare(b));
  return {
    locations,
    employers: [...employers.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    categories,
  };
}

export async function sitemapJobs(today = torontoToday()): Promise<{ path: string; lastmod: string }[]> {
  const kind = backend();
  if (kind === "json" || kind === "none") {
    return jsonJobs()
      .filter((job) => jobIsOpen(job, today))
      .map((job) => ({
        path: job.path,
        lastmod: job.postedDate || (job.fetchedAt ? job.fetchedAt.slice(0, 10) : today),
      }));
  }
  if (kind === "postgres") {
    const result = await getPool().query<{ path: string; lastmod: string }>(
      `select path,
              coalesce(posted_date::text, to_char(fetched_at at time zone 'America/Toronto', 'YYYY-MM-DD'), $1) as lastmod
       from jobs j
       where j.in_feed and (j.closing_date is null or j.closing_date >= $1::date)`,
      [today],
    );
    return result.rows;
  }
  const all = await searchJobs(
    { q: "", location: "", employer: "", category: "", jobType: "", salaryMin: null, postedAfter: null, closingAfter: null, closingBefore: null },
    true,
    today,
  );
  return all.jobs.map((job) => ({ path: job.href.replace(/^\//, ""), lastmod: job.postedDate || today }));
}

function sqlWhere(filters: Filters, today: string): { where: string; params: unknown[] } {
  const clauses = ["j.in_feed", "(j.closing_date is null or j.closing_date >= $1::date)"];
  const params: unknown[] = [today];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    clauses.push(sql.replaceAll("?", `$${params.length}`));
  };
  if (filters.q) add("position(lower(?) in j.search_text) > 0", filters.q.toLowerCase());
  if (filters.location) add("j.city = ?", filters.location);
  if (filters.employer) add("j.employer_slug = ?", filters.employer);
  if (filters.category) add("j.category = ?", filters.category);
  if (filters.jobType) add("? = any(j.job_types)", filters.jobType);
  if (filters.salaryMin != null) {
    add(
      "(j.salary_max_annual >= ? or (j.salary_max_annual is null and j.salary_min_annual >= ?))",
      filters.salaryMin,
    );
  }
  if (filters.postedAfter) add("j.posted_date >= ?::date", filters.postedAfter);
  if (filters.closingAfter) add("j.closing_date >= ?::date", filters.closingAfter);
  if (filters.closingBefore) add("j.closing_date <= ?::date", filters.closingBefore);
  return { where: `where ${clauses.join(" and ")}`, params };
}

function rpcArgs(filters: Filters) {
  return {
    p_q: filters.q || null,
    p_location: filters.location || null,
    p_employer: filters.employer || null,
    p_category: filters.category || null,
    p_job_type: filters.jobType || null,
    p_salary_min: filters.salaryMin,
    p_posted_after: filters.postedAfter,
    p_closing_after: filters.closingAfter,
    p_closing_before: filters.closingBefore,
  };
}

function dateOut(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value);
  return raw.slice(0, 10) || null;
}

function rowToListing(row: QueryResultRow): Listing {
  return {
    title: row.title,
    employer: row.employer,
    employerSlug: row.employer_slug,
    jobSlug: row.job_slug,
    href: `/${String(row.path).replace(/^\//, "")}`,
    location: row.location || "",
    city: row.city || "",
    category: row.category || "Other",
    closingDate: dateOut(row.closing_date),
    postedDate: dateOut(row.posted_date),
    employmentType: row.employment_type || "",
    salary: row.salary || "",
    workMode: row.work_mode || "",
  };
}

function rowToJob(row: QueryResultRow): JobRecord {
  const annualMin = row.salary_min_annual == null ? null : Number(row.salary_min_annual);
  const annualMax = row.salary_max_annual == null ? null : Number(row.salary_max_annual);
  return {
    title: row.title,
    employer: row.employer_name || row.employer,
    employerSlug: row.employer_slug,
    jobSlug: row.job_slug,
    path: String(row.path).replace(/^\//, ""),
    location: row.location || "",
    city: row.city || "",
    category: row.category || "Other",
    closingDate: dateOut(row.closing_date),
    postedDate: dateOut(row.posted_date),
    employmentType: row.employment_type || "",
    jobTypes: row.job_types || [],
    workMode: row.work_mode || "",
    salary: row.salary || "",
    salaryMinAnnual: annualMin,
    salaryMaxAnnual: annualMax,
    department: row.department || "",
    description: row.description || "",
    applyUrl: row.apply_url || "",
    tier: row.tier || "",
    source: row.source || "",
    fetchedAt: row.fetched_at ? new Date(row.fetched_at).toISOString() : null,
    website: row.website || null,
    logoUrl: row.logo_url || null,
    searchText: row.search_text || "",
    inFeed: Boolean(row.in_feed),
  };
}

function jsonbToJob(row: Record<string, unknown>): JobRecord {
  return rowToJob({
    ...row,
    employer_name: row.employer,
    closing_date: row.closing_date,
    posted_date: row.posted_date,
  });
}

export function jobMatchesPreview(job: JobRecord, filters: Filters, today: string): boolean {
  return matches(job, filters, today);
}
