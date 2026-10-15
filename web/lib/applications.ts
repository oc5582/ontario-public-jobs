import { applicationKey } from "./application-key";
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

/** True when the requested state is stored. Marking a path that is not a job returns false. */
export async function setApplication(userId: string, path: string, applied: boolean): Promise<boolean> {
  const key = applicationKey(path);
  if (!key) return false;
  if (!applied) {
    await query(`delete from applications where user_id = $1 and job_path = $2`, [userId, key]);
    return true;
  }
  const rows = await query<{ job_path: string }>(
    `insert into applications (user_id, job_id, job_path)
     select $1, j.id, $2
     from jobs j
     where btrim(j.path, '/') = $2
     on conflict (user_id, job_path) do update
       set applied_at = now(), job_id = excluded.job_id
     returning job_path`,
    [userId, key],
  );
  return rows.length > 0;
}
