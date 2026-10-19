import { createHash, createHmac, randomUUID } from "crypto";
import { query } from "./db";

/**
 * Free matches per normalised email (signed out or free account), and per browser.
 * Customer-facing copy still says one free match.
 */
export const FREE_RUNS_PER_EMAIL = 5;
export const FREE_MATCH_LIMIT = FREE_RUNS_PER_EMAIL;
/** A repeat of the same submit (same email and run id) within this window is the same run, not a new one. */
export const RUN_ID_WINDOW_MINUTES = 5;
/** How many times one run id may be repeated (each repeat calls the Worker again but is not counted). */
export const RUN_ID_MAX_REPEATS = 2;
export const FREE_RESULTS = 10;
/** Signed-out free matches per network per Toronto day (successful or in progress). */
export const GUEST_NETWORK_DAILY = 5;
/** Browser flag set after a signed-out free match. Checked on the server. */
/** Browser counter of free matches (HttpOnly, value 0-5). Checked on the server. */
export const FREE_COOKIE = "pj_free_match";
export const FREE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const MEMBER_DAILY_LIMIT = 20;
export const MAX_RESUME_CHARS = 15000;
export const MIN_RESUME_CHARS = 80;

export const MSG = {
  auth: "Sign in to match your resume.",
  resume: "Add your resume. Upload a PDF or Word file, or paste the text.",
  tooLong: "Your resume is too long. Keep it under 15,000 characters.",
  freeUsed: "You've used your free match.",
  guestUsed: "You've used your free match. A membership includes up to 20 matches a day.",
  email: "Enter a valid email address.",
  network: "Free matches from this network are used up for today. Please try again tomorrow.",
  memberDaily: "You've hit today's member limit. Try again tomorrow.",
  busy: "Resume matching is busy right now. Please try again later.",
  paused: "Resume matching is paused for now. Please try again next month.",
  daily: "Resume matching is busy today. Please try again tomorrow.",
  unavailable: "Resume matching is not available right now. Please try again later.",
  error: "Something went wrong. Please try again.",
} as const;

export type MatchHit = {
  url: string;
  title: string;
  employer: string;
  location: string;
  closing_date: string;
  reason: string;
};

export type MatchBody = {
  ok: boolean;
  code?: string;
  error?: string;
  upgrade?: string;
  login?: string;
  strong?: MatchHit[];
  maybe?: MatchHit[];
  jobs_checked?: number;
  shown?: number;
  locked?: number;
  member?: boolean;
  alerts?: boolean;
  summary?: string;
  guest?: boolean;
  /** This response is for a resent copy of a submit already counted. */
  repeat?: boolean;
};

type WorkerPayload = {
  ok?: boolean;
  code?: string;
  error?: string;
  partial?: boolean;
  strong?: MatchHit[];
  maybe?: MatchHit[];
  jobs_checked?: number;
};

export type MatchInput = {
  profileId: string;
  email: string;
  isMember: boolean;
  resumeText: string;
  consent: boolean;
  gotcha?: string;
};

export type MatchDeps = {
  fetchImpl?: typeof fetch;
  now?: Date;
  workerUrl?: string;
  trustedSecret?: string;
};

function logLimit(limit: string, profileId: string) {
  console.log(JSON.stringify({ event: "resume_match_limit", limit, profile_id: profileId }));
}

