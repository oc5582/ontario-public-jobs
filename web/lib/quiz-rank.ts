import { qualifyingTightHits, type TightHit } from "./tight-match";

/** How many strict matches the quiz shows. */
export const QUIZ_TOP = 5;
/** One employer can fill every slot only when the other employers score well below it. */
export const QUIZ_EMPLOYER_CAP = 3;
/**
 * Another employer's job is close enough to enforce the cap when its score
 * is at least this fraction of the job being considered.
 */
export const QUIZ_SCORE_CLOSE = 0.85;

export type ScoredTightHit = TightHit & { score: number };

const STOP = new Set([
  "the", "and", "for", "with", "from", "this", "that", "your", "you", "are", "was",
  "job", "role", "work", "full", "part", "time", "term",
]);

const SHIFT_WORDS =
  /\b(full[\s-]*time|part[\s-]*time|casual|temporary|temp|contract|permanent|term|rotating|nights?|evenings?|weekends?|days?)\b/gi;
const DAY_WORDS = /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|days)?\b/gi;

/** Same title at the same employer, ignoring shift, schedule, and unit markers. */
export function quizTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(SHIFT_WORDS, " ")
    .replace(DAY_WORDS, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function quizEmployerKey(employer: string): string {
  return employer.toLowerCase().replace(/\s+/g, " ").trim();
}

export function quizJobPath(urlOrPath: string): string {
  return urlOrPath
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP.has(word));
}

/** How many title words also appear in the resume. Higher is a closer field. */
export function quizFieldFit(resume: string, title: string): number {
  const known = new Set(words(resume));
  let fit = 0;
  for (const word of new Set(words(title))) {
    if (known.has(word)) fit += 1;
  }
  return fit;
}

function seniorityLevel(text: string): number | null {
  const value = text.toLowerCase();
  if (/\b(director|chief|vice[\s-]*president|\bvp\b)\b/.test(value)) return 4;
  if (/\b(manager|supervisor|superintendent)\b/.test(value)) return 3;
  if (/\b(senior|lead|principal)\b/.test(value)) return 2;
  if (/\b(junior|entry[\s-]*level|assistant|intern|student|co-?op)\b/.test(value)) return 0;
  return null;
}

function resumeYears(resume: string): number {
  const digits = /([0-9]{1,2})\+?\s+years/.exec(resume.toLowerCase());
  if (digits) return Number(digits[1]);
  const span = /(20[0-9]{2})\s*(?:to|-|–|—)\s*(20[0-9]{2}|present)/i.exec(resume);
  if (!span) return 0;
  const end = /present/i.test(span[2]) ? 2026 : Number(span[2]);
  return Math.max(0, end - Number(span[1]));
}

function resumeLevel(resume: string): number {
  const titled = seniorityLevel(resume);
  const years = resumeYears(resume);
  const fromYears = years >= 12 ? 3 : years >= 7 ? 2 : years >= 2 ? 1 : 0;
  return Math.max(titled ?? 0, fromYears);
}

/** Absolute gap between the resume's level and the job title's level. Lower is closer. */
export function quizSeniorityGap(resume: string, title: string): number {
  const job = seniorityLevel(title) ?? 1;
  return Math.abs(resumeLevel(resume) - job);
}

function scoreKey(score: number): number {
  return Math.round(score * 10000);
}

function closingKey(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "9999-99-99";
}

/** Negative when `a` should be shown before `b`. Score first. Date only breaks a tie. */
export function compareQuizHits(resume: string, a: ScoredTightHit, b: ScoredTightHit): number {
  const byScore = scoreKey(b.score) - scoreKey(a.score);
  if (byScore !== 0) return byScore;
  const byField = quizFieldFit(resume, b.title) - quizFieldFit(resume, a.title);
  if (byField !== 0) return byField;
  const bySeniority = quizSeniorityGap(resume, a.title) - quizSeniorityGap(resume, b.title);
  if (bySeniority !== 0) return bySeniority;
  const byClose = closingKey(a.closing_date).localeCompare(closingKey(b.closing_date));
  if (byClose !== 0) return byClose;
  return a.title.localeCompare(b.title) || a.url.localeCompare(b.url);
}

