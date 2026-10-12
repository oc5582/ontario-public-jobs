import { hasFilters, type JobFilters } from "./filters";

/** Posted annual maximum that counts as the paywall salary stat. */
export const PAYWALL_HIGH_SALARY = 100_000;

/** Locked rows under the free list. Fewer are shown when fewer jobs remain. */
export const PAYWALL_TEASER_LIMIT = 5;

/**
 * Columns for locked rows. Real titles, employers, paths, and links stay out
 * of this select so they cannot reach the HTML.
 */
export const PAYWALL_TEASER_SELECT =
  "j.salary, j.salary_annual_min, j.salary_annual_max, j.employment_type, j.closing_date::text as closing";

export type PaywallPlace = "home" | "jobs" | "employer";

export type PaywallTeaser = {
  salary: string;
  type: string;
  closing: string;
};

export type PaywallPreview = {
  highPay: number;
  teasers: PaywallTeaser[];
};

export type PaywallFacts = {
  place: PaywallPlace;
  remaining: number;
  highPay: number;
  employerName?: string;
  focus?: string;
  filtering: boolean;
};

/** Filters other than the employer page itself. */
export function paywallFiltering(filters: JobFilters): boolean {
  return hasFilters({ ...filters, employer: "" });
}

/** A short search or category the sentence can name. Empty when the filters are mixed. */
export function paywallFocus(filters: JobFilters): string {
  const q = filters.q.trim().replace(/\s+/g, " ");
  if (q.length > 0 && q.length <= 40) return q;
  const category = filters.category.trim().replace(/\s+/g, " ");
  if (category.length > 0 && category.length <= 48) return category;
  return "";
}

function count(value: number): string {
  return value.toLocaleString("en-CA");
}

function jobWord(remaining: number): string {
  return remaining === 1 ? "job" : "jobs";
}

function matchVerb(remaining: number): string {
  return remaining === 1 ? "matches" : "match";
}

/** Sentence that replaces the generic membership line. Salary clause omitted at zero. */
export function paywallDetail(facts: PaywallFacts): string {
  const n = count(facts.remaining);
  const jobs = jobWord(facts.remaining);
  const focus = (facts.focus || "").trim();
  const named = focus ? `${focus} ${jobs}` : jobs;
  let sentence: string;
  if (facts.place === "employer" && facts.employerName) {
    if (facts.filtering) {
      sentence = `${facts.employerName} has ${n} more ${named} matching your filters`;
    } else {
      const open = facts.remaining === 1 ? "open job" : "open jobs";
      sentence = `${facts.employerName} has ${n} more ${focus ? named : open}`;
    }
  } else if (facts.filtering) {
    sentence = `${n} more ${named} ${matchVerb(facts.remaining)} your filters`;
  } else {
    const open = facts.remaining === 1 ? "open job" : "open jobs";
    sentence = `${n} more ${open}`;
  }
  if (facts.highPay > 0) {
    sentence += `, ${count(facts.highPay)} paying over $100k`;
  }
  return `${sentence}.`;
}

function finite(value: number | null): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function cad(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Posted salary text, or the posted annual bounds when the text is empty. */
export function postedSalaryLabel(salary: string, min: number | null, max: number | null): string {
  const text = salary.replace(/\s+/g, " ").trim();
  if (text) return text.length > 72 ? `${text.slice(0, 71).trimEnd()}…` : text;
  const lo = finite(min);
  const hi = finite(max);
  if (lo == null && hi == null) return "";
  if (lo != null && hi != null && lo !== hi) return `${cad(lo)}–${cad(hi)}`;
  const one = hi ?? lo;
  return one == null ? "" : cad(one);
}

export function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parsePaywallTeasers(value: unknown): PaywallTeaser[] {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, PAYWALL_TEASER_LIMIT).map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      salary: postedSalaryLabel(
        typeof row.salary === "string" ? row.salary : "",
        numberOrNull(row.salary_min),
        numberOrNull(row.salary_max),
      ),
      type: typeof row.type === "string" ? row.type : "",
      closing: typeof row.closing === "string" ? row.closing.slice(0, 10) : "",
    };
  });
}
