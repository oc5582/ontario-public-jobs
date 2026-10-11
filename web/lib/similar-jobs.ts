import type { ListJob } from "./types";

/** The job the similar list is built for. */
export type SimilarJobSource = {
  id: string;
  category: string;
  employerSlug: string;
  cities: readonly string[];
};

/** An open or closed posting that might appear in a similar-jobs list. */
export type SimilarJobCandidate = {
  id: string;
  title: string;
  employer: string;
  employerSlug: string;
  category: string;
  cities: readonly string[];
  location: string;
  location_places?: unknown;
  closing: string;
  type: string;
  path: string;
  closed?: boolean;
  removed?: boolean;
};

function cmp(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sharesCity(left: readonly string[], right: readonly string[]): boolean {
  const cities = new Set<string>();
  for (const city of left) {
    if (city) cities.add(city);
  }
  if (cities.size === 0) return false;
  for (const city of right) {
    if (city && cities.has(city)) return true;
  }
  return false;
}

/**
 * 3 = same category and city, 2 = same category, 1 = same employer, 0 = not similar.
 * Closed, removed, and the current job are not similar.
 */
export function similarJobTier(source: SimilarJobSource, candidate: SimilarJobCandidate): 0 | 1 | 2 | 3 {
  if (candidate.id === source.id || candidate.closed || candidate.removed) return 0;
  const sameCategory = source.category !== "" && candidate.category === source.category;
  const sameEmployer = source.employerSlug !== "" && candidate.employerSlug === source.employerSlug;
  if (sameCategory && sharesCity(source.cities || [], candidate.cities || [])) return 3;
  if (sameCategory) return 2;
  if (sameEmployer) return 1;
  return 0;
}

function jobHref(path: string): string {
  const normalized = path.endsWith("/") ? path : `${path}/`;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

/**
 * Up to `limit` open jobs: same category and city, then same category, then same employer.
 * Within a tier, titles sort alphabetically and paths break ties. Same inputs always
 * return the same list.
 */
export function selectSimilarJobs(
  source: SimilarJobSource,
  candidates: readonly SimilarJobCandidate[],
  limit = 5,
): ListJob[] {
  const cap = limit < 1 ? 0 : limit;
  const ranked = candidates
    .map((candidate) => ({ candidate, tier: similarJobTier(source, candidate) }))
    .filter((item) => item.tier > 0)
    .sort((a, b) => {
      if (a.tier !== b.tier) return b.tier - a.tier;
      const title = cmp(a.candidate.title.toLowerCase(), b.candidate.title.toLowerCase());
      if (title !== 0) return title;
      const exactTitle = cmp(a.candidate.title, b.candidate.title);
      if (exactTitle !== 0) return exactTitle;
      return cmp(a.candidate.path, b.candidate.path);
    });

  const seen = new Set<string>();
  const jobs: ListJob[] = [];
  for (const item of ranked) {
    if (jobs.length === cap) break;
    if (seen.has(item.candidate.id)) continue;
    seen.add(item.candidate.id);
    const path = item.candidate.path.endsWith("/") ? item.candidate.path : `${item.candidate.path}/`;
    jobs.push({
      title: item.candidate.title,
      employer: item.candidate.employer,
      location: item.candidate.location,
      location_places: item.candidate.location_places,
      closing: item.candidate.closing.slice(0, 10),
      type: item.candidate.type,
      href: jobHref(item.candidate.path),
      path: path.startsWith("/") ? path.slice(1) : path,
    });
  }
  return jobs;
}
