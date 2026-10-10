import { addDays, torontoToday } from "./text";
import { EMPTY_FILTERS, type Filters } from "./jobs";

export type SearchParams = Record<string, string | string[] | undefined>;

function one(sp: SearchParams, key: string): string {
  const value = sp[key];
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw || "").trim();
}

export function readFilters(sp: SearchParams, today = torontoToday()): Filters {
  const filters: Filters = { ...EMPTY_FILTERS, q: one(sp, "q").slice(0, 120) };
  filters.location = one(sp, "location").slice(0, 80);
  filters.employer = one(sp, "employer").slice(0, 120);
  filters.category = one(sp, "category").slice(0, 80);
  const type = one(sp, "type");
  if (["full-time", "part-time", "contract", "temporary", "intern", "casual"].includes(type)) {
    filters.jobType = type;
  }
  const salary = Number(one(sp, "salary"));
  if (Number.isFinite(salary) && salary > 0 && salary < 1000000) filters.salaryMin = salary;
  const posted = one(sp, "posted");
  if (posted === "7" || posted === "30" || posted === "90") {
    filters.postedAfter = addDays(today, -Number(posted));
  }
  const closing = one(sp, "closing");
  if (closing === "7" || closing === "30") {
    filters.closingAfter = today;
    filters.closingBefore = addDays(today, Number(closing));
  } else if (closing === "later") {
    filters.closingAfter = addDays(today, 31);
  }
  return filters;
}

export function filtersActive(sp: SearchParams): boolean {
  return ["q", "location", "employer", "category", "type", "salary", "posted", "closing"].some((key) => one(sp, key) !== "");
}

export function hiddenFilterFields(filters: Filters, sp: SearchParams, omit: string[] = []): { name: string; value: string }[] {
  const fields: { name: string; value: string }[] = [];
  const push = (name: string, value: string) => {
    if (!omit.includes(name) && value) fields.push({ name, value });
  };
  push("q", one(sp, "q"));
  push("location", filters.location);
  push("employer", one(sp, "employer"));
  push("category", filters.category);
  push("type", one(sp, "type"));
  push("salary", one(sp, "salary"));
  push("posted", one(sp, "posted"));
  push("closing", one(sp, "closing"));
  return fields;
}
