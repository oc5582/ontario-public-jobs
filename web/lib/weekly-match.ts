import { timingSafeEqual } from "crypto";
import { alertConsentSender, emailFooterText } from "./legal-copy";
import { MAX_RESUME_CHARS, MIN_RESUME_CHARS, MSG, torontoDate, type MatchHit } from "./match";
import { SITE_URL } from "./site";

/**
 * Weekly matches are a tighter cut than /match/.
 *
 * On-demand (workers/resume-match SYSTEM prompt) is generous on purpose. It
 * returns two lists:
 * - strong: the person has done this work, or their credentials point at it
 * - maybe: transferable skills, entry-level roles, or a stretch
 * Free matches show the top 10 of that combined list. Members see both lists.
 *
 * Saturday matches ask the Worker for match_mode "tight" (stricter prompt: no
 * stretch, no maybe, leave it out when unsure). The app then applies this bar
 * even if the published Worker still runs the generous prompt:
 * 1. Keep fit "strong" only. Drop every "maybe".
 * 2. Drop a strong hit whose reason has fewer than WEEKLY_MIN_REASON_WORDS
 *    words. The Worker already asks for 8 to 20 words; shorter reasons are the
 *    generic ones ("Your experience matches this role.").
 * 3. Keep at most WEEKLY_RESULT_CAP hits, in the order the Worker returned them.
 *
 * Cost: the Worker still enforces its $10 USD monthly cap and its daily cap.
 * This job also stops for the rest of the Toronto Saturday once estimated
 * weekly spend for the UTC month reaches WEEKLY_SPEND_SLICE_USD, so on-demand
 * matching keeps the rest of the budget. Calls are one at a time. A paused or
 * daily response stops the queue. Nothing here is written to resume_match_usage,
 * so it does not use the member's 20 matches a day.
 */

export const WEEKLY_RESULT_CAP = 15;
export const WEEKLY_MIN_REASON_WORDS = 8;
export const WEEKLY_SPEND_SLICE_USD = 4;
export const WEEKLY_ASSUMED_CALL_USD = 0.25;
export const WEEKLY_MAX_PER_RUN = 8;
export const WEEKLY_DEADLINE_MS = 110_000;
export const WEEKLY_MIN_CALL_MS = 20_000;
export const WEEKLY_CALL_TIMEOUT_MS = 100_000;

export const WEEKLY_CANDIDATE_SQL = `
select p.id, p.email, p.customer_name, r.resume_text, w.unsubscribe_token
from profiles p
join saved_resumes r on r.profile_id = p.id
join weekly_match_prefs w on w.profile_id = p.id
where w.opted_in = true
  and p.membership_status = 'active'
  and (p.current_period_end is null or p.current_period_end > now())
  and char_length(r.resume_text) >= 80
  and not exists (
    select 1 from weekly_match_log l
    where l.profile_id = p.id
      and l.ran_on = $1::date
      and l.outcome in ('matched', 'error')
  )
order by p.id
limit $2
`;

export type TightHit = MatchHit;

export type WeeklyCandidate = {
  profileId: string;
  email: string;
  customerName: string | null;
  resumeText: string;
  unsubscribeToken: string;
};

export type WeeklyWorkerCall =
  | { ok: true; strong: TightHit[]; maybe: TightHit[]; jobsChecked: number; estCostUsd: number | null }
  | { ok: false; code: string };

export type WeeklyRunReport = {
  ok: true;
  skipped?: string;
  day: string;
  considered: number;
  calls: number;
  matched: number;
  emailed: number;
  deferred: number;
  errors: number;
  sampleEmail?: { subject: string; text: string; html: string };
};

export function showWeeklyMatchTools(isMember: boolean): boolean {
  return isMember;
}

export function canEnableWeeklyEmail(isMember: boolean, hasResume: boolean): boolean {
  return isMember && hasResume;
}

export function weeklyMemberGuard(viewer: {
  email: string | null;
  profile: unknown;
  isMember: boolean;
}): { ok: true } | { ok: false; status: 401 | 403; error: string } {
  if (!viewer.email || !viewer.profile) {
    return { ok: false, status: 401, error: "Sign in to use weekly matches." };
  }
  if (!showWeeklyMatchTools(viewer.isMember)) {
    return { ok: false, status: 403, error: "Weekly matches are part of a membership." };
  }
  return { ok: true };
}

export function cronAuthorized(header: string | null, secret: string | undefined): "ok" | "missing" | "denied" {
  if (!secret) return "missing";
  const expected = `Bearer ${secret}`;
  const got = header || "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "denied";
  return "ok";
}

export function isTorontoSaturday(now = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    weekday: "long",
  }).format(now);
  return weekday === "Saturday";
}

