import { randomBytes } from "crypto";
import { query } from "./db";
import { sendTransactional } from "./transactional-email";
import { isValidEmail, torontoDate } from "./match";
import {
  WEEKLY_CANDIDATE_SQL,
  WEEKLY_MAX_PER_RUN,
  assumedCostUsd,
  isMissingRelation,
  prepareResumeText,
  runWeeklyQueue,
  selectTightMatches,
  unsubscribeHeaders,
  validUnsubscribeToken,
  weeklyAccountUrl,
  weeklyConsentText,
  weeklyReadyEmail,
  weeklyUnsubscribeUrl,
  type TightHit,
  type WeeklyCandidate,
  type WeeklyRunReport,
  type WeeklyWorkerCall,
} from "./weekly-match";

function logEvent(event: string, extra: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...extra }));
}

export type SavedResumeRow = {
  charCount: number;
  source: "paste" | "pdf" | "docx";
  filename: string | null;
  updatedAt: string;
};

export type WeeklyResultRow = {
  ranAt: string;
  weekLabel: string;
  jobsChecked: number;
  jobs: TightHit[];
};

export type WeeklyAccountState = {
  ready: boolean;
  saved: SavedResumeRow | null;
  optedIn: boolean;
  results: WeeklyResultRow | null;
};

function emptyState(ready: boolean): WeeklyAccountState {
  return { ready, saved: null, optedIn: false, results: null };
}

function parseHits(value: unknown): TightHit[] {
  const rows = Array.isArray(value) ? value : [];
  const strong: TightHit[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    strong.push({
      url: String(row.url || ""),
      title: String(row.title || ""),
      employer: String(row.employer || ""),
      location: String(row.location || ""),
      closing_date: String(row.closing_date || ""),
      reason: String(row.reason || ""),
    });
  }
  return selectTightMatches(strong, []);
}

export async function loadWeeklyAccount(profileId: string): Promise<WeeklyAccountState> {
  try {
    const savedRows = await query<{
      char_count: number;
      source: "paste" | "pdf" | "docx";
      filename: string | null;
      updated_at: string;
    }>(
      `select char_count, source, filename, updated_at::text as updated_at
       from saved_resumes where profile_id = $1`,
      [profileId],
    );
    const prefRows = await query<{ opted_in: boolean }>(
      `select opted_in from weekly_match_prefs where profile_id = $1`,
      [profileId],
    );
    const resultRows = await query<{
      ran_at: string;
      week_label: string;
      jobs_checked: number;
      jobs: unknown;
    }>(
      `select ran_at::text as ran_at, week_label, jobs_checked, jobs
       from weekly_match_results where profile_id = $1`,
      [profileId],
    );
    const saved = savedRows[0];
    const result = resultRows[0];
    return {
      ready: true,
      saved: saved
        ? {
            charCount: Number(saved.char_count),
            source: saved.source,
            filename: saved.filename,
            updatedAt: saved.updated_at,
          }
        : null,
      optedIn: Boolean(prefRows[0]?.opted_in),
      results: result
        ? {
            ranAt: result.ran_at,
            weekLabel: result.week_label,
            jobsChecked: Number(result.jobs_checked || 0),
            jobs: parseHits(result.jobs),
          }
        : null,
    };
  } catch (error) {
    if (isMissingRelation(error)) return emptyState(false);
    throw error;
  }
}

async function ensurePrefs(profileId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await query(
    `insert into weekly_match_prefs (profile_id, opted_in, unsubscribe_token)
     values ($1, false, $2)
     on conflict (profile_id) do nothing`,
    [profileId, token],
  );
}

export async function saveWeeklyResume(
  profileId: string,
  resumeText: string,
  source: "paste" | "pdf" | "docx",
  filename: string | null,
): Promise<{ ok: true; charCount: number } | { ok: false; error: string; status: number }> {
  const prepared = prepareResumeText(resumeText);
  if (!prepared.ok) return { ok: false, error: prepared.error, status: 400 };
  try {
    await query(
      `insert into saved_resumes (profile_id, resume_text, source, filename, char_count, updated_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (profile_id) do update
         set resume_text = excluded.resume_text,
             source = excluded.source,
             filename = excluded.filename,
             char_count = excluded.char_count,
             updated_at = now()`,
      [profileId, prepared.text, source, filename, prepared.text.length],
    );
    await ensurePrefs(profileId);
    return { ok: true, charCount: prepared.text.length };
  } catch (error) {
    if (isMissingRelation(error)) {
      return { ok: false, error: "Weekly matches are not available right now.", status: 503 };
    }
    throw error;
  }
}