export function torontoDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function cleanResume(value: string): string {
  return value.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function capResults(strong: MatchHit[], maybe: MatchHit[], isMember: boolean) {
  const ranked = [
    ...strong.map((job) => ({ job, fit: "strong" as const })),
    ...maybe.map((job) => ({ job, fit: "maybe" as const })),
  ];
  const visible = isMember ? ranked : ranked.slice(0, FREE_RESULTS);
  return {
    strong: visible.filter((row) => row.fit === "strong").map((row) => row.job),
    maybe: visible.filter((row) => row.fit === "maybe").map((row) => row.job),
    shown: visible.length,
    locked: isMember ? 0 : Math.max(0, ranked.length - visible.length),
    total: ranked.length,
  };
}

function summaryText(total: number, jobsChecked: number, locked: number, isMember: boolean, alerts: boolean): string {
  const found = total
    ? `We compared your resume with ${jobsChecked} current openings and found ${total} ${total === 1 ? "suggestion" : "suggestions"}. Matches are suggestions and can be wrong.`
    : `We compared your resume with ${jobsChecked} current openings and did not find a close suggestion. Matches can be wrong.`;
  const scope = isMember ? "" : locked > 0 ? ` This free match shows the top ${FREE_RESULTS}.` : " This was your free match.";
  const inbox = alerts ? " New jobs will come to your inbox every week." : "";
  const browse = total ? "" : " You can browse all openings below.";
  return `${found}${scope}${inbox}${browse}`.replace(/\s+/g, " ").trim();
}

function hits(value: unknown): MatchHit[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        url: String(row.url || ""),
        title: String(row.title || ""),
        employer: String(row.employer || ""),
        location: String(row.location || ""),
        closing_date: String(row.closing_date || ""),
        reason: String(row.reason || "").slice(0, 200),
      };
    })
    .filter((row) => row.url && row.title);
}

async function usageCount(profileId: string, day: string | null): Promise<number> {
  const rows = await query<{ n: number }>(
    day
      ? `select count(*)::int as n from resume_match_usage where profile_id = $1 and used_on = $2::date`
      : `select count(*)::int as n from resume_match_usage where profile_id = $1`,
    day ? [profileId, day] : [profileId],
  );
  return Number(rows[0]?.n || 0);
}

async function recordUse(profileId: string, email: string, day: string, isMember: boolean): Promise<boolean> {
  const limit = isMember ? MEMBER_DAILY_LIMIT : FREE_MATCH_LIMIT;
  const rows = await query<{ id: string }>(
    `with locked as (
       select pg_advisory_xact_lock(hashtextextended($1::text, 0)) as locked
     )
     insert into resume_match_usage (profile_id, email_hash, used_on)
     select $1::uuid, $2, $3::date
     from locked
     where (
       select count(*) from resume_match_usage
       where profile_id = $1::uuid
         and ($4::bool = false or used_on = $3::date)
     ) < $5::int
     returning id`,
    [profileId, emailHash(email), day, isMember, limit],
  );
  return Boolean(rows[0]?.id);
}

function limitBody(isMember: boolean): MatchBody {
  if (isMember) return { ok: false, code: "member_daily", error: MSG.memberDaily };
  return { ok: false, code: "free_used", error: MSG.freeUsed, upgrade: "/pricing/" };
}

function guestUsedBody(): MatchBody {
  return { ok: false, code: "free_used", error: MSG.guestUsed, upgrade: "/pricing/", login: "/login/?next=/match/" };
}

function workerFailure(code: string, fallback: string): { error: string; limit: string | null } {
  if (code === "paused") return { error: MSG.paused, limit: "worker_spend" };
  if (code === "daily") return { error: MSG.daily, limit: "worker_daily" };
  if (code === "ip_limit" || code === "person_limit") return { error: MSG.busy, limit: code === "ip_limit" ? "worker_ip" : "worker_person" };
  return { error: fallback || MSG.error, limit: null };
}

function emptyBody(isMember: boolean): MatchBody {
  return { ok: true, strong: [], maybe: [], jobs_checked: 0, shown: 0, locked: 0, member: isMember, alerts: false, summary: "" };
}

type WorkerCall =
  | { ok: true; payload: WorkerPayload }
  | { ok: false; status: number; body: MatchBody };

function workerConfig(deps: MatchDeps): { secret: string; workerUrl: string } {
  return {
    secret: deps.trustedSecret ?? process.env.MATCH_TRUSTED_SECRET ?? "",
    workerUrl: deps.workerUrl ?? process.env.MATCH_WORKER_URL ?? "",
  };
}