export function weeklyWeekLabel(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
}

export function reasonWordCount(reason: string): number {
  return reason.trim().split(/\s+/).filter(Boolean).length;
}

export function weeklyCallTimeout(elapsedMs: number): number | null {
  const remaining = WEEKLY_DEADLINE_MS - elapsedMs;
  if (remaining < WEEKLY_MIN_CALL_MS) return null;
  return Math.min(WEEKLY_CALL_TIMEOUT_MS, remaining);
}

export function assumedCostUsd(reported: number | null | undefined): number {
  if (typeof reported === "number" && Number.isFinite(reported) && reported >= 0) return reported;
  return WEEKLY_ASSUMED_CALL_USD;
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

export function prepareResumeText(value: string): { ok: true; text: string } | { ok: false; error: string } {
  let text = value.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < MIN_RESUME_CHARS) return { ok: false, error: MSG.resume };
  if (text.length > MAX_RESUME_CHARS) text = text.slice(0, MAX_RESUME_CHARS);
  return { ok: true, text };
}

export function resumeSource(value: unknown): "paste" | "pdf" | "docx" | null {
  if (value === "paste" || value === "pdf" || value === "docx") return value;
  return null;
}

export function cleanFilename(value: unknown): string | null {
  const base = String(value || "")
    .split(/[/\\]/)
    .pop()
    ?.replace(/[\u0000-\u001f]/g, "")
    .trim() || "";
  if (!base) return null;
  return base.slice(0, 200);
}

export function resumeSourceLabel(source: string): string {
  if (source === "pdf") return "PDF";
  if (source === "docx") return "Word";
  return "Pasted text";
}

export function weeklyEmailConsentLabel(): string {
  return "Email me my weekly matches. Unsubscribe anytime.";
}

export function weeklyConsentText(): string {
  return `${weeklyEmailConsentLabel()} ${alertConsentSender()}`;
}

