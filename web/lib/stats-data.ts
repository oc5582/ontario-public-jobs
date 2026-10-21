import { unstable_cache } from "next/cache";
import { query } from "./db";
import { buildPublicJobStats, excludedSourceKeys, statsSql, type PublicJobStats } from "./stats";
import { SITE_URL } from "./site";

const REVALIDATE_SECONDS = 900;

async function publicJobStatsUncached(): Promise<PublicJobStats> {
  const rows = await query<{ stats: unknown }>(statsSql(), [excludedSourceKeys()]);
  const stats = rows[0]?.stats;
  if (stats == null) throw new Error("stats: query returned no row");
  return buildPublicJobStats(stats, { siteUrl: SITE_URL });
}

/** One cached summary of open jobs. A failure or zero open jobs throws, so the previous result stays cached. */
export function publicJobStats(): Promise<PublicJobStats> {
  return unstable_cache(publicJobStatsUncached, ["public-job-stats"], { revalidate: REVALIDATE_SECONDS })();
}