export async function removeWeeklyResume(profileId: string): Promise<void> {
  try {
    await query(`delete from saved_resumes where profile_id = $1`, [profileId]);
    await query(
      `update weekly_match_prefs
         set opted_in = false,
             unsubscribed_at = case when opted_in then now() else unsubscribed_at end,
             updated_at = now()
       where profile_id = $1`,
      [profileId],
    );
  } catch (error) {
    if (isMissingRelation(error)) return;
    throw error;
  }
}

export async function setWeeklyOptIn(
  profileId: string,
  optedIn: boolean,
): Promise<{ ok: true; optedIn: boolean } | { ok: false; error: string; status: number }> {
  try {
    if (optedIn) {
      const saved = await query<{ n: number }>(
        `select count(*)::int as n from saved_resumes where profile_id = $1`,
        [profileId],
      );
      if (!Number(saved[0]?.n || 0)) {
        return { ok: false, error: "Save a resume before turning on the weekly email.", status: 400 };
      }
      await ensurePrefs(profileId);
      await query(
        `update weekly_match_prefs
           set opted_in = true,
               opted_in_at = now(),
               unsubscribed_at = null,
               consent_text = $2,
               updated_at = now()
         where profile_id = $1`,
        [profileId, weeklyConsentText()],
      );
      return { ok: true, optedIn: true };
    }
    await query(
      `update weekly_match_prefs
         set opted_in = false, unsubscribed_at = now(), updated_at = now()
       where profile_id = $1`,
      [profileId],
    );
    return { ok: true, optedIn: false };
  } catch (error) {
    if (isMissingRelation(error)) {
      return { ok: false, error: "Weekly matches are not available right now.", status: 503 };
    }
    throw error;
  }
}

export async function unsubscribeWeeklyMatch(token: string): Promise<boolean> {
  if (!validUnsubscribeToken(token)) return false;
  try {
    const rows = await query<{ profile_id: string }>(
      `update weekly_match_prefs
         set opted_in = false, unsubscribed_at = now(), updated_at = now()
       where unsubscribe_token = $1
       returning profile_id`,
      [token],
    );
    if (rows[0]) logEvent("weekly_match_unsubscribed", { profile_id: rows[0].profile_id });
    return rows.length > 0;
  } catch (error) {
    if (isMissingRelation(error)) return false;
    throw error;
  }
}

type WorkerPayload = {
  ok?: boolean;
  code?: string;
  partial?: boolean;
  strong?: unknown;
  maybe?: unknown;
  jobs_checked?: number;
  meta?: { est_cost_usd?: number };
};