export function isMissingRelation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  if (code === "42P01") return true;
  const message = error instanceof Error ? error.message : "";
  return /relation ["']?(?:public\.)?(?:saved_resumes|weekly_match_prefs|weekly_match_results|weekly_match_log)["']? does not exist/i.test(message);
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;

export function validUnsubscribeToken(value: string): boolean {
  return TOKEN_RE.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function weeklyAccountUrl(): string {
  return `${SITE_URL}/account/#weekly-matches`;
}

export function weeklyUnsubscribeUrl(token: string): string {
  return `${SITE_URL}/api/weekly-matches/unsubscribe/?token=${encodeURIComponent(token)}`;
}

export function unsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Short Saturday note. The job list stays on the account page. */
export function weeklyReadyEmail(input: {
  customerName: string;
  accountUrl: string;
  unsubscribeUrl: string;
}): { subject: string; text: string; html: string } {
  const name = input.customerName.trim() || "there";
  const subject = "Your weekly matches are ready";
  const text = [
    `Hi ${name},`,
    "",
    "Your weekly matches are ready. This note stays short. The list is on your account page:",
    input.accountUrl,
    "",
    "Matches are suggestions and can be wrong.",
    "",
    `Stop these emails: ${input.unsubscribeUrl}`,
    "That turns off weekly match emails. It does not cancel your membership.",
    "",
    emailFooterText(),
  ].join("\n");
  const html = `<!DOCTYPE html><html><body style="font-family:Georgia,serif;color:#16202c;line-height:1.45"><p>Hi ${escapeHtml(name)},</p><p>Your weekly matches are ready. This note stays short. The list is on your <a href="${escapeHtml(input.accountUrl)}">account page</a>.</p><p>Matches are suggestions and can be wrong.</p><p><a href="${escapeHtml(input.unsubscribeUrl)}">Stop these emails</a>. That turns off weekly match emails. It does not cancel your membership.</p><p>${escapeHtml(emailFooterText())}</p></body></html>`;
  return { subject, text, html };
}

export function weeklySampleEmail(): { subject: string; text: string; html: string } {
  return weeklyReadyEmail({
    customerName: "there",
    accountUrl: weeklyAccountUrl(),
    unsubscribeUrl: weeklyUnsubscribeUrl("dry-run-token-not-real"),
  });
}

export type WeeklyQueueInput = {
  now: Date;
  dryRun: boolean;
  candidates: WeeklyCandidate[];
  spentUsd: number;
  blockedReason: "spend" | "daily" | "budget" | null;
  callWorker: (resume: string, timeoutMs: number) => Promise<WeeklyWorkerCall>;
  saveResult: (profileId: string, jobs: TightHit[], jobsChecked: number, weekLabel: string) => Promise<void>;
  logRow: (
    profileId: string | null,
    day: string,
    outcome: string,
    detail: string,
    estCostUsd: number | null,
  ) => Promise<void>;
  sendEmail: (candidate: WeeklyCandidate) => Promise<"sent" | "skipped" | "failed">;
  markEmailed: (profileId: string) => Promise<void>;
  startedAt?: number;
};

function logSkip(reason: string, extra: Record<string, unknown>) {
  console.log(JSON.stringify({ event: "weekly_match_skip", reason, ...extra }));
}

export async function runWeeklyQueue(input: WeeklyQueueInput): Promise<WeeklyRunReport> {
  const day = torontoDate(input.now);
  const base: WeeklyRunReport = {
    ok: true,
    day,
    considered: input.candidates.length,
    calls: 0,
    matched: 0,
    emailed: 0,
    deferred: 0,
    errors: 0,
    sampleEmail: input.dryRun ? weeklySampleEmail() : undefined,
  };
  if (!input.dryRun && !isTorontoSaturday(input.now)) {
    return { ...base, skipped: "not_saturday", considered: 0 };
  }
  if (input.dryRun) {
    return { ...base, skipped: "dry_run" };
  }
  if (input.blockedReason) {
    logSkip(input.blockedReason, { remaining: input.candidates.length, day });
    return { ...base, skipped: input.blockedReason, deferred: input.candidates.length };
  }
  if (input.spentUsd >= WEEKLY_SPEND_SLICE_USD) {
    logSkip("budget", { remaining: input.candidates.length, spent_usd: input.spentUsd, day });
    await input.logRow(null, day, "deferred_budget", `spent=${input.spentUsd}`, null);
    return { ...base, skipped: "budget", deferred: input.candidates.length };
  }

  const started = input.startedAt ?? Date.now();
  let spent = input.spentUsd;
  const weekLabel = weeklyWeekLabel(input.now);

  for (let index = 0; index < input.candidates.length; index += 1) {
    const remainingPeople = input.candidates.length - index;
    if (base.calls >= WEEKLY_MAX_PER_RUN) {
      base.deferred += remainingPeople;
      logSkip("queue_cap", { remaining: remainingPeople, day });
      break;
    }
    const elapsed = Date.now() - started;
    const timeoutMs = weeklyCallTimeout(elapsed);
    if (timeoutMs == null) {
      base.deferred += remainingPeople;
      logSkip("time_budget", { remaining: remainingPeople, elapsed_ms: elapsed, day });
      break;
    }
    if (spent >= WEEKLY_SPEND_SLICE_USD) {
      base.deferred += remainingPeople;
      logSkip("budget", { remaining: remainingPeople, spent_usd: spent, day });
      await input.logRow(null, day, "deferred_budget", `spent=${spent}`, null);
      base.skipped = "budget";
      break;
    }

    const candidate = input.candidates[index];
    const resumeText = candidate.resumeText;
    candidate.resumeText = "";
    base.calls += 1;
    let call: WeeklyWorkerCall;
    try {
      call = await input.callWorker(resumeText, timeoutMs);
    } catch (error) {
      base.errors += 1;
      const message = error instanceof Error ? error.message.slice(0, 120) : "error";
      logSkip("error", { profile_id: candidate.profileId, message });
      await input.logRow(candidate.profileId, day, "error", message, null);
      continue;
    }
    if (!call.ok) {
      if (call.code === "paused" || call.code === "daily") {
        const outcome = call.code === "paused" ? "deferred_spend" : "deferred_daily";
        base.deferred += remainingPeople;
        base.skipped = call.code === "paused" ? "spend" : "daily";
        logSkip(outcome, { profile_id: candidate.profileId, remaining: remainingPeople, day });
        await input.logRow(null, day, outcome, call.code, null);
        break;
      }
      base.errors += 1;
      logSkip("error", { profile_id: candidate.profileId, code: call.code });
      await input.logRow(candidate.profileId, day, "error", call.code, null);
      continue;
    }

    const jobs = selectTightMatches(call.strong, call.maybe);
    const cost = assumedCostUsd(call.estCostUsd);
    spent += cost;
    await input.saveResult(candidate.profileId, jobs, call.jobsChecked, weekLabel);
    if (jobs.length === 0) {
      await input.logRow(candidate.profileId, day, "matched", "strong=0", cost);
      base.matched += 1;
      logSkip("no_strong", { profile_id: candidate.profileId, jobs_checked: call.jobsChecked });
      continue;
    }
    const sent = await input.sendEmail(candidate);
    await input.logRow(
      candidate.profileId,
      day,
      "matched",
      `strong=${jobs.length} email=${sent}`,
      cost,
    );
    if (sent === "sent") {
      await input.markEmailed(candidate.profileId);
      base.emailed += 1;
    }
    base.matched += 1;
  }
  return base;
}
