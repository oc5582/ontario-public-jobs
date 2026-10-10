/** Query keys that change a public list. Filtered URLs stay dynamic. */
export const LIST_FILTER_KEYS = [
  "q",
  "location",
  "employer",
  "category",
  "type",
  "salary_min",
  "salary_max",
  "posted_since",
  "closes_by",
  "page",
] as const;

export function hasListFilter(params: { has: (key: string) => boolean }): boolean {
  return LIST_FILTER_KEYS.some((key) => params.has(key));
}

/**
 * Public HTML that can be cached for anonymous visitors with no filters.
 * Returns the internal dynamic path, or null when the URL is not one of those pages.
 */
export function livePathFor(pathname: string): string | null {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (path === "" || path === "/") return "/dynamic/";
  if (path === "/jobs") return "/dynamic/jobs/";
  if (/^\/jobs\/[^/]+\/[^/]+$/.test(path)) return `/dynamic${path}/`;
  if (path === "/employers") return "/dynamic/employers/";
  if (/^\/employers\/[^/]+$/.test(path)) return `/dynamic${path}/`;
  return null;
}

export function isListPath(pathname: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (path === "" || path === "/" || path === "/jobs" || path === "/employers") return true;
  return /^\/employers\/[^/]+$/.test(path);
}