function hits(value: unknown): TightHit[] {
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

async function callTightWorker(
  resumeText: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<WeeklyWorkerCall> {
  const secret = process.env.MATCH_TRUSTED_SECRET || "";
  const workerUrl = process.env.MATCH_WORKER_URL || "";
  if (!secret || !workerUrl) return { ok: false, code: "unconfigured" };
  let resume = resumeText;
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
        email: "",
        casl_consent: "",
        resume_text: resume,
        match_mode: "tight",
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    resume = "";
    const payload = (await res.json().catch(() => ({}))) as WorkerPayload;
    if (!res.ok || !payload.ok || payload.partial) {
      return { ok: false, code: String(payload.code || "error") };
    }
    const reported = payload.meta && typeof payload.meta.est_cost_usd === "number" ? payload.meta.est_cost_usd : null;
    return {
      ok: true,
      strong: hits(payload.strong),
      maybe: hits(payload.maybe),
      jobsChecked: Number(payload.jobs_checked || 0),
      estCostUsd: reported,
    };
  } catch (error) {
    resume = "";
    logEvent("weekly_match_failed", {
      reason: "crash",
      message: error instanceof Error ? error.message.slice(0, 120) : "error",
    });
    return { ok: false, code: "error" };
  }
}

async function loadCandidates(day: string): Promise<WeeklyCandidate[]> {
  const rows = await query<{
    id: string;
    email: string;
    customer_name: string | null;
    resume_text: string;
    unsubscribe_token: string;
  }>(WEEKLY_CANDIDATE_SQL, [day, WEEKLY_MAX_PER_RUN]);
  return rows.map((row) => ({
    profileId: row.id,
    email: row.email,
    customerName: row.customer_name,
    resumeText: row.resume_text,
    unsubscribeToken: row.unsubscribe_token,
  }));
}

async function spentThisMonth(): Promise<number> {
  const rows = await query<{ spent: string | null }>(
    `select coalesce(sum(est_cost_usd), 0)::text as spent
     from weekly_match_log
     where outcome = 'matched'
       and to_char(created_at at time zone 'UTC', 'YYYY-MM') = to_char(now() at time zone 'UTC', 'YYYY-MM')`,
  );
  return Number(rows[0]?.spent || 0);
}

async function blockedToday(day: string): Promise<"spend" | "daily" | "budget" | null> {
  const rows = await query<{ outcome: string }>(
    `select outcome from weekly_match_log
     where profile_id is null
       and ran_on = $1::date
       and outcome in ('deferred_spend', 'deferred_daily', 'deferred_budget')
     order by created_at desc
     limit 1`,
    [day],
  );
  const outcome = rows[0]?.outcome;
  if (outcome === "deferred_spend") return "spend";
  if (outcome === "deferred_daily") return "daily";
  if (outcome === "deferred_budget") return "budget";
  return null;
}

export async function runWeeklyMatches(options: {
  now?: Date;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
} = {}): Promise<WeeklyRunReport> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun === true;
  const day = torontoDate(now);
  if (dryRun) {
    let considered = 0;
    try {
      considered = (await loadCandidates(day)).length;
    } catch (error) {
      if (!isMissingRelation(error)) throw error;
    }
    return runWeeklyQueue({
      now,
      dryRun: true,
      candidates: Array.from({ length: considered }, () => ({
        profileId: "",
        email: "",
        customerName: null,
        resumeText: "",
        unsubscribeToken: "",
      })),
      spentUsd: 0,
      blockedReason: null,
      callWorker: async () => ({ ok: false, code: "dry_run" }),
      saveResult: async () => {},
      logRow: async () => {},
      sendEmail: async () => "skipped",
      markEmailed: async () => {},
    });
  }

  const [candidates, spentUsd, blockedReason] = await Promise.all([
    loadCandidates(day),
    spentThisMonth(),
    blockedToday(day),
  ]);
  const fetchImpl = options.fetchImpl || fetch;
  return runWeeklyQueue({
    now,
    dryRun: false,
    candidates,
    spentUsd,
    blockedReason,
    callWorker: (resume, timeoutMs) => callTightWorker(resume, timeoutMs, fetchImpl),
    saveResult: async (profileId, jobs, jobsChecked, weekLabel) => {
      await query(
        `insert into weekly_match_results
           (profile_id, ran_at, week_label, jobs, jobs_checked, strong_count, emailed_at)
         values ($1, now(), $2, $3::jsonb, $4, $5, null)
         on conflict (profile_id) do update
           set ran_at = now(),
               week_label = excluded.week_label,
               jobs = excluded.jobs,
               jobs_checked = excluded.jobs_checked,
               strong_count = excluded.strong_count,
               emailed_at = null`,
        [profileId, weekLabel, JSON.stringify(jobs), jobsChecked, jobs.length],
      );
    },
    logRow: async (profileId, ranOn, outcome, detail, estCostUsd) => {
      await query(
        `insert into weekly_match_log (profile_id, ran_on, outcome, detail, est_cost_usd)
         values ($1, $2::date, $3, $4, $5)`,
        [profileId, ranOn, outcome, detail.slice(0, 200), estCostUsd == null ? null : assumedCostUsd(estCostUsd)],
      );
    },
    sendEmail: async (candidate) => {
      if (!isValidEmail(candidate.email) || !validUnsubscribeToken(candidate.unsubscribeToken)) return "failed";
      const unsubscribeUrl = weeklyUnsubscribeUrl(candidate.unsubscribeToken);
      const message = weeklyReadyEmail({
        customerName: candidate.customerName || "there",
        accountUrl: weeklyAccountUrl(),
        unsubscribeUrl,
      });
      try {
        const result = await sendTransactional({
          to: candidate.email,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: unsubscribeHeaders(unsubscribeUrl),
          idempotencyKey: `weekly-match/${candidate.profileId}/${day}`,
        });
        if ("skipped" in result) {
          logEvent("weekly_match_email_skipped", { profile_id: candidate.profileId, reason: result.skipped });
          return "skipped";
        }
        return "sent";
      } catch (error) {
        logEvent("weekly_match_email_failed", {
          profile_id: candidate.profileId,
          message: error instanceof Error ? error.message.slice(0, 120) : "error",
        });
        return "failed";
      }
    },
    markEmailed: async (profileId) => {
      await query(`update weekly_match_results set emailed_at = now() where profile_id = $1`, [profileId]);
    },
  });
}
