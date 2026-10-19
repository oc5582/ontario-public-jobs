import { query } from "./db";

/** Days a free-match email record is kept after its last free run. After that the email can get another free run. */
export const FREE_MATCH_RETENTION_DAYS = 90;
/** Days the per-network daily counters are kept. */
export const FREE_NETWORK_RETENTION_DAYS = 7;

export type MatchCleanupResult = { freeRunsDeleted: number; networksDeleted: number } | { error: string };

/**
 * Daily cleanup of the signed-out match ledger. Never throws, so a missing table
 * (migration not applied yet) cannot break the other cleanup in the same cron.
 */
export async function purgeFreeMatchRecords(): Promise<MatchCleanupResult> {
  try {
    const runs = await query<{ email_key: string }>(
      `delete from match_free_runs
       where greatest(last_run_at, created_at) < now() - make_interval(days => $1)
       returning email_key`,
      [FREE_MATCH_RETENTION_DAYS],
    );
    const nets = await query<{ net_hash: string }>(
      `delete from match_free_networks
       where used_on < (now() at time zone 'America/Toronto')::date - $1::int
       returning net_hash`,
      [FREE_NETWORK_RETENTION_DAYS],
    );
    return { freeRunsDeleted: runs.length, networksDeleted: nets.length };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 160) : "error";
    console.log(JSON.stringify({ event: "match_cleanup_failed", message }));
    return { error: message };
  }
}
