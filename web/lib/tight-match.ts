/**
 * Strict resume match shared by Saturday member matches and the /start quiz.
 *
 * One Worker call with match_mode "tight", then selectTightMatches. /match/
 * does not use this. The quiz does not store the resume; Saturday reads the
 * resume the member already saved.
 */

export const WEEKLY_RESULT_CAP = 15;
export const WEEKLY_MIN_REASON_WORDS = 8;

export type TightHit = {
  url: string;
  title: string;
  employer: string;
  location: string;
  closing_date: string;
  reason: string;
};

export type TightWorkerCall =
  | { ok: true; strong: TightHit[]; maybe: TightHit[]; jobsChecked: number; estCostUsd: number | null }
  | { ok: false; code: string; status: number; error: string; partial: boolean };

type WorkerPayload = {
  ok?: boolean;
  code?: string;
  error?: string;
  partial?: boolean;
  strong?: unknown;
  maybe?: unknown;
  jobs_checked?: number;
  meta?: { est_cost_usd?: number };
};

export function reasonWordCount(reason: string): number {
  return reason.trim().split(/\s+/).filter(Boolean).length;
}

/** Strong fits only, with a reason that meets the 8-word bar, capped. */
export function selectTightMatches(strong: TightHit[], maybe: TightHit[]): TightHit[] {
  void maybe;
  const kept: TightHit[] = [];
  for (const hit of strong) {
    if (!hit.url || !hit.title) continue;
    if (reasonWordCount(hit.reason) < WEEKLY_MIN_REASON_WORDS) continue;
    kept.push({
      url: hit.url,
      title: hit.title,
      employer: hit.employer,
      location: hit.location,
      closing_date: hit.closing_date,
      reason: hit.reason.slice(0, 200),
    });
    if (kept.length >= WEEKLY_RESULT_CAP) break;
  }
  return kept;
}

function workerHits(value: unknown): TightHit[] {
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

export async function requestTightMatch(
  resumeText: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  options: {
    workerUrl?: string;
    trustedSecret?: string;
    /** Crash log event. Saturday keeps weekly_match_failed. */
    logEvent?: string;
    who?: Record<string, string>;
  } = {},
): Promise<TightWorkerCall> {
  const secret = options.trustedSecret !== undefined ? options.trustedSecret : process.env.MATCH_TRUSTED_SECRET || "";
  const workerUrl = options.workerUrl !== undefined ? options.workerUrl : process.env.MATCH_WORKER_URL || "";
  const logName = options.logEvent || "weekly_match_failed";
  if (!secret || !workerUrl) return { ok: false, code: "unconfigured", status: 503, error: "", partial: false };
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
      return {
        ok: false,
        code: String(payload.code || "error"),
        status: payload.partial ? 502 : res.ok ? 502 : res.status,
        error: typeof payload.error === "string" ? payload.error : "",
        partial: Boolean(payload.partial),
      };
    }
    const reported = payload.meta && typeof payload.meta.est_cost_usd === "number" ? payload.meta.est_cost_usd : null;
    return {
      ok: true,
      strong: workerHits(payload.strong),
      maybe: workerHits(payload.maybe),
      jobsChecked: Number(payload.jobs_checked || 0),
      estCostUsd: reported,
    };
  } catch (error) {
    resume = "";
    console.log(JSON.stringify({
      event: logName,
      reason: "crash",
      ...(options.who || {}),
      message: error instanceof Error ? error.message.slice(0, 120) : "error",
    }));
    return { ok: false, code: "error", status: 502, error: "", partial: false };
  }
}
