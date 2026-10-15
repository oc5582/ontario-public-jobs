/** Canonical applications.job_path: jobs/{employer}/{slug}, no surrounding slashes. */
export function applicationKey(value: string): string | null {
  let path = value.trim();
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      path = new URL(path).pathname;
    } catch {
      return null;
    }
  }
  path = path.split("?")[0].split("#")[0].replace(/^\/+|\/+$/g, "");
  return /^jobs\/[^/]+\/[^/]+$/.test(path) ? path : null;
}

export function isMarkedApplied(value: string, applied: ReadonlySet<string>): boolean {
  const key = applicationKey(value);
  return key !== null && applied.has(key);
}

/** Hide is off unless the member checks it. Unchecked returns every hit. */
export function hideAppliedHits<T extends { url: string }>(
  hits: T[],
  applied: ReadonlySet<string>,
  hide: boolean,
): T[] {
  if (!hide) return hits;
  return hits.filter((hit) => !isMarkedApplied(hit.url, applied));
}
