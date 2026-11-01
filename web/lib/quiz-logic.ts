/** Compact job the quiz reads. Same fields as tag_jobs.py / the prototype. */
export type QuizJob = {
  t: string;
  e: number;
  c: string[];
  r: string[];
  l: string;
  mn: number;
  mx: number;
  p: string;
  po: string;
  cl: string;
  u: string;
  _why?: string;
};

export type QuizCatalog = {
  emps: string[];
  jobs: QuizJob[];
  labels: Record<string, string>;
  /** Distinct hiring systems among these open jobs. */
  systems: number;
  /** Data date, America/Toronto, e.g. "Nov 1, 2026". */
  asOf: string;
  /** America/Toronto calendar day the open-job filter used, YYYY-MM-DD. */
  today: string;
};

export type QuizAnswers = {
  work: string[];
  level: string[];
  sal: string | null;
  where: string[];
};

export const QUIZ_TARGET = 100;

export const QUIZ_RELATED: Record<string, string[]> = {
  it: ["office", "finance", "eng", "policy"],
  office: ["policy", "people", "community", "finance"],
  finance: ["office", "policy", "it"],
  policy: ["people", "office", "finance"],
  people: ["policy", "office"],
  eng: ["trades", "it", "policy"],
  community: ["office", "people", "policy"],
  trades: ["eng", "community", "office"],
};

const SHORT: Record<string, string> = {
  office: "office and admin",
  it: "IT and data",
  finance: "finance",
  policy: "policy and programs",
  people: "HR, legal and communications",
  eng: "engineering",
  community: "community and recreation",
  trades: "trades and operations",
};

export function quizLabels(): Record<string, string> {
  return {
    office: "Office, admin and customer service",
    it: "IT, data and digital",
    finance: "Finance, accounting and investment",
    policy: "Policy, planning and programs",
    people: "HR, legal and communications",
    eng: "Engineering, construction and environment",
    community: "Community, health, recreation and culture",
    trades: "Trades, transit and operations",
  };
}

