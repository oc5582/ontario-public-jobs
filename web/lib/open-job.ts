/** Open job: not removed, and the closing date is today or later in Toronto, or blank. */
export const OPEN_JOB_SQL = `j.removed_at is null
  and (j.closing_date is null or j.closing_date >= (timezone('America/Toronto', now()))::date)`;

/**
 * Paused feeds left out of the public source list.
 * peoplesoft_tps is the paused Toronto Police Service feed.
 */
export const EXCLUDED_SOURCE_KEYS = ["peoplesoft_tps"] as const;