function dedupe(hits: ScoredTightHit[], resume: string): ScoredTightHit[] {
  const best = new Map<string, ScoredTightHit>();
  for (const hit of hits) {
    const key = `${quizEmployerKey(hit.employer)}|${quizTitleKey(hit.title)}`;
    const prev = best.get(key);
    if (!prev || compareQuizHits(resume, hit, prev) < 0) best.set(key, hit);
  }
  return [...best.values()];
}

function closeOtherEmployer(hit: ScoredTightHit, sorted: ScoredTightHit[], picked: Set<ScoredTightHit>): boolean {
  const floor = hit.score * QUIZ_SCORE_CLOSE;
  for (const other of sorted) {
    if (other === hit || picked.has(other)) continue;
    if (quizEmployerKey(other.employer) === quizEmployerKey(hit.employer)) continue;
    if (scoreKey(other.score) > scoreKey(hit.score)) continue;
    if (other.score + 1e-9 >= floor) return true;
    return false;
  }
  return false;
}

/**
 * Top quiz jobs from the strict list.
 * Score descending, then closer field and seniority, then sooner closing date.
 * Near-identical title + employer postings collapse to the best one.
 * A fourth job from the same employer is skipped when a different employer is close.
 */
export function rankQuizMatches(hits: ScoredTightHit[], resume: string, limit = QUIZ_TOP): ScoredTightHit[] {
  const sorted = dedupe(hits, resume).sort((a, b) => compareQuizHits(resume, a, b));
  const picked: ScoredTightHit[] = [];
  const skipped: ScoredTightHit[] = [];
  const pickedSet = new Set<ScoredTightHit>();
  const counts = new Map<string, number>();
  for (const hit of sorted) {
    if (picked.length >= limit) break;
    const employer = quizEmployerKey(hit.employer);
    const count = counts.get(employer) ?? 0;
    if (count >= QUIZ_EMPLOYER_CAP && closeOtherEmployer(hit, sorted, pickedSet)) {
      skipped.push(hit);
      continue;
    }
    picked.push(hit);
    pickedSet.add(hit);
    counts.set(employer, count + 1);
  }
  for (const hit of skipped) {
    if (picked.length >= limit) break;
    picked.push(hit);
  }
  picked.sort((a, b) => compareQuizHits(resume, a, b));
  return picked;
}

export function attachQuizScores(hits: TightHit[], scores: Map<string, number>): ScoredTightHit[] {
  return hits.map((hit) => ({
    ...hit,
    score: scores.get(quizJobPath(hit.url)) ?? 0,
  }));
}

/** Qualifying strict hits, ranked for the quiz. Saturday does not use this. */
export function rankQualifyingQuizHits(
  strong: TightHit[],
  maybe: TightHit[],
  resume: string,
  scores: Map<string, number>,
): ScoredTightHit[] {
  return rankQuizMatches(attachQuizScores(qualifyingTightHits(strong, maybe), scores), resume);
}

/** Lexical scores from match_candidate_scores. Empty when the lookup is not configured or it fails. */
export async function loadCandidateScores(
  resume: string,
  fetchImpl: typeof fetch,
  options: { secret?: string } = {},
): Promise<Map<string, number>> {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const secret = options.secret || "";
  if (!base || !key || !secret) return new Map();
  try {
    const res = await fetchImpl(`${base}/rest/v1/rpc/match_candidate_scores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ p_secret: secret, p_resume: resume, p_limit: 500 }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.log(JSON.stringify({ event: "quiz_scores_failed", status: res.status }));
      return new Map();
    }
    let payload: unknown = await res.json().catch(() => null);
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = null;
      }
    }
    const jobs = payload && typeof payload === "object" && Array.isArray((payload as { jobs?: unknown }).jobs)
      ? (payload as { jobs: unknown[] }).jobs
      : [];
    const scores = new Map<string, number>();
    for (const job of jobs) {
      if (!job || typeof job !== "object") continue;
      const row = job as { path?: unknown; score?: unknown };
      const path = quizJobPath(String(row.path || ""));
      const score = Number(row.score);
      if (!path || !Number.isFinite(score)) continue;
      const prev = scores.get(path);
      if (prev == null || score > prev) scores.set(path, score);
    }
    return scores;
  } catch (error) {
    console.log(JSON.stringify({
      event: "quiz_scores_failed",
      message: error instanceof Error ? error.message.slice(0, 120) : "error",
    }));
    return new Map();
  }
}
