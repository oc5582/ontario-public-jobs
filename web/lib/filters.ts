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