function unconfigured(): { status: number; body: MatchBody } {
  return { status: 503, body: { ok: false, code: "unconfigured", error: MSG.unavailable } };
}

/** One trusted call to the Worker. Never throws. `who` is only used in logs. */
async function callWorker(
  input: { email: string; consent: boolean; resume: string },
  deps: MatchDeps,
  who: Record<string, string>,
): Promise<WorkerCall> {
  const { secret, workerUrl } = workerConfig(deps);
  const fetchImpl = deps.fetchImpl || fetch;
  try {
    const res = await fetchImpl(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://publicjobs.ca",
        "X-PublicJobs-Trusted": secret,
      },
      body: JSON.stringify({
        email: input.consent ? input.email : "",
        casl_consent: input.consent ? "yes" : "",
        resume_text: input.resume,
      }),
      signal: AbortSignal.timeout(110000),
    });
    const payload = (await res.json().catch(() => ({}))) as WorkerPayload;
    if (!res.ok || !payload.ok || payload.partial) {
      const mapped = workerFailure(String(payload.code || ""), String(payload.error || ""));
      if (mapped.limit) console.log(JSON.stringify({ event: "resume_match_limit", limit: mapped.limit, ...who }));
      else console.log(JSON.stringify({ event: "resume_match_failed", reason: payload.partial ? "partial" : payload.code || "error", ...who }));
      return {
        ok: false,
        status: payload.partial ? 502 : res.ok ? 502 : res.status,
        body: { ok: false, code: payload.code || "error", error: mapped.error },
      };
    }
    return { ok: true, payload };
  } catch (err) {
    console.log(JSON.stringify({
      event: "resume_match_failed",
      reason: "crash",
      ...who,
      message: err instanceof Error ? err.message.slice(0, 120) : "error",
    }));
    return { ok: false, status: 502, body: { ok: false, code: "error", error: MSG.error } };
  }
}

function successBody(payload: WorkerPayload, isMember: boolean, consent: boolean): MatchBody {
  const capped = capResults(hits(payload.strong), hits(payload.maybe), isMember);
  const jobsChecked = Number(payload.jobs_checked || 0);
  return {
    ok: true,
    strong: capped.strong,
    maybe: capped.maybe,
    jobs_checked: jobsChecked,
    shown: capped.shown,
    locked: capped.locked,
    member: isMember,
    alerts: consent,
    summary: summaryText(capped.total, jobsChecked, capped.locked, isMember, consent),
  };
}

