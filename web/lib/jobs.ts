import fs from "fs";
import path from "path";
import {
  EMPLOYER_WEBSITES,
  SEARCH_ALIASES,
  annualSalary,
  categoryFor,
  isExcluded,
  jobTypeCodes,
  postedIso,
  primaryCity,
} from "./classify";
import { assignPaths } from "./paths";
import { isoDate, text } from "./text";

export const PUBLIC_LIMIT = 10;
export const MEMBER_LIMIT = 5000;

export type RawListing = {
  title?: string;
  employer?: string;
  location?: string;
  closing_date?: string;
  posted_date?: string;
  employment_type?: string;
  work_mode?: string;
  salary?: string;
  department?: string;
  description?: string;
  apply_url?: string;
  tier?: string;
  source?: string;
  fetched_at?: string;
  employer_url?: string;
  website?: string;
  same_as?: string;
  logo_url?: string;
};

export type JobRecord = {
  title: string;
  employer: string;
  employerSlug: string;
  jobSlug: string;
  path: string;
  location: string;
  city: string;
  category: string;
  closingDate: string | null;
  postedDate: string | null;
  employmentType: string;
  jobTypes: string[];
  workMode: string;
  salary: string;
  salaryMinAnnual: number | null;
  salaryMaxAnnual: number | null;
  department: string;
  description: string;
  applyUrl: string;
  tier: string;
  source: string;
  fetchedAt: string | null;
  website: string | null;
  logoUrl: string | null;
  searchText: string;
  inFeed: boolean;
};

export type Listing = {
  title: string;
  employer: string;
  employerSlug: string;
  jobSlug: string;
  href: string;
  location: string;
  city: string;
  category: string;
  closingDate: string | null;
  postedDate: string | null;
  employmentType: string;
  salary: string;
  workMode: string;
};

export type Filters = {
  q: string;
  location: string;
  employer: string;
  category: string;
  jobType: string;
  salaryMin: number | null;
  postedAfter: string | null;
  closingAfter: string | null;
  closingBefore: string | null;
};

export const EMPTY_FILTERS: Filters = {
  q: "",
  location: "",
  employer: "",
  category: "",
  jobType: "",
  salaryMin: null,
  postedAfter: null,
  closingAfter: null,
  closingBefore: null,
};

export function toListing(job: JobRecord): Listing {
  return {
    title: job.title,
    employer: job.employer,
    employerSlug: job.employerSlug,
    jobSlug: job.jobSlug,
    href: `/${job.path}`,
    location: job.location,
    city: job.city,
    category: job.category,
    closingDate: job.closingDate,
    postedDate: job.postedDate,
    employmentType: job.employmentType,
    salary: job.salary,
    workMode: job.workMode,
  };
}

function websiteFor(job: RawListing, employer: string): string | null {
  for (const key of ["employer_url", "website", "same_as", "sameAs"]) {
    const raw = text((job as Record<string, unknown>)[key]);
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  }
  return EMPLOYER_WEBSITES[employer] || null;
}

export function prepareListings(raw: RawListing[]): JobRecord[] {
  const kept = raw.filter((job) => !isExcluded(job));
  const assigned = assignPaths(kept);
  return assigned.map((job) => {
    const employer = text(job.employer);
    const title = text(job.title) || "Untitled";
    const salary = text(job.salary);
    const annual = annualSalary(salary);
    const alias = SEARCH_ALIASES[employer] || "";
    const location = text(job.location);
    const department = text(job.department);
    return {
      title,
      employer,
      employerSlug: job._employer_slug,
      jobSlug: job._job_slug,
      path: job._path,
      location,
      city: primaryCity(location),
      category: categoryFor(title, department),
      closingDate: isoDate(text(job.closing_date)) || null,
      postedDate: postedIso(text(job.posted_date)),
      employmentType: text(job.employment_type),
      jobTypes: jobTypeCodes(text(job.employment_type)),
      workMode: text(job.work_mode),
      salary,
      salaryMinAnnual: annual.min,
      salaryMaxAnnual: annual.max,
      department,
      description: text(job.description),
      applyUrl: text(job.apply_url),
      tier: text(job.tier),
      source: text(job.source),
      fetchedAt: text(job.fetched_at) || null,
      website: websiteFor(job, employer),
      logoUrl: text(job.logo_url) || null,
      searchText: [title, employer, alias, location].join(" ").toLowerCase(),
      inFeed: true,
    };
  });
}

export function listingsFile(): string | null {
  const configured = process.env.LISTINGS_PATH;
  const candidates = [
    configured,
    path.resolve(process.cwd(), "../data/listings.json"),
    path.resolve(process.cwd(), "data/listings.json"),
  ].filter((item): item is string => Boolean(item));
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

let cached: { file: string; mtimeMs: number; jobs: JobRecord[] } | null = null;

export function loadJsonJobs(): JobRecord[] | null {
  const file = listingsFile();
  if (!file) return null;
  const mtimeMs = fs.statSync(file).mtimeMs;
  if (cached && cached.file === file && cached.mtimeMs === mtimeMs) return cached.jobs;
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as RawListing[];
  if (!Array.isArray(raw)) throw new Error("listings.json must be a JSON array");
  const jobs = prepareListings(raw);
  cached = { file, mtimeMs, jobs };
  return jobs;
}

export function jobIsOpen(job: Pick<JobRecord, "closingDate" | "inFeed">, today: string): boolean {
  if (!job.inFeed) return false;
  if (!job.closingDate) return true;
  return job.closingDate >= today;
}

function salaryMatches(job: JobRecord, min: number): boolean {
  if (job.salaryMaxAnnual != null && job.salaryMaxAnnual >= min) return true;
  if (job.salaryMaxAnnual == null && job.salaryMinAnnual != null && job.salaryMinAnnual >= min) return true;
  return false;
}

export function matches(job: JobRecord, filters: Filters, today: string): boolean {
  if (!jobIsOpen(job, today)) return false;
  if (filters.q && !job.searchText.includes(filters.q.toLowerCase())) return false;
  if (filters.location && job.city !== filters.location) return false;
  if (filters.employer && job.employerSlug !== filters.employer) return false;
  if (filters.category && job.category !== filters.category) return false;
  if (filters.jobType && !job.jobTypes.includes(filters.jobType)) return false;
  if (filters.salaryMin != null && !salaryMatches(job, filters.salaryMin)) return false;
  if (filters.postedAfter && (!job.postedDate || job.postedDate < filters.postedAfter)) return false;
  if (filters.closingAfter && (!job.closingDate || job.closingDate < filters.closingAfter)) return false;
  if (filters.closingBefore && (!job.closingDate || job.closingDate > filters.closingBefore)) return false;
  return true;
}

export function newestFirst(a: JobRecord, b: JobRecord): number {
  const ap = a.postedDate || "";
  const bp = b.postedDate || "";
  if (ap !== bp) return ap < bp ? 1 : -1;
  const af = a.fetchedAt || "";
  const bf = b.fetchedAt || "";
  if (af !== bf) return af < bf ? 1 : -1;
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
}

export function queryJobs(
  jobs: JobRecord[],
  filters: Filters,
  today: string,
  member: boolean,
): { total: number; jobs: JobRecord[] } {
  const matched = jobs.filter((job) => matches(job, filters, today)).sort(newestFirst);
  const limit = member ? MEMBER_LIMIT : PUBLIC_LIMIT;
  return { total: matched.length, jobs: matched.slice(0, limit) };
}
