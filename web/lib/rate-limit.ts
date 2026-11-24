import { createHash } from "crypto";

export type LimitRule = { limit: number; windowMs: number };

/** Generous enough for a person retrying a form. A script hits the ceiling. */
export const RULES = {
  magicLink: {
    ip: { limit: 8, windowMs: 15 * 60 * 1000 },
    email: { limit: 5, windowMs: 15 * 60 * 1000 },
  },
  report: {
    ip: { limit: 5, windowMs: 60 * 60 * 1000 },
    email: { limit: 5, windowMs: 60 * 60 * 1000 },
  },
  alertConsent: {
    ip: { limit: 20, windowMs: 60 * 60 * 1000 },
    email: { limit: 8, windowMs: 60 * 60 * 1000 },
  },
  match: {
    ip: { limit: 20, windowMs: 10 * 60 * 1000 },
    email: { limit: 8, windowMs: 10 * 60 * 1000 },
  },
} as const satisfies Record<string, { ip: LimitRule; email: LimitRule }>;

const buckets = new Map<string, number[]>();
const DAY_MS = 24 * 60 * 60 * 1000;
const dbSkipped = new Set<string>();

export function clearRateLimits(): void {
  buckets.clear();
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function prune(now: number): void {
  if (buckets.size < 5000) return;
  for (const [key, times] of buckets) {
    const fresh = times.filter((t) => now - t < DAY_MS);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}

/** Fixed window in this server instance. Returns false when the key is over its limit. */
export function memoryAllow(key: string, rule: LimitRule, now = Date.now()): boolean {
  prune(now);
  const fresh = (buckets.get(key) || []).filter((t) => now - t < rule.windowMs);
  if (fresh.length >= rule.limit) {
    buckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  buckets.set(key, fresh);
  return true;
}

function dbSkip(error: unknown): void {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "error";
  if (dbSkipped.has(code)) return;
  dbSkipped.add(code);
  const message = error instanceof Error ? error.message.slice(0, 120) : "error";
  console.info(JSON.stringify({ event: "rate_limit_db_skip", code, message }));
}

/**
 * Shared counter. Fails open when the table is missing or the database is down,
 * so a deploy before the migration does not block sign-in. The in-memory window
 * still applies on that instance.
 */
async function dbAllow(key: string, rule: LimitRule): Promise<boolean> {
  if (!process.env.DATABASE_URL) return true;
  try {
    const { query } = await import("./db");
    const seconds = Math.max(1, Math.ceil(rule.windowMs / 1000));
    const rows = await query<{ hits: number }>(
      `insert into public.request_limits (bucket, hits, window_start)
       values ($1, 1, now())
       on conflict (bucket) do update
       set hits = case
             when request_limits.window_start <= now() - make_interval(secs => $2::int) then 1
             else request_limits.hits + 1
           end,
           window_start = case
             when request_limits.window_start <= now() - make_interval(secs => $2::int) then now()
             else request_limits.window_start
           end
       returning hits`,
      [key, seconds],
    );
    const hits = Number(rows[0]?.hits || 0);
    if (hits > 0 && hits % 50 === 0) {
      query(`delete from public.request_limits where window_start < now() - interval '2 days'`).catch(() => {});
    }
    return hits > 0 && hits <= rule.limit;
  } catch (error) {
    dbSkip(error);
    return true;
  }
}

export async function requestAllowed(input: {
  scope: string;
  ip: string;
  email?: string;
  ipRule: LimitRule;
  emailRule?: LimitRule;
  now?: number;
}): Promise<boolean> {
  const now = input.now ?? Date.now();
  const checks: { key: string; rule: LimitRule }[] = [
    { key: hashKey(`${input.scope}:ip:${input.ip || "unknown"}`), rule: input.ipRule },
  ];
  const email = input.email?.trim().toLowerCase();
  if (email && input.emailRule) {
    checks.push({ key: hashKey(`${input.scope}:email:${email}`), rule: input.emailRule });
  }
  for (const check of checks) {
    if (!memoryAllow(check.key, check.rule, now)) return false;
  }
  for (const check of checks) {
    if (!(await dbAllow(check.key, check.rule))) return false;
  }
  return true;
}