// ---------------------------------------------------------------------------
// Free-run ledger (one free match per normalised email, with or without an account)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Server-side format check. Same rule as the Worker. */
export function isValidEmail(value: string): boolean {
  const email = value.trim();
  return email.length >= 3 && email.length <= 254 && EMAIL_RE.test(email) && !/[<>,;"]/.test(email);
}

/** Lowercase, trim, drop +tags, and treat Gmail dots as the same address. Same as the Worker. */
export function normalizeEmail(value: string): string {
  const [rawLocal = "", rawDomain = ""] = value.trim().toLowerCase().split("@");
  let local = rawLocal.split("+")[0];
  let domain = rawDomain;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

const RUN_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** The client's run id if it looks valid, otherwise a server one (no dedupe for that request). */
export function cleanRunId(value: unknown): { id: string; fromClient: boolean } {
  const raw = String(value || "").trim();
  return RUN_ID_RE.test(raw) ? { id: raw, fromClient: true } : { id: `srv-${randomUUID()}`, fromClient: false };
}

/** Browser counter from the cookie value. Unknown or bad values count as 0; the old "1" flag counts as 1. */
export function cookieRuns(value: string | undefined): number {
  const n = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, FREE_RUNS_PER_EMAIL) : 0;
}

/** Free runs this email has used, as a guest (ledger) or on a free account. */
async function freeRunsUsed(email: string): Promise<number> {
  const rows = await query<{ used: number }>(
    `select greatest(
       coalesce((select runs from match_free_runs where email_key = $1), 0),
       (select count(*)::int from resume_match_usage u
          join profiles p on p.id = u.profile_id
          where lower(p.email) = $2)
     )::int as used`,
    [normalizeEmail(email), email.trim().toLowerCase()],
  );
  return Number(rows[0]?.used || 0);
}

/**
 * Same submit seen again (same email and run id, recent): allowed without counting a run
 * or a network slot, at most RUN_ID_MAX_REPEATS times.
 */
async function claimRepeat(email: string, runId: string): Promise<boolean> {
  const rows = await query<{ runs: number }>(
    `update match_free_runs
       set run_id_repeats = run_id_repeats + 1
     where email_key = $1
       and run_id = $2
       and run_id_at > now() - make_interval(mins => $3)
       and run_id_repeats < $4
     returning runs`,
    [normalizeEmail(email), runId, RUN_ID_WINDOW_MINUTES, RUN_ID_MAX_REPEATS],
  );
  return rows.length > 0;
}

/**
 * Counts one free run for the email before the Worker is called. False when the email has
 * used all its free runs, or when this run id was just claimed (a repeat, handled by claimRepeat).
 * One statement, so two requests at once cannot both take the last run.
 */
async function claimFreeRun(email: string, consent: boolean, runId: string): Promise<boolean> {
  const rows = await query<{ runs: number }>(
    `insert into match_free_runs (email_key, email, alerts_consent, source, runs, run_id, run_id_at, run_id_repeats)
     values ($1, $2, $3, 'guest', 1, $4, now(), 0)
     on conflict (email_key) do update
       set runs = match_free_runs.runs + 1,
           last_run_at = now(),
           run_id = excluded.run_id,
           run_id_at = now(),
           run_id_repeats = 0,
           alerts_consent = match_free_runs.alerts_consent or excluded.alerts_consent
       where match_free_runs.runs < $5
         and not (
           match_free_runs.run_id is not distinct from excluded.run_id
           and match_free_runs.run_id_at > now() - make_interval(mins => $6)
         )
     returning runs`,
    [normalizeEmail(email), email.trim().toLowerCase().slice(0, 254), consent, runId, FREE_RUNS_PER_EMAIL, RUN_ID_WINDOW_MINUTES],
  );
  return rows.length > 0;
}

/** Gives the run back after a failed match. A guest row that drops to zero runs is removed. */
async function releaseFreeRun(email: string, runId: string): Promise<void> {
  const key = normalizeEmail(email);
  await query(
    `update match_free_runs
       set runs = greatest(runs - 1, 0),
           run_id = case when run_id = $2 then null else run_id end
     where email_key = $1`,
    [key, runId],
  );
  await query(`delete from match_free_runs where email_key = $1 and runs = 0 and source = 'guest'`, [key]);
}

/** A free account used a free match: count it on the email so the guest form shares the same limit. */
async function noteAccountFreeRun(email: string, consent: boolean): Promise<void> {
  await query(
    `insert into match_free_runs (email_key, email, alerts_consent, source, runs)
     values ($1, $2, $3, 'account', 1)
     on conflict (email_key) do update
       set runs = match_free_runs.runs + 1,
           last_run_at = now(),
           alerts_consent = match_free_runs.alerts_consent or excluded.alerts_consent`,
    [normalizeEmail(email), email.trim().toLowerCase().slice(0, 254), consent],
  );
}

/** HMAC of the network and day with a server secret. The raw IP is never stored. */
export function networkHash(ip: string, day: string, secret: string): string {
  return createHmac("sha256", secret || "publicjobs-match").update(`net|${day}|${ip || "unknown"}`).digest("hex");
}

/** Takes one of the network's signed-out matches for today. False at the limit. */
async function reserveNetwork(hash: string, day: string, limit: number): Promise<boolean> {
  const rows = await query<{ n: number }>(
    `insert into match_free_networks (net_hash, used_on, n)
     values ($1, $2::date, 1)
     on conflict (net_hash, used_on) do update
       set n = match_free_networks.n + 1
       where match_free_networks.n < $3::int
     returning n`,
    [hash, day, limit],
  );
  return rows.length > 0;
}

async function releaseNetwork(hash: string, day: string): Promise<void> {
  await query(
    `update match_free_networks set n = greatest(n - 1, 0) where net_hash = $1 and used_on = $2::date`,
    [hash, day],
  );
}

/** Backup for the daily cron (lib/match-retention.ts). */
async function pruneNetworks(day: string): Promise<void> {
  await query(`delete from match_free_networks where used_on < $1::date - 7`, [day]);
}

function quiet(label: string) {
  return (error: unknown) => {
    console.log(JSON.stringify({
      event: "resume_match_ledger_failed",
      step: label,
      message: error instanceof Error ? error.message.slice(0, 120) : "error",
    }));
  };
}

// ---------------------------------------------------------------------------
// Signed-in match (free account or member)

export async function runMatch(input: MatchInput, deps: MatchDeps = {}): Promise<{ status: number; body: MatchBody }> {
  const gotcha = String(input.gotcha || "").trim();
  if (gotcha) return { status: 200, body: emptyBody(input.isMember) };

  let resume = cleanResume(input.resumeText || "");
  if (resume.length < MIN_RESUME_CHARS) return { status: 400, body: { ok: false, code: "resume", error: MSG.resume } };
  if (resume.length > MAX_RESUME_CHARS) resume = resume.slice(0, MAX_RESUME_CHARS);

  const now = deps.now || new Date();
  const day = torontoDate(now);
  const used = await usageCount(input.profileId, input.isMember ? day : null);
  const limit = input.isMember ? MEMBER_DAILY_LIMIT : FREE_MATCH_LIMIT;
  if (used >= limit) {
    logLimit(input.isMember ? "member_daily" : "free_used", input.profileId);
    return { status: 429, body: limitBody(input.isMember) };
  }
  if (!input.isMember) {
    // The same email already used its free runs (signed out or on this account). A ledger error never blocks the account.
    const taken = await query<{ taken: boolean }>(
      `select exists (select 1 from match_free_runs where email_key = $1 and runs >= $2) as taken`,
      [normalizeEmail(input.email), FREE_RUNS_PER_EMAIL],
    ).then((rows) => Boolean(rows[0]?.taken)).catch((error) => {
      quiet("account_check")(error);
      return false;
    });
    if (taken) {
      logLimit("free_used", input.profileId);
      return { status: 429, body: limitBody(false) };
    }
  }

  const { secret, workerUrl } = workerConfig(deps);
  if (!secret || !workerUrl) return unconfigured();

  const call = await callWorker({ email: input.email, consent: input.consent, resume }, deps, { profile_id: input.profileId });
  resume = "";
  if (!call.ok) return { status: call.status, body: call.body };

  const recorded = await recordUse(input.profileId, input.email, day, input.isMember);
  if (!recorded) {
    logLimit(input.isMember ? "member_daily" : "free_used", input.profileId);
    return { status: 429, body: limitBody(input.isMember) };
  }
  if (!input.isMember) await noteAccountFreeRun(input.email, input.consent).catch(quiet("account_note"));

  return { status: 200, body: successBody(call.payload, input.isMember, input.consent) };
}

// ---------------------------------------------------------------------------
// Signed-out match: email required, FREE_RUNS_PER_EMAIL per email and per browser

export type GuestInput = {
  email: string;
  resumeText: string;
  consent: boolean;
  gotcha?: string;
  /** Free matches this browser has already had (from the HttpOnly cookie). */
  browserRuns: number;
  /** Client run id for this submit. A repeat of the same id is the same run. */
  runId?: unknown;
  /** Client IP from the platform headers. Only its HMAC is stored. */
  ip: string;
  /** Runs only when alerts are checked, once the free run is reserved and right before the Worker call (records the consent). */
  beforeWorker?: () => Promise<void>;
};

export async function runGuestMatch(input: GuestInput, deps: MatchDeps = {}): Promise<{ status: number; body: MatchBody }> {
  const gotcha = String(input.gotcha || "").trim();
  if (gotcha) return { status: 200, body: { ...emptyBody(false), guest: true } };

  const email = String(input.email || "").trim();
  if (!isValidEmail(email)) return { status: 400, body: { ok: false, code: "email", error: MSG.email } };

  let resume = cleanResume(input.resumeText || "");
  if (resume.length < MIN_RESUME_CHARS) return { status: 400, body: { ok: false, code: "resume", error: MSG.resume } };
  if (resume.length > MAX_RESUME_CHARS) resume = resume.slice(0, MAX_RESUME_CHARS);

  const { secret, workerUrl } = workerConfig(deps);
  if (!secret || !workerUrl) return unconfigured();

  const run = cleanRunId(input.runId);
  const now = deps.now || new Date();
  const day = torontoDate(now);
  const net = networkHash(input.ip, day, secret);
  let repeat = false;
  let tookNetwork = false;

  try {
    // A resent copy of a submit we already counted: same run, no new count, no network slot.
    if (run.fromClient) repeat = await claimRepeat(email, run.id);
    if (!repeat) {
      if (input.browserRuns >= FREE_RUNS_PER_EMAIL) {
        console.log(JSON.stringify({ event: "resume_match_limit", limit: "guest_browser" }));
        return { status: 429, body: guestUsedBody() };
      }
      if ((await freeRunsUsed(email)) >= FREE_RUNS_PER_EMAIL) {
        console.log(JSON.stringify({ event: "resume_match_limit", limit: "guest_email" }));
        return { status: 429, body: guestUsedBody() };
      }
      tookNetwork = await reserveNetwork(net, day, GUEST_NETWORK_DAILY);
      if (!tookNetwork) {
        console.log(JSON.stringify({ event: "resume_match_limit", limit: "guest_network" }));
        return { status: 429, body: { ok: false, code: "network", error: MSG.network, login: "/login/?next=/match/" } };
      }
      const claimed = await claimFreeRun(email, input.consent, run.id);
      if (!claimed) {
        await releaseNetwork(net, day);
        tookNetwork = false;
        // Lost a race with a copy of the same submit: treat it as that run.
        if (run.fromClient) repeat = await claimRepeat(email, run.id);
        if (!repeat) {
          console.log(JSON.stringify({ event: "resume_match_limit", limit: "guest_email" }));
          return { status: 429, body: guestUsedBody() };
        }
      }
    }
  } catch (error) {
    // Ledger missing or the database is down: refuse before any AI spend.
    quiet("guest_reserve")(error);
    if (tookNetwork) await releaseNetwork(net, day).catch(quiet("guest_release_network"));
    return { status: 503, body: { ok: false, code: "unavailable", error: MSG.unavailable } };
  }
  if (repeat) console.log(JSON.stringify({ event: "resume_match_repeat", who: "guest" }));
  if (Math.random() < 0.05) pruneNetworks(day).catch(quiet("guest_prune"));
  if (input.consent && input.beforeWorker) await input.beforeWorker().catch(quiet("guest_before_worker"));

  const call = await callWorker({ email, consent: input.consent, resume }, deps, { who: "guest" });
  resume = "";
  if (!call.ok) {
    // A repeat never counted anything, so there is nothing to give back.
    if (!repeat) {
      await Promise.all([
        releaseFreeRun(email, run.id).catch(quiet("guest_release_email")),
        releaseNetwork(net, day).catch(quiet("guest_release_network")),
      ]);
    }
    return { status: call.status, body: call.body };
  }
  return { status: 200, body: { ...successBody(call.payload, false, input.consent), guest: true, repeat } };
}
