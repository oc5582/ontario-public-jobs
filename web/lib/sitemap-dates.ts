/**
 * lastmod values for pages whose text lives in the repo.
 * Each date is the last commit that changed that page's visible content.
 * Update the date when the page changes. Do not stamp today's date on
 * unchanged pages, and do not use a future date.
 */
export const STATIC_LASTMOD: Record<string, string> = {
  "/match/": "2026-10-19",
  "/pricing/": "2026-11-01",
  "/about/": "2026-11-07",
  "/faq/": "2026-11-07",
  "/privacy/": "2026-11-17",
  "/terms/": "2026-10-11",
};

/** ISO date on or before today, or "" when the value is missing or still in the future. */
export function sitemapLastmod(value: string, today: string): string {
  const date = (value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return "";
  if (date > today) return "";
  return date;
}