export function torontoToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isoDaysBefore(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function asOfLabel(when: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(when);
}

/** Days from today until closing. Null when the job has no closing date. */
export function daysLeft(closing: string, today: string): number | null {
  const close = (closing || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(close) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const end = Date.parse(`${close}T00:00:00Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  return Math.round((end - start) / 86400000);
}

export function openQuizJobs(jobs: QuizJob[], today: string): QuizJob[] {
  return jobs.filter((job) => {
    const left = daysLeft(job.cl, today);
    return left === null || left >= 0;
  });
}

export function quizMedian(values: number[]): number {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type QuizStats = {
  open: number;
  employers: number;
  systems: number;
  withSalary: number;
  closing7: number;
  new30: number;
  median: number;
  top100: number;
  asOf: string;
  newSince: string;
};

export function countClosing7(open: QuizJob[], today: string): number {
  return open.filter((job) => {
    const left = daysLeft(job.cl, today);
    return left !== null && left >= 0 && left <= 7;
  }).length;
}

export function buildQuizStats(open: QuizJob[], systems: number, asOf: string, today: string): QuizStats {
  const newSince = isoDaysBefore(today, 30);
  const paid = open.filter((job) => job.mn);
  return {
    open: open.length,
    employers: new Set(open.map((job) => job.e)).size,
    systems,
    withSalary: paid.length,
    closing7: countClosing7(open, today),
    new30: open.filter((job) => job.po >= newSince).length,
    median: quizMedian(paid.map((job) => job.mn)),
    top100: open.filter((job) => job.mx >= 100000).length,
    asOf,
    newSince,
  };
}

function minSal(answers: QuizAnswers): number {
  return answers.sal && answers.sal !== "any" ? Number(answers.sal) * 1000 : 0;
}

function byWork(job: QuizJob, answers: QuizAnswers): boolean {
  return !answers.work.length || answers.work.includes("any") || job.c.some((cat) => answers.work.includes(cat));
}

function byArea(job: QuizJob, answers: QuizAnswers): boolean {
  return !answers.where.length || job.r.some((area) => answers.where.includes(area));
}

export type QuizResults = {
  workOnly: number;
  base: number;
  below: number;
  strong: QuizJob[];
  look: QuizJob[];
  all: QuizJob[];
  total: number;
  closing: number;
  fresh: number;
  paid: number;
};

export function quizResults(open: QuizJob[], answers: QuizAnswers, today: string, newSince: string): QuizResults {
  const min = minSal(answers);
  const workOnly = open.filter((job) => byWork(job, answers));
  const base = workOnly.filter((job) => byArea(job, answers));
  const strong: QuizJob[] = [];
  const look: QuizJob[] = [];
  let below = 0;
  for (const job of base) {
    if (min && job.mx && job.mx < min) {
      below += 1;
      continue;
    }
    const salOk = !min || job.mx >= min;
    const lvlOk = !answers.level.length || answers.level.includes(job.l);
    job._why = salOk && lvlOk ? "" : !job.mx && min ? "Salary not posted" : !lvlOk ? "Different level" : "";
    (salOk && lvlOk ? strong : look).push(job);
  }
  const hits = (job: QuizJob) => job.c.filter((cat) => answers.work.includes(cat)).length;
  const rank = (a: QuizJob, b: QuizJob) =>
    hits(b) - hits(a) || ((b.po || "") > (a.po || "") ? 1 : (b.po || "") < (a.po || "") ? -1 : 0) || b.mx - a.mx;
  strong.sort(rank);
  look.sort((a, b) => Number(Boolean(b.mx)) - Number(Boolean(a.mx)) || rank(a, b));
  const all = strong.concat(look);
  return {
    workOnly: workOnly.length,
    base: base.length,
    below,
    strong,
    look,
    all,
    total: all.length,
    closing: all.filter((job) => {
      const left = daysLeft(job.cl, today);
      return left !== null && left <= 7;
    }).length,
    fresh: all.filter((job) => job.po >= newSince).length,
    paid: all.filter((job) => job.mn).length,
  };
}

export type QuizBroad = {
  n: number;
  list: QuizJob[];
  extra: string;
  fresh: number;
  closing: number;
};

/** Headline count: exact matches, then related types, then the whole GTA, until 100+. */
export function quizBroad(open: QuizJob[], answers: QuizAnswers, found: QuizResults, today: string, newSince: string): QuizBroad {
  const min = minSal(answers);
  const ok = (job: QuizJob) => !(min && job.mx && job.mx < min);
  let types = !answers.work.length || answers.work.includes("any") ? null : answers.work.slice();
  let areas: string[] | null = answers.where.length ? answers.where.slice() : null;
  const overlaps = (picked: string[] | null, values: string[]) =>
    picked === null || values.some((value) => picked.includes(value));
  const pool = () => open.filter((job) => ok(job) && overlaps(types, job.c) && overlaps(areas, job.r));
  let list = pool();
  let added: string[] = [];
  let wide = false;
  let allTypes = false;
  const base = types && types.slice();
  const cand: string[] = [];
  if (base) {
    base.forEach((type) => {
      (QUIZ_RELATED[type] || []).forEach((related) => {
        if (!base.includes(related) && !cand.includes(related)) cand.push(related);
      });
    });
  }
  const widenTypes = () => {
    for (const related of cand) {
      if (list.length >= QUIZ_TARGET) break;
      if (!types) return;
      types.push(related);
      added.push(related);
      list = pool();
    }
  };
  if (types) widenTypes();
  if (list.length < QUIZ_TARGET && areas) {
    areas = null;
    wide = true;
    types = base ? base.slice() : null;
    added = [];
    list = pool();
    if (types) widenTypes();
  }
  if (list.length < QUIZ_TARGET && types) {
    types = null;
    allTypes = true;
    list = pool();
  }
  const exact = new Set(found.all);
  const rest = list.filter((job) => !exact.has(job)).sort((a, b) => ((b.po || "") > (a.po || "") ? 1 : -1));
  rest.forEach((job) => {
    job._why = "Related role";
  });
  const parts: string[] = [];
  if (added.length && !allTypes) parts.push(`related roles in ${added.map((id) => SHORT[id] || id).join(", ")}`);
  if (allTypes) parts.push("other kinds of public work");
  if (wide) parts.push(added.length || allTypes ? "across the GTA" : "similar jobs elsewhere in the GTA");
  const full = found.all.concat(rest);
  return {
    n: full.length,
    list: full,
    extra: parts.join((added.length || allTypes) && wide ? " " : " and "),
    fresh: full.filter((job) => job.po >= newSince).length,
    closing: full.filter((job) => {
      const left = daysLeft(job.cl, today);
      return left !== null && left <= 7;
    }).length,
  };
}
