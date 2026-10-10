import { text } from "./text";

export type PathJob = {
  title?: string;
  employer?: string;
  apply_url?: string;
  closing_date?: string;
};

export function slugify(value: string): string {
  let out = text(value).toLowerCase().replaceAll("_", "-");
  out = out.replace(/[^a-z0-9]+/g, "-");
  return out.replace(/^-+|-+$/g, "");
}

function requisitionId(job: PathJob): string {
  const url = text(job.apply_url);
  const last = url.replace(/\/+$/, "").split("/").pop() || "";
  const match = last.match(/((?:JR|R)[-_]?\d+)$/i);
  if (match) return slugify(match[1]);
  return slugify(last).slice(-16);
}

export function employerSlug(job: PathJob): string {
  return slugify(text(job.employer)) || "employer";
}

function titleSlug(job: PathJob): string {
  return (slugify(text(job.title)) || "untitled").slice(0, 80).replace(/-+$/g, "");
}

function pathKey(job: PathJob): { group: number; date: string; title: string } {
  const closing = text(job.closing_date);
  if (/^\d{4}-\d{2}-\d{2}/.test(closing)) {
    const iso = closing.slice(0, 10);
    const parsed = Date.parse(`${iso}T00:00:00Z`);
    if (!Number.isNaN(parsed)) {
      return { group: 0, date: iso, title: text(job.title) };
    }
  }
  return { group: 1, date: "9999-12-31", title: text(job.title) };
}

/** Same order scripts/build_pages.py uses before assign_paths. */
export function sortForPaths<T extends PathJob>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) => {
    const ka = pathKey(a);
    const kb = pathKey(b);
    if (ka.group !== kb.group) return ka.group - kb.group;
    if (ka.date < kb.date) return -1;
    if (ka.date > kb.date) return 1;
    if (ka.title < kb.title) return -1;
    if (ka.title > kb.title) return 1;
    return 0;
  });
}

export type Assigned<T> = T & {
  _employer_slug: string;
  _job_slug: string;
  _path: string;
};

/** Port of scripts/build_pages.py assign_paths. Paths stay stable with the live site. */
export function assignPaths<T extends PathJob>(jobs: T[]): Assigned<T>[] {
  const ordered = sortForPaths(jobs);
  const groups = new Map<string, T[]>();
  for (const job of ordered) {
    const key = employerSlug(job);
    const group = groups.get(key);
    if (group) group.push(job);
    else groups.set(key, [job]);
  }
  const assigned: Assigned<T>[] = [];
  for (const [empSlug, group] of groups) {
    const bases = group.map((job) => titleSlug(job));
    const counts = new Map<string, number>();
    for (const base of bases) counts.set(base, (counts.get(base) || 0) + 1);
    const used = new Set<string>();
    group.forEach((job, index) => {
      const base = bases[index];
      let slug = base || "untitled";
      if ((counts.get(base) || 0) > 1) {
        const req = requisitionId(job);
        if (req) {
          const combined = `${base}-${req}`;
          if (combined.length <= 80) {
            slug = combined.replace(/-+$/g, "");
          } else {
            const suffix = `-${req}`;
            const room = 80 - suffix.length;
            const head = room > 0 ? base.slice(0, room).replace(/-+$/g, "") : "";
            slug = head ? `${head}${suffix}` : req.slice(0, 80);
          }
        }
      }
      const original = slug;
      let n = 2;
      while (!slug || used.has(slug)) {
        const suffix = `-${n}`;
        const room = Math.max(1, 80 - suffix.length);
        slug = (original.slice(0, room) + suffix).replace(/-+$/g, "");
        n += 1;
      }
      used.add(slug);
      assigned.push({
        ...job,
        _employer_slug: empSlug,
        _job_slug: slug,
        _path: `jobs/${empSlug}/${slug}/`,
      });
    });
  }
  return assigned;
}
