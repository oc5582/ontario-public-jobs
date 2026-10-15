import { applicationKey, safeHttpUrl } from "./application-key";
import { query } from "./db";

export async function listApplicationKeys(userId: string): Promise<Set<string>> {
  const rows = await query<{ job_path: string }>(
    `select job_path from applications where user_id = $1`,
    [userId],
  );
  return new Set(rows.map((row) => row.job_path));
}

export async function hasApplication(userId: string, key: string): Promise<boolean> {
  const rows = await query<{ ok: number }>(
    `select 1 as ok from applications where user_id = $1 and job_path = $2 limit 1`,
    [userId, key],
  );
  return rows.length > 0;
}

/**
 * True when the requested state is stored. Marking a path that is not a job returns false.
 * Marking copies the key job details onto the row so the member's list survives the job
 * leaving the board. Marking again refreshes the copy and the date.
 */
export async function setApplication(userId: string, path: string, applied: boolean): Promise<boolean> {
  const key = applicationKey(path);
  if (!key) return false;
  if (!applied) {
    await query(`delete from applications where user_id = $1 and job_path = $2`, [userId, key]);
    return true;
  }
  const rows = await query<{ job_path: string }>(
    `insert into applications (
       user_id, job_id, job_path, job_title, employer_name, job_location, location_places,
       salary, closing_date, apply_url
     )
     select $1, j.id, $2, j.title, e.name, j.location, j.location_places,
            j.salary, j.closing_date, j.apply_url
     from jobs j
     join employers e on e.id = j.employer_id
     where btrim(j.path, '/') = $2
     on conflict (user_id, job_path) do update
       set applied_at = now(),
           job_id = excluded.job_id,
           job_title = excluded.job_title,
           employer_name = excluded.employer_name,
           job_location = excluded.job_location,
           location_places = excluded.location_places,
           salary = excluded.salary,
           closing_date = excluded.closing_date,
           apply_url = excluded.apply_url
     returning job_path`,
    [userId, key],
  );
  return rows.length > 0;
}

/** Hard cap on one member's list. Far above any real use; keeps the query bounded. */
export const APPLIED_HISTORY_LIMIT = 500;

export type AppliedEntry = {
  path: string;
  title: string;
  employer: string;
  location: string;
  location_places: unknown;
  salary: string;
  closing: string;
  applyUrl: string;
  appliedAt: string;
  /** Our job page still renders (the row exists, even if closed). */
  pageExists: boolean;
  /** Removed from the feed, past its closing date, or deleted. */
  closed: boolean;
};

type AppliedRow = {
  job_path: string;
  job_title: string;
  employer_name: string;
  job_location: string;
  location_places: unknown;
  salary: string;
  closing: string | null;
  apply_url: string;
  applied_at: string;
  page_exists: boolean;
  closed: boolean;
};

/**
 * The member's applied list, newest first, from the copy stored on each mark.
 * The live job row is read only to know whether its page still exists and is open.
 */
export async function listAppliedJobs(userId: string): Promise<AppliedEntry[]> {
  const rows = await query<AppliedRow>(
    `select a.job_path, a.job_title, a.employer_name, a.job_location, a.location_places, a.salary,
            a.closing_date::text as closing, a.apply_url, a.applied_at::text as applied_at,
            (j.id is not null) as page_exists,
            (j.id is null
              or j.removed_at is not null
              or (coalesce(j.closing_date, a.closing_date) is not null
                  and coalesce(j.closing_date, a.closing_date) < (timezone('America/Toronto', now()))::date)
            ) as closed
     from applications a
     left join jobs j on j.id = a.job_id
     where a.user_id = $1
     order by a.applied_at desc
     limit ${APPLIED_HISTORY_LIMIT}`,
    [userId],
  );
  return rows.map((row) => ({
    path: row.job_path,
    title: row.job_title || "Saved job",
    employer: row.employer_name || "",
    location: row.job_location || "",
    location_places: row.location_places,
    salary: row.salary || "",
    closing: (row.closing || "").slice(0, 10),
    applyUrl: safeHttpUrl(row.apply_url),
    appliedAt: row.applied_at,
    pageExists: row.page_exists,
    closed: row.closed,
  }));
}

/** Marks kept for a member whose membership has lapsed. Only the count is read. */
export async function countApplications(userId: string): Promise<number> {
  const rows = await query<{ n: number }>(`select count(*)::int as n from applications where user_id = $1`, [userId]);
  return rows[0]?.n || 0;
}
