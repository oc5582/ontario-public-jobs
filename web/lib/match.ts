import { createHash } from "crypto";
import { query } from "./db";

export const FREE_MATCH_LIMIT = 1;
export const FREE_RESULTS = 5;
export const MEMBER_DAILY_LIMIT = 20;
export const MAX_RESUME_CHARS = 15000;
export const MIN_RESUME_CHARS = 80;

export const MSG = {
  auth: "Sign in to match your resume.",
  resume: "Add your resume. Upload a PDF or Word file, or paste the text.",
  tooLong: "Your resume is too long. Keep it under 15,000 characters.",
  freeUsed: "You've used your free match.",
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
    ? `We found ${total} ${total === 1 ? "job" : "jobs"} out of ${jobsChecked} that could fit you.`
    : "We did not find a close fit right now.";
  const scope = isMember ? "" : locked > 0 ? " This free match shows the top 5." : " This was your free match.";
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

function workerFailure(code: string, fallback: string): { error: string; limit: string | null } {
  if (code === "paused") return { error: MSG.paused, limit: "worker_spend" };
  if (code === "daily") return { error: MSG.daily, limit: "worker_daily" };
  if (code === "ip_limit" || code === "person_limit") return { error: MSG.busy, limit: code === "ip_limit" ? "worker_ip" : "worker_person" };
  return { error: fallback || MSG.error, limit: null };
}

export async function runMatch(input: MatchInput, deps: MatchDeps = {}): Promise<{ status: number; body: MatchBody }> {
  const gotcha = String(input.gotcha || "").trim();
  if (gotcha) {
    return { status: 200, body: { ok: true, strong: [], maybe: [], jobs_checked: 0, shown: 0, locked: 0, member: input.isMember, alerts: false, summary: "" } };
  }

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

  const secret = deps.trustedSecret ?? process.env.MATCH_TRUSTED_SECRET ?? "";
  const workerUrl = deps.workerUrl ?? process.env.MATCH_WORKER_URL ?? "";
  if (!secret || !workerUrl) {
    return { status: 503, body: { ok: false, code: "unconfigured", error: MSG.unavailable } };
  }

  const fetchImpl = deps.fetchImpl || fetch;
  let payload: WorkerPayload;
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
        resume_text: resume,
      }),
      signal: AbortSignal.timeout(110000),
    });
    payload = (await res.json().catch(() => ({}))) as WorkerPayload;
    if (!res.ok || !payload.ok || payload.partial) {
      const mapped = workerFailure(String(payload.code || ""), String(payload.error || ""));
      if (mapped.limit) logLimit(mapped.limit, input.profileId);
      else console.log(JSON.stringify({ event: "resume_match_failed", reason: payload.partial ? "partial" : payload.code || "error", profile_id: input.profileId }));
      return { status: payload.partial ? 502 : res.ok ? 502 : res.status, body: { ok: false, code: payload.code || "error", error: mapped.error } };
    }
  } catch (err) {
    console.log(JSON.stringify({
      event: "resume_match_failed",
      reason: "crash",
      profile_id: input.profileId,
      message: err instanceof Error ? err.message.slice(0, 120) : "error",
    }));
    return { status: 502, body: { ok: false, code: "error", error: MSG.error } };
  }

  const recorded = await recordUse(input.profileId, input.email, day, input.isMember);
  if (!recorded) {
    logLimit(input.isMember ? "member_daily" : "free_used", input.profileId);
    return { status: 429, body: limitBody(input.isMember) };
  }

  const strong = hits(payload.strong);
  const maybe = hits(payload.maybe);
  const capped = capResults(strong, maybe, input.isMember);
  const jobsChecked = Number(payload.jobs_checked || 0);
  return {
    status: 200,
    body: {
      ok: true,
      strong: capped.strong,
      maybe: capped.maybe,
      jobs_checked: jobsChecked,
      shown: capped.shown,
      locked: capped.locked,
      member: input.isMember,
      alerts: input.consent,
      summary: summaryText(capped.total, jobsChecked, capped.locked, input.isMember, input.consent),
    },
  };
}
