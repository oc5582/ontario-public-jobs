export type JobFilters = {
  q: string;
  location: string;
  employer: string;
  category: string;
  type: string;
  salaryMin: number | null;
  salaryMax: number | null;
  postedSince: string;
  closesBy: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function one(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw || "").trim();
}

function money(value: string): number | null {
  if (!value) return null;
  const number = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
}

export function emptyFilters(): JobFilters {
  return {
    q: "",
    location: "",
    employer: "",
    category: "",
    type: "",
    salaryMin: null,
    salaryMax: null,
    postedSince: "",
    closesBy: "",
  };
}

export function filtersFromSearch(
  params: Record<string, string | string[] | undefined>,
): JobFilters {
  const posted = one(params.posted_since);
  const closes = one(params.closes_by);
  return {
    q: one(params.q).slice(0, 120),
    location: one(params.location).slice(0, 80),
    employer: one(params.employer).slice(0, 120),
    category: one(params.category).slice(0, 80),
    type: one(params.type).slice(0, 40),
    salaryMin: money(one(params.salary_min)),
    salaryMax: money(one(params.salary_max)),
    postedSince: DATE.test(posted) ? posted : "",
    closesBy: DATE.test(closes) ? closes : "",
  };
}

export function hasFilters(filters: JobFilters): boolean {
  return Boolean(
    filters.q ||
      filters.location ||
      filters.employer ||
      filters.category ||
      filters.type ||
      filters.salaryMin != null ||
      filters.salaryMax != null ||
      filters.postedSince ||
      filters.closesBy,
  );
}

export function pageParam(params: Record<string, string | string[] | undefined>): number {
  const raw = Number(one(params.page));
  if (!Number.isInteger(raw) || raw < 1) return 1;
  return raw;
}

export function hasPageParam(params: Record<string, string | string[] | undefined>): boolean {
  return Object.prototype.hasOwnProperty.call(params, "page");
}

export function queryFromFilters(filters: JobFilters): string {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.location) search.set("location", filters.location);
  if (filters.employer) search.set("employer", filters.employer);
  if (filters.category) search.set("category", filters.category);
  if (filters.type) search.set("type", filters.type);
  if (filters.salaryMin != null) search.set("salary_min", String(filters.salaryMin));
  if (filters.salaryMax != null) search.set("salary_max", String(filters.salaryMax));
  if (filters.postedSince) search.set("posted_since", filters.postedSince);
  if (filters.closesBy) search.set("closes_by", filters.closesBy);
  return search.toString();
}

export function searchWithoutPage(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value == null) continue;
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (item) search.append(key, item);
    }
  }
  return search.toString();
}
