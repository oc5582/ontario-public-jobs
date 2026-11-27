export type MatchJobRef = { id: string } | { employer: string; slug: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `?job=` on /match: a job id, or an employer/slug path. Anything else is ignored. */
export function parseMatchJobParam(value: string): MatchJobRef | null {
  const raw = value.trim();
  if (!raw || raw.length > 300) return null;
  let path = raw;
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) path = new URL(path).pathname;
  } catch {
    return null;
  }
  path = path.split("?")[0].split("#")[0].replace(/^\/+|\/+$/g, "");
  if (path.toLowerCase().startsWith("jobs/")) path = path.slice(5);
  if (UUID.test(path)) return { id: path.toLowerCase() };
  const parts = path.split("/");
  if (parts.length !== 2) return null;
  const employer = parts[0].toLowerCase();
  const slug = parts[1].toLowerCase();
  if (!SLUG.test(employer) || !SLUG.test(slug)) return null;
  return { employer, slug };
}
