"use client";

import { startGuestCheckout } from "@/app/billing/actions";
import { CheckoutForm } from "@/components/CheckoutForm";
import { trackEvent } from "@/components/AnalyticsEvents";
import type { CheckoutUtm } from "@/lib/checkout-utm";
import { isCheckoutEmail } from "@/lib/guest-checkout";
import { LEGAL } from "@/lib/legal-config";
import { alertConsentLabel, alertConsentSender, disclosureText, refundSentence } from "@/lib/legal-copy";
import { trackMeta } from "@/lib/meta-pixel";
import {
  buildQuizStats,
  daysLeft,
  openQuizJobs,
  quizBroad,
  quizResults,
  type QuizAnswers,
  type QuizCatalog,
  type QuizJob,
  type QuizResults,
  type QuizStats,
} from "@/lib/quiz-logic";
import { PLANS, SIGNUP_ENDPOINT, pricingBilled, type PlanId } from "@/lib/site";
import { weeklyAlertPayload } from "@/lib/weekly-alert";
import { useEffect, useMemo, useRef, useState } from "react";
import { MembershipCompare } from "@/components/MembershipCompare";

const SCREENS = [
  "start",
  "work",
  "pay",
  "long",
  "hard",
  "notyou",
  "fix",
  "level",
  "salary",
  "payoff",
  "where",
  "resume",
  "loading",
  "reveal",
  "matches",
  "why",
  "paywall",
] as const;

type ScreenId = (typeof SCREENS)[number];

const QUIZ_COUNT = SCREENS.filter((id) => id !== "start").length;
const STORAGE = "pj-start-quiz";

const WORK = [
  ["office", "🗂️"],
  ["it", "💻"],
  ["finance", "📊"],
  ["policy", "📝"],
  ["people", "⚖️"],
  ["eng", "🏗️"],
  ["community", "🤝"],
  ["trades", "🔧"],
] as const;

const REGIONS: { id: string; t: string; d: string }[] = [
  { id: "toronto", t: "Toronto", d: "incl. North York, Etobicoke, Scarborough" },
  { id: "halton", t: "Halton", d: "Oakville, Burlington, Milton" },
  { id: "york", t: "York Region", d: "Markham, Richmond Hill, Newmarket, Aurora" },
  { id: "peel", t: "Peel", d: "Mississauga, Brampton" },
  { id: "durham", t: "Durham", d: "Ajax, Oshawa, Whitby, Pickering, Clarington" },
  { id: "hamilton", t: "Hamilton", d: "" },
  { id: "other", t: "Various locations", d: "Federal and national employers hiring in several cities" },
];

const LEVELS = [
  ["entry", "🌱", "Entry level, student or part-time"],
  ["mid", "📈", "Experienced"],
  ["senior", "⭐", "Senior or specialist"],
  ["mgr", "🧭", "Manager, supervisor or director"],
] as const;

const LONG = [
  ["new", "🚀", "Just started"],
  ["weeks", "🗓️", "A few weeks"],
  ["months", "⏳", "A few months"],
  ["forever", "💀", "Feels like forever"],
] as const;

const HARD = [
  ["sites", "🧩", "Too many separate careers sites to check"],
  ["late", "⌛", "I find jobs after they've closed"],
  ["fit", "🎯", "I can't tell which jobs fit me"],
  ["pay", "💲", "I don't know what jobs pay"],
  ["apps", "📄", "Hiring systems are confusing"],
] as const;

const SALARY = [
  ["60", "$60,000 or more"],
  ["80", "$80,000 or more"],
  ["100", "$100,000 or more"],
  ["120", "$120,000 or more"],
  ["any", "Any salary / not sure"],
] as const;

type ResumeHit = {
  url: string;
  title: string;
  employer: string;
  location: string;
  closing_date: string;
  reason: string;
};

type ProvinceOption = { code: string; label: string };

function fmt(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-CA")}`;
}

function kAmount(amount: number): string {
  return `$${Math.round(amount / 1000)}k`;
}

function quizBilled(id: PlanId): { text: string; savings: string | null } {
  const billed = pricingBilled(id);
  if (id !== "year") return billed;
  const plan = PLANS.find((item) => item.id === "year");
  return { text: `${plan?.price ?? "CA$59"} renews yearly`, savings: billed.savings };
}

function noticeText(notice: string): string {
  if (notice === "stripe") return "Billing is not available right now.";
  if (notice === "plan") return "Choose one of the three memberships below.";
  if (notice === "terms") return "Check the box to agree to the Terms before continuing.";
  if (notice === "province") return "Choose your Canadian billing province so GST/HST can be added.";
  if (notice === "email") return "Enter a valid email address.";
  if (notice === "send") return "We could not start checkout for that email. Try again in a minute.";
  if (notice === "subscribed") return "This email already has a membership. Sign in to manage billing. You have not been charged again.";
  return "";
}

function sameJob(href: string, path: string): boolean {
  const left = href.replace(/^https?:\/\/[^/]+/i, "").replace(/\/+$/, "");
  const right = path.replace(/\/+$/, "");
  return left === right;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("script"));
    document.head.appendChild(script);
  });
}

async function pdfText(buf: ArrayBuffer): Promise<string> {
  // Loaded in the browser. webpackIgnore keeps it off the bundle; CSP already allows jsDelivr.
  const pdfjs = (await import(
    /* webpackIgnore: true */
    // @ts-expect-error pdf.js has no local types and is not bundled.
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs"
  )) as {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (input: { data: ArrayBuffer }) => {
      promise: Promise<{
        numPages: number;
        getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str?: string; hasEOL?: boolean }[] }> }>;
      }>;
    };
  };
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const out: string[] = [];
  const pages = Math.min(doc.numPages, 10);
  for (let i = 1; i <= pages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out.push(content.items.map((item) => `${item.str || ""}${item.hasEOL ? "\n" : " "}`).join(""));
  }
  return out.join("\n");
}

async function docxText(buf: ArrayBuffer): Promise<string> {
  const host = window as Window & {
    mammoth?: { extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };
  };
  if (!host.mammoth) {
    await loadScript("https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js");
  }
  const result = await host.mammoth?.extractRawText({ arrayBuffer: buf });
  return result?.value || "";
}

export function QuizApp({
  catalog,
  signedIn,
  notice,
  returnEmail,
  provinces,
  utm,
}: {
  catalog: QuizCatalog;
  signedIn: boolean;
  notice: string;
  returnEmail: string;
  provinces: ProvinceOption[];
  utm: CheckoutUtm;
}) {
  const model = useMemo(() => {
    const jobs = openQuizJobs(
      catalog.jobs.map((job) => ({ ...job, c: job.c.slice(), r: job.r.slice() })),
      catalog.today,
    );
    const stats = buildQuizStats(jobs, catalog.systems, catalog.asOf, catalog.today);
    return { jobs, stats };
  }, [catalog]);
  const { jobs, stats } = model;
  const [index, setIndex] = useState(0);
  const [hist, setHist] = useState<number[]>([]);
  const [work, setWork] = useState<string[]>([]);
  const [long, setLong] = useState<string | null>(null);
  const [hard, setHard] = useState<string[]>([]);
  const [level, setLevel] = useState<string[]>([]);
  const [sal, setSal] = useState<string | null>(null);
  const [where, setWhere] = useState<string[]>([]);
  const [whereSeen, setWhereSeen] = useState(false);
  const [email, setEmail] = useState("");
  const [resumeName, setResumeName] = useState("");
  const [resumeStatus, setResumeStatus] = useState("");
  const [modal, setModal] = useState<"" | "email" | "reminder">("");
  const [modalError, setModalError] = useState("");
  const [pending, setPending] = useState(false);
  const [loadOn, setLoadOn] = useState(0);
  const [loadReady, setLoadReady] = useState(false);
  const [resumeHits, setResumeHits] = useState<ResumeHit[]>([]);
  const [resumeNote, setResumeNote] = useState("");
  const [plan, setPlan] = useState<PlanId>("quarter");
  const [booted, setBooted] = useState(false);
  const resumeText = useRef("");
  const emailRef = useRef("");
  const whereSeenRef = useRef(false);
  const indexRef = useRef(0);
  emailRef.current = email;
  whereSeenRef.current = whereSeen;
  indexRef.current = index;

  const answers: QuizAnswers = { work, level, sal, where };
  const found = useMemo(
    () => quizResults(jobs, answers, catalog.today, stats.newSince),
    // answers is a fresh object; depend on the fields that change the match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobs, work, level, sal, where, catalog.today, stats.newSince],
  );
  const broad = useMemo(
    () => quizBroad(jobs, answers, found, catalog.today, stats.newSince),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobs, answers.work, answers.level, answers.sal, answers.where, found, catalog.today, stats.newSince],
  );

  const screen = SCREENS[index];
  const quizStep = SCREENS.slice(0, index + 1).filter((id) => id !== "start").length;
  const others = Math.max(0, stats.employers - 4);

  useEffect(() => {
    if (notice) {
      try {
        const raw = sessionStorage.getItem(STORAGE);
        const saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        if (Array.isArray(saved.work)) setWork(saved.work.filter((item) => typeof item === "string"));
        if (Array.isArray(saved.hard)) setHard(saved.hard.filter((item) => typeof item === "string"));
        if (Array.isArray(saved.level)) setLevel(saved.level.filter((item) => typeof item === "string"));
        if (Array.isArray(saved.where)) setWhere(saved.where.filter((item) => typeof item === "string"));
        if (typeof saved.long === "string") setLong(saved.long);
        if (typeof saved.sal === "string") setSal(saved.sal);
        if (saved.whereSeen === true) setWhereSeen(true);
        const kept = returnEmail || (typeof saved.email === "string" ? saved.email : "");
        if (kept) setEmail(kept);
      } catch {
        if (returnEmail) setEmail(returnEmail);
      }
      setIndex(SCREENS.indexOf("paywall"));
    }
    setBooted(true);
  }, [notice, returnEmail]);

  useEffect(() => {
    if (!booted) return;
    try {
      sessionStorage.setItem(
        STORAGE,
        JSON.stringify({ index, work, long, hard, level, sal, where, whereSeen, email }),
      );
    } catch {
      /* private mode */
    }
  }, [booted, index, work, long, hard, level, sal, where, whereSeen, email]);

  useEffect(() => {
    const id = SCREENS[index];
    trackEvent("quiz_step", { step: String(index), screen: id });
    if (id === "paywall") trackMeta("track", "ViewContent", { content_name: "start_plans" });
    if (id === "reveal") setModal("email");
    if (id === "salary") setSal((current) => current || "80");
    window.scrollTo(0, 0);
  }, [index]);

  const loadLines = useMemo(() => {
    const lines = [{ strong: stats.open.toLocaleString("en-CA"), rest: ` open jobs from ${stats.employers} employers` }];
    const min = sal && sal !== "any" ? Number(sal) * 1000 : 0;
    if (min && found.below) {
      lines.push({ strong: found.below.toLocaleString("en-CA"), rest: ` removed: posted pay tops out under ${fmt(min)}` });
    }
    if (resumeName) lines.push({ strong: "", rest: "Compared with your resume" });
    return lines;
  }, [stats.open, stats.employers, sal, found.below, resumeName]);

  useEffect(() => {
    if (SCREENS[index] !== "loading") return;
    setLoadOn(0);
    setLoadReady(false);
    const count = loadLines.length;
    const step = 2600 / Math.max(1, count);
    const timers = loadLines.map((_, line) =>
      window.setTimeout(() => {
        setLoadOn(line + 1);
        if (line + 1 === count) setLoadReady(true);
      }, step * (line + 1)),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [index, loadLines]);

  function advance() {
    const current = indexRef.current;
    const nextId = SCREENS[current + 1];
    if (nextId === "matches" && !isCheckoutEmail(emailRef.current)) {
      setModal("email");
      return;
    }
    if (nextId === "where" && !whereSeenRef.current) {
      whereSeenRef.current = true;
      setWhereSeen(true);
      setWhere((curr) => (curr.length ? curr : ["toronto"]));
    }
    setHist((prev) => [...prev, current]);
    setIndex(Math.min(SCREENS.length - 1, current + 1));
  }

  function back() {
    setHist((prev) => {
      if (!prev.length) return prev;
      setIndex(prev[prev.length - 1]);
      return prev.slice(0, -1);
    });
    setModal("");
  }

  function pickMulti(current: string[], value: string): string[] {
    if (value === "any") return current.includes("any") ? [] : ["any"];
    const rest = current.filter((item) => item !== "any");
    return rest.includes(value) ? rest.filter((item) => item !== value) : rest.concat(value);
  }

  function choose(group: "work" | "hard" | "level" | "where" | "long" | "sal", value: string, multi: boolean) {
    if (group === "work") setWork((curr) => (multi ? pickMulti(curr, value) : [value]));
    if (group === "hard") setHard((curr) => pickMulti(curr, value));
    if (group === "level") setLevel((curr) => pickMulti(curr, value));
    if (group === "where") setWhere((curr) => pickMulti(curr, value));
    if (group === "long") setLong(value);
    if (group === "sal") setSal(value);
    if (!multi && (group === "long" || group === "sal")) window.setTimeout(advance, 260);
  }

  async function readResume(file: File) {
    setResumeStatus("Reading your file...");
    setResumeName("");
    resumeText.current = "";
    if (file.size > 10 * 1024 * 1024) {
      setResumeStatus("That file is too large. Use a file under 10 MB.");
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const name = file.name.toLowerCase();
      let text = "";
      if (name.endsWith(".pdf")) text = await pdfText(buf);
      else if (name.endsWith(".docx")) text = await docxText(buf);
      else {
        setResumeStatus("Use a PDF or Word (.docx) file.");
        return;
      }
      text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      if (text.length < 80) {
        setResumeStatus("We could not read text from this file. It may be a scanned image.");
        return;
      }
      resumeText.current = text.slice(0, 15000);
      setResumeName(file.name);
      setResumeStatus("Read on this device. Your resume is not stored.");
    } catch {
      resumeText.current = "";
      setResumeStatus("We could not read this file.");
    }
  }

  async function subscribe(address: string): Promise<string> {
    const endpoint = SIGNUP_ENDPOINT.trim();
    if (!endpoint) return "Email alerts are not turned on yet. Please try again later.";
    const payload = weeklyAlertPayload(address);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        mode: "cors",
        credentials: "omit",
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) return body.error || "Something went wrong. Please try again.";
      trackMeta("track", "Lead");
      fetch("/api/alerts/consent/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: payload.email,
          page_url: window.location.href,
        }),
      }).catch(() => {});
      return "";
    } catch {
      return "Something went wrong. Please try again.";
    }
  }

  async function sendResume(address: string) {
    const text = resumeText.current.trim();
    resumeText.current = "";
    if (text.length < 80) return;
    try {
      const response = await fetch("/api/match/", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          email: address,
          run_id: crypto.randomUUID(),
          casl_consent: "",
          resume_text: text,
          _gotcha: "",
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        strong?: ResumeHit[];
        maybe?: ResumeHit[];
      };
      if (!response.ok || !data.ok) {
        setResumeHits([]);
        setResumeNote(data.error || "We could not compare your resume, so these are matches from your answers.");
        return;
      }
      setResumeHits([...(data.strong || []), ...(data.maybe || [])].slice(0, 5));
      setResumeNote("");
    } catch {
      setResumeHits([]);
      setResumeNote("We could not compare your resume, so these are matches from your answers.");
    }
  }

  async function submitEmail(kind: "results" | "resume_reminder", address: string, agreed: boolean) {
    const value = address.trim();
    if (!isCheckoutEmail(value) || !agreed) {
      setModalError("Enter your email and check the box to agree to job alert emails.");
      return;
    }
    setPending(true);
    setModalError("");
    const error = await subscribe(value);
    if (error) {
      setPending(false);
      setModalError(error);
      return;
    }
    setEmail(value);
    emailRef.current = value;
    if (kind === "results") await sendResume(value);
    setPending(false);
    setModal("");
    advance();
  }

  const percent = stats.open ? Math.round((stats.withSalary / stats.open) * 100) : 0;
  const closingShare = stats.open ? stats.closing7 / stats.open : 0;
  const reach = sal && sal !== "any" ? jobs.filter((job) => job.mx >= Number(sal) * 1000).length : stats.withSalary;

  return (
    <div className="quiz">
      <header className="quiz-head">
        <div className="quiz-wrap">
          {index > 0 ? (
            <button className="quiz-back" type="button" onClick={back}>
              ‹ Back
            </button>
          ) : null}
          <span className="quiz-logo">PublicJobs.ca</span>
          {screen !== "start" ? (
            <span className="quiz-step">
              Your job matches <b>{Math.round((quizStep / QUIZ_COUNT) * 100)}%</b>
            </span>
          ) : null}
        </div>
        <div className="quiz-bar">
          <i style={{ width: screen === "start" ? 0 : `${(quizStep / QUIZ_COUNT) * 100}%` }} />
        </div>
      </header>
      <main className="quiz-main">
        <div className="quiz-wrap">
          <section className="quiz-screen" key={screen}>
            {screen === "start" ? <Landing stats={stats} others={others} /> : null}
            {screen === "work" ? (
              <ChoiceScreen
                title="What kind of work are you looking for?"
                hint="Pick all that apply. Government titles vary a lot, so a job can sit in more than one group."
                options={[
                  ...WORK.map(([id, em]) => ({
                    id,
                    em,
                    t: catalog.labels[id] || id,
                    d: "",
                    n: jobs.filter((job) => job.c.includes(id)).length as number | null,
                  })),
                  { id: "any", em: "🔍", t: "Not sure yet, show me everything", d: "", n: null },
                ]}
                selected={work}
                multi
                onChoose={(value) => choose("work", value, true)}
              />
            ) : null}
            {screen === "pay" ? <PayScreen stats={stats} percent={percent} /> : null}
            {screen === "long" ? (
              <ChoiceScreen
                title="How long have you been looking for a job?"
                options={LONG.map(([id, em, t]) => ({ id, em, t, n: null }))}
                selected={long ? [long] : []}
                multi={false}
                onChoose={(value) => choose("long", value, false)}
              />
            ) : null}
            {screen === "hard" ? (
              <ChoiceScreen
                title="What's the hardest part of finding a public-sector job?"
                hint="Pick all that apply."
                options={HARD.map(([id, em, t]) => ({ id, em, t, n: null }))}
                selected={hard}
                multi
                onChoose={(value) => choose("hard", value, true)}
              />
            ) : null}
            {screen === "notyou" ? <NotYou stats={stats} share={closingShare} /> : null}
            {screen === "fix" ? <Fix stats={stats} /> : null}
            {screen === "level" ? (
              <ChoiceScreen
                title="What level of job are you after?"
                hint="Pick all that apply. We use this to put the best fits first, not to hide jobs."
                options={LEVELS.map(([id, em, t]) => ({
                  id,
                  em,
                  t,
                  n: jobs.filter((job) => job.l === id).length,
                }))}
                selected={level}
                multi
                onChoose={(value) => choose("level", value, true)}
              />
            ) : null}
            {screen === "salary" ? (
              <ChoiceScreen
                title="What's the lowest salary you'd take?"
                hint={`Pre-set to $80,000, close to the median starting salary of ${fmt(stats.median)}. Jobs that don't post their pay stay in your results.`}
                options={SALARY.map(([id, t]) => ({ id, t, n: null }))}
                selected={[sal || "80"]}
                multi={false}
                onChoose={(value) => choose("sal", value, false)}
              />
            ) : null}
            {screen === "payoff" ? <Payoff stats={stats} sal={sal || "80"} reach={reach} /> : null}
            {screen === "where" ? (
              <ChoiceScreen
                title="Where would you like to work?"
                hint="We've picked Toronto, where most jobs are. Add or change areas, or skip."
                options={REGIONS.map((region) => ({
                  ...region,
                  n: jobs.filter((job) => job.r.includes(region.id)).length,
                }))}
                selected={where}
                multi
                onChoose={(value) => choose("where", value, true)}
              />
            ) : null}
            {screen === "resume" ? (
              <ResumeScreen
                name={resumeName}
                status={resumeStatus}
                onFile={(file) => void readResume(file)}
              />
            ) : null}
            {screen === "loading" ? <Loading stats={stats} lines={loadLines} onCount={loadOn} /> : null}
            {screen === "reveal" ? <Reveal found={found} broadN={broad.n} extra={broad.extra} /> : null}
            {screen === "matches" ? (
              <Matches
                catalog={catalog}
                jobs={jobs}
                found={found}
                broadList={broad.list}
                broad={broad}
                resumeHits={resumeHits}
                resumeNote={resumeNote}
                today={catalog.today}
                newSince={stats.newSince}
              />
            ) : null}
            {screen === "why" ? <Why stats={stats} /> : null}
            {screen === "paywall" ? (
              <Plans
                catalog={catalog}
                stats={stats}
                broadList={broad.list}
                broadN={broad.n}
                fresh={broad.fresh}
                today={catalog.today}
                newSince={stats.newSince}
                email={email}
                signedIn={signedIn}
                notice={noticeText(notice)}
                provinces={provinces}
                utm={utm}
                plan={plan}
                onPlan={setPlan}
              />
            ) : null}
          </section>
        </div>
      </main>
      {screen === "paywall" ? null : (
        <div className="quiz-cta">
          <div className="quiz-wrap">
            <Cta
              screen={screen}
              work={work}
              hard={hard}
              level={level}
              long={long}
              sal={sal}
              where={where}
              stats={stats}
              workOnly={found.workOnly}
              areaCount={found.base}
              resumeName={resumeName}
              loadReady={loadReady}
              onNext={advance}
              onSkipWhere={() => {
                setWhere([]);
                advance();
              }}
              onSkipResume={() => {
                setModalError("");
                setModal("reminder");
              }}
            />
          </div>
        </div>
      )}
      {modal ? (
        <div className="quiz-modal">
          <div className="quiz-sheet" role="dialog" aria-modal="true" aria-labelledby="quiz-modal-title">
            {modal === "email" ? (
              <EmailAsk
                titleId="quiz-modal-title"
                eyebrow="Your results"
                heading={`We found ${broad.n}+ active jobs for you`}
                button={pending ? "Saving..." : "Show me my jobs"}
                email={email}
                error={modalError}
                pending={pending}
                onSubmit={(value, agreed) => void submitEmail("results", value, agreed)}
              />
            ) : (
              <>
                <EmailAsk
                  titleId="quiz-modal-title"
                  eyebrow="No problem"
                  heading="Want to add your resume later?"
                  lead="We can email you a link to finish your matches when you have your resume handy."
                  button={pending ? "Saving..." : "Email me a link"}
                  email={email}
                  error={modalError}
                  pending={pending}
                  onSubmit={(value, agreed) => void submitEmail("resume_reminder", value, agreed)}
                />
                <button
                  className="quiz-link"
                  type="button"
                  onClick={() => {
                    setModal("");
                    advance();
                  }}
                >
                  No thanks, show my jobs
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Landing({ stats, others }: { stats: QuizStats; others: number }) {
  return (
    <>
      <p className="quiz-eyebrow">For job seekers in Toronto and the GTA</p>
      <h1>Stop checking {stats.employers} government careers sites.</h1>
      <p className="quiz-lead">
        Every weekday we read the careers pages of City of Toronto, TTC, Metrolinx, the Ontario Public Service and{" "}
        {others} other public employers, and put the open jobs in one list.
      </p>
      <div className="quiz-stats">
        <div>
          <b>{stats.open.toLocaleString("en-CA")}</b>
          <span>open jobs today</span>
        </div>
        <div>
          <b>{stats.top100.toLocaleString("en-CA")}</b>
          <span>pay up to $100k or more</span>
        </div>
        <div>
          <b>{stats.new30.toLocaleString("en-CA")}</b>
          <span>posted in the last 30 days</span>
        </div>
      </div>
      <p className="quiz-indep">Independent job board. Not affiliated with any government or employer.</p>
    </>
  );
}

function PayScreen({ stats, percent }: { stats: QuizStats; percent: number }) {
  return (
    <>
      <h2>Good choice. Public-sector jobs usually tell you the pay.</h2>
      <div className="quiz-panel">
        <div className="quiz-big" style={{ color: "#fff" }}>
          {percent}%
        </div>
        <p style={{ marginTop: 6 }}>of today&apos;s {stats.open.toLocaleString("en-CA")} openings post a salary range up front.</p>
      </div>
      <div className="quiz-stats">
        <div>
          <b>{kAmount(stats.median)}</b>
          <span>median posted starting salary</span>
        </div>
        <div>
          <b>{stats.withSalary.toLocaleString("en-CA")}</b>
          <span>jobs show the pay</span>
        </div>
        <div>
          <b>{stats.top100.toLocaleString("en-CA")}</b>
          <span>pay up to $100k+</span>
        </div>
      </div>
      <p className="quiz-src">Source: PublicJobs.ca open jobs, {stats.asOf}.</p>
    </>
  );
}

function NotYou({ stats, share }: { stats: QuizStats; share: number }) {
  const circumference = 2 * Math.PI * 44;
  const pct = Math.round(share * 100);
  return (
    <>
      <h2>It&apos;s not you. Public jobs are scattered.</h2>
      <p className="quiz-lead">
        GTA public employers post on {stats.employers} separate careers sites, using {stats.systems} different hiring
        systems. And jobs move fast.
      </p>
      <div className="quiz-donut">
        <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`${pct} percent close within 7 days`}>
          <circle cx="56" cy="56" r="44" fill="none" stroke="#e8ebee" strokeWidth="16" />
          <circle
            cx="56"
            cy="56"
            r="44"
            fill="none"
            stroke="#8a4b00"
            strokeWidth="16"
            strokeDasharray={`${(circumference * share).toFixed(1)} ${circumference.toFixed(1)}`}
            transform="rotate(-90 56 56)"
          />
          <text x="56" y="62" textAnchor="middle" fontSize="20" fontWeight="700" fill="#16202c">
            {pct}%
          </text>
        </svg>
        <div className="quiz-key">
          <div>
            <span className="quiz-sw" style={{ background: "#8a4b00" }} />
            <b>{stats.closing7.toLocaleString("en-CA")}</b> of {stats.open.toLocaleString("en-CA")} close within 7 days
          </div>
          <div>
            <span className="quiz-sw" style={{ background: "#e8ebee", outline: "1px solid #d9dee4" }} />
            <b>{(stats.open - stats.closing7).toLocaleString("en-CA")}</b> close later or have no date
          </div>
        </div>
      </div>
      <p className="quiz-lead" style={{ color: "var(--quiz-ink)" }}>
        Check once a week and you can miss them.
      </p>
      <p className="quiz-src">Source: PublicJobs.ca open jobs, {stats.asOf}.</p>
    </>
  );
}

function Fix({ stats }: { stats: QuizStats }) {
  return (
    <>
      <h2>PublicJobs.ca checks all {stats.employers} for you.</h2>
      <div className="quiz-tl">
        <div>
          <small>Employer</small>
          <span>Posts a job on its own careers site</span>
        </div>
        <div>
          <small>Within 24 hr</small>
          <span>We pick it up and add it to one list</span>
        </div>
        <div>
          <small>Same day</small>
          <span>You see the pay and closing date in one place</span>
        </div>
        <div>
          <small>You</small>
          <span>
            <b>Apply on the employer&apos;s own site.</b> Free, always.
          </span>
        </div>
      </div>
      <p className="quiz-small">Employers never pay to be listed, so no job is pushed to the top.</p>
    </>
  );
}

function Payoff({ stats, sal, reach }: { stats: QuizStats; sal: string; reach: number }) {
  const any = sal === "any";
  const label = sal === "60" ? "$60,000" : sal === "80" ? "$80,000" : sal === "100" ? "$100,000" : "$120,000";
  return (
    <>
      <h2>Thanks for being honest.</h2>
      <div className="quiz-panel">
        <p style={{ fontSize: 15, opacity: 0.85 }}>Right now on PublicJobs.ca</p>
        <div className="quiz-big" style={{ color: "#fff", margin: "6px 0" }}>
          {(any ? stats.withSalary : reach).toLocaleString("en-CA")}
        </div>
        <p style={{ fontSize: 18 }}>
          {any
            ? `open jobs post their salary. The median starting pay is ${fmt(stats.median)}.`
            : `open jobs post a pay range that reaches ${label} or more.`}
        </p>
      </div>
      <p className="quiz-lead">
        Plus {(stats.open - stats.withSalary).toLocaleString("en-CA")} jobs that don&apos;t post pay, which we keep in
        your results.
      </p>
      <p className="quiz-src">Source: PublicJobs.ca open jobs, {stats.asOf}.</p>
    </>
  );
}

function ResumeScreen({
  name,
  status,
  onFile,
}: {
  name: string;
  status: string;
  onFile: (file: File) => void;
}) {
  return (
    <>
      <h2>Last question! Want us to compare your resume too?</h2>
      <p className="quiz-lead">
        Optional. We read it once to find jobs that fit you, with a short reason for each. Your resume is not stored.
      </p>
      <label className={name ? "quiz-upload is-ready" : "quiz-upload"} htmlFor="quiz-file">
        <span style={{ fontSize: 26 }} aria-hidden="true">
          {name ? "✅" : "📄"}
        </span>
        <b>{name || "Choose your resume"}</b>
        <span className="quiz-small">{name ? "Ready. Tap to change." : "PDF or Word"}</span>
      </label>
      <input
        id="quiz-file"
        className="quiz-sr"
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      {status ? <p className="quiz-small">{status}</p> : null}
    </>
  );
}

function Loading({
  stats,
  lines,
  onCount,
}: {
  stats: QuizStats;
  lines: { strong: string; rest: string }[];
  onCount: number;
}) {
  const width = lines.length ? (onCount / lines.length) * 100 : 0;
  return (
    <>
      <h2>Searching {stats.open.toLocaleString("en-CA")} open jobs for you</h2>
      <div className="quiz-prog">
        <i style={{ width: `${width}%` }} />
      </div>
      <ul className="quiz-load">
        {lines.map((line, lineIndex) => (
          <li key={`${line.strong}-${line.rest}`} className={lineIndex < onCount ? "is-on" : ""}>
            <span className="quiz-d">✓</span>
            <span>
              {line.strong ? <b>{line.strong}</b> : null}
              {line.rest}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Reveal({ found, broadN, extra }: { found: QuizResults; broadN: number; extra: string }) {
  return (
    <>
      <h2>Your jobs are ready.</h2>
      <div className="quiz-callout">
        <div className="quiz-big">{broadN}+</div>
        <div>
          active public jobs for you: <b>{found.total} close matches</b> to your answers
          {extra ? `, plus ${extra}` : ""}.
        </div>
      </div>
    </>
  );
}

function JobCard({
  job,
  employer,
  today,
  newSince,
  locked,
  reason,
}: {
  job: QuizJob;
  employer: string;
  today: string;
  newSince: string;
  locked?: boolean;
  reason?: string;
}) {
  const left = daysLeft(job.cl, today);
  const close =
    left === null ? (
      <span className="quiz-tag">No closing date</span>
    ) : left <= 7 ? (
      <span className="quiz-tag is-soon">
        Closes in {left} day{left === 1 ? "" : "s"}
      </span>
    ) : (
      <span className="quiz-tag">
        Closes{" "}
        {new Date(`${job.cl.slice(0, 10)}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
      </span>
    );
  const fit = reason || job._why || "Strong fit";
  const pay =
    job.mn > 0
      ? `${job.mx && job.mx !== job.mn ? `${fmt(job.mn)} – ${fmt(job.mx)}` : fmt(job.mn)} a year${
          job.p === "hour" ? " (paid hourly)" : job.p === "week" ? " (paid weekly)" : ""
        }`
      : "Salary not posted";
  return (
    <article className={locked ? "quiz-job is-locked" : "quiz-job"}>
      {locked ? <span className="quiz-lock">🔒 Members</span> : null}
      <h3>{job.t}</h3>
      <div className="quiz-emp">{employer}</div>
      <div className="quiz-payline" style={job.mn ? undefined : { color: "var(--quiz-muted)", fontWeight: 500 }}>
        {pay}
      </div>
      <div className="quiz-meta">
        <span className={fit === "Strong fit" ? "quiz-tag is-fit" : "quiz-tag"}>{fit}</span>
        {job.mn ? <span className="quiz-tag is-pay">Posts salary</span> : null}
        {close}
        {job.po >= newSince ? <span className="quiz-tag">New this month</span> : null}
      </div>
      {locked ? null : (
        <a href={job.u} target="_blank" rel="noopener">
          View job and apply on the employer&apos;s site ↗
        </a>
      )}
    </article>
  );
}

function Matches({
  catalog,
  jobs,
  found,
  broadList,
  broad,
  resumeHits,
  resumeNote,
  today,
  newSince,
}: {
  catalog: QuizCatalog;
  jobs: QuizJob[];
  found: QuizResults;
  broadList: QuizJob[];
  broad: { n: number; fresh: number; closing: number };
  resumeHits: ResumeHit[];
  resumeNote: string;
  today: string;
  newSince: string;
}) {
  const top = broadList.slice(0, 5);
  return (
    <>
      <h2>
        {broad.n}+ active public jobs for you
      </h2>
      <div className="quiz-callout">
        <div className="quiz-row">
          <span className="quiz-n">{found.strong.length}</span>
          <span>strong fits for your type of work, area, pay and level</span>
        </div>
        <div className="quiz-row">
          <span className="quiz-n" style={{ background: "var(--quiz-brand)" }}>
            {broad.fresh}
          </span>
          <span>posted in the last 30 days</span>
        </div>
        <div className="quiz-row">
          <span className="quiz-n" style={{ background: "var(--quiz-warn)" }}>
            {broad.closing}
          </span>
          <span>close in the next 7 days</span>
        </div>
      </div>
      <p className="quiz-eyebrow">Your top 5 {found.total >= 5 ? "matches" : ""}</p>
      {resumeNote ? <p className="quiz-small">{resumeNote}</p> : null}
      <div className="quiz-jobs">
        {resumeHits.length
          ? resumeHits.map((hit) => {
              const job = jobs.find((item) => sameJob(hit.url, item.u));
              if (!job) {
                return (
                  <article className="quiz-job" key={hit.url}>
                    <h3>{hit.title}</h3>
                    <div className="quiz-emp">{hit.employer}</div>
                    {hit.reason ? <div className="quiz-meta"><span className="quiz-tag is-fit">{hit.reason}</span></div> : null}
                    <a href={hit.url} target="_blank" rel="noopener">
                      View job and apply on the employer&apos;s site ↗
                    </a>
                  </article>
                );
              }
              return (
                <JobCard
                  key={job.u}
                  job={{ ...job, _why: hit.reason || "Strong fit" }}
                  employer={catalog.emps[job.e] || hit.employer}
                  today={today}
                  newSince={newSince}
                  reason={hit.reason || "Strong fit"}
                />
              );
            })
          : top.map((job) => (
              <JobCard
                key={job.u}
                job={job}
                employer={catalog.emps[job.e] || ""}
                today={today}
                newSince={newSince}
              />
            ))}
      </div>
    </>
  );
}

function Why({ stats }: { stats: QuizStats }) {
  return <MembershipCompare employers={stats.employers} />;
}

function Plans({
  catalog,
  stats,
  broadList,
  broadN,
  fresh,
  today,
  newSince,
  email,
  signedIn,
  notice,
  provinces,
  utm,
  plan,
  onPlan,
}: {
  catalog: QuizCatalog;
  stats: QuizStats;
  broadList: QuizJob[];
  broadN: number;
  fresh: number;
  today: string;
  newSince: string;
  email: string;
  signedIn: boolean;
  notice: string;
  provinces: ProvinceOption[];
  utm: CheckoutUtm;
  plan: PlanId;
  onPlan: (plan: PlanId) => void;
}) {
  const locked = broadList.slice(5, 8);
  return (
    <>
      <h2>See all {broadN}+ jobs for you</h2>
      <p className="quiz-lead">
        You&apos;ve seen 5. Members get all of them, with filters, plus new ones that fit emailed every week. About{" "}
        {fresh} jobs like these were posted in the last 30 days.
      </p>
      <div className="quiz-jobs">
        {locked.map((job) => (
          <JobCard
            key={job.u}
            job={job}
            employer={catalog.emps[job.e] || ""}
            today={today}
            newSince={newSince}
            locked
          />
        ))}
        {broadN > 8 ? <div className="quiz-more">+ {broadN - 8} more for you</div> : null}
      </div>
      <h2 id="plans-h" className="quiz-eyebrow">
        Choose your plan
      </h2>
      {notice ? (
        <p className={notice.startsWith("This email already") ? "status" : "status err"} role="alert">
          {notice}{" "}
          {notice.startsWith("This email already") ? <a href="/login/?next=/account/">Sign in</a> : null}
        </p>
      ) : null}
      <div className="quiz-checkout">
        <CheckoutForm
          action={startGuestCheckout}
          provinces={provinces}
          initialPlan="quarter"
          planOrder={["month", "quarter", "year"]}
          collectEmail={!signedIn}
          defaultEmail={email}
          submitLabel="Continue to secure payment"
          billedFor={quizBilled}
          checkoutFrom="start"
          utm={utm}
          onPlanChange={onPlan}
        />
      </div>
      <p className="quiz-small">{refundSentence()}</p>
      <p className="quiz-small">Memberships are offered to people in {LEGAL.sellTo}.</p>
      <details>
        <summary>Will a membership get me a job?</summary>
        <p>
          No. A membership gets you the full list, filters, resume matches and weekly emails. It does not get you a job
          or an interview. Employers make every hiring decision.
        </p>
      </details>
      <details>
        <summary>Is this a government site?</summary>
        <p>
          No. PublicJobs.ca is an independent job board. It is not affiliated with any government or employer and is
          not a recruiter.
        </p>
      </details>
      <details>
        <summary>Why pay when employer sites are free?</summary>
        <p>
          They are, and Apply stays free on every job page here. You pay for not having to check {stats.employers}{" "}
          sites yourself, and for matches sent to you every week.
        </p>
      </details>
      <details>
        <summary>Before you subscribe</summary>
        <p className="quiz-disclosure">{disclosureText(plan)}</p>
      </details>
      <p className="quiz-fine">
        Independent job board. Not affiliated with any government or employer. A membership does not get you a job or
        an interview. Apply stays free on every job page.
      </p>
    </>
  );
}

function ChoiceScreen({
  title,
  hint,
  options,
  selected,
  multi,
  onChoose,
}: {
  title: string;
  hint?: string;
  options: { id: string; em?: string; t: string; d?: string; n: number | null }[];
  selected: string[];
  multi: boolean;
  onChoose: (value: string) => void;
}) {
  return (
    <>
      <h2>{title}</h2>
      {hint ? <p className="quiz-hint">{hint}</p> : null}
      <div className="quiz-opts" role="group">
        {options.map((option) => {
          const on = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className={multi ? "quiz-opt" : "quiz-opt is-radio"}
              aria-pressed={on}
              onClick={() => onChoose(option.id)}
            >
              {option.em ? (
                <span className="quiz-em" aria-hidden="true">
                  {option.em}
                </span>
              ) : null}
              <span className="quiz-opt-t">
                {option.t}
                {option.d ? (
                  <>
                    <br />
                    <span className="quiz-count" style={{ whiteSpace: "normal" }}>
                      {option.d}
                    </span>
                  </>
                ) : null}
              </span>
              {option.n != null ? <span className="quiz-count">{option.n} open</span> : null}
              <span className="quiz-box" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </>
  );
}

function Cta({
  screen,
  work,
  hard,
  level,
  long,
  sal,
  where,
  stats,
  workOnly,
  areaCount,
  resumeName,
  loadReady,
  onNext,
  onSkipWhere,
  onSkipResume,
}: {
  screen: ScreenId;
  work: string[];
  hard: string[];
  level: string[];
  long: string | null;
  sal: string | null;
  where: string[];
  stats: QuizStats;
  workOnly: number;
  areaCount: number;
  resumeName: string;
  loadReady: boolean;
  onNext: () => void;
  onSkipWhere: () => void;
  onSkipResume: () => void;
}) {
  if (screen === "start") return <button className="quiz-btn" type="button" onClick={onNext}>Find jobs that fit me</button>;
  if (screen === "work") {
    if (!work.length) return <button className="quiz-btn" type="button" disabled>Next</button>;
    return (
      <>
        <p className="quiz-fb">
          👍{" "}
          {work.includes("any")
            ? `Great. All ${stats.open} open jobs are in.`
            : `${workOnly} open jobs in these areas of work right now.`}
        </p>
        <button className="quiz-btn" type="button" onClick={onNext}>Next</button>
      </>
    );
  }
  if (screen === "long") {
    return <button className="quiz-btn" type="button" disabled={!long} onClick={onNext}>Next</button>;
  }
  if (screen === "hard") {
    return <button className="quiz-btn" type="button" disabled={!hard.length} onClick={onNext}>Next</button>;
  }
  if (screen === "level") {
    return <button className="quiz-btn" type="button" disabled={!level.length} onClick={onNext}>Next</button>;
  }
  if (screen === "salary") {
    return <button className="quiz-btn" type="button" onClick={onNext}>Next</button>;
  }
  if (screen === "where") {
    return (
      <>
        {where.length ? <p className="quiz-fb">📍 {areaCount} of your jobs are in the areas you picked.</p> : null}
        <button className="quiz-btn" type="button" disabled={!where.length} onClick={onNext}>Next</button>
        <button className="quiz-link" type="button" onClick={onSkipWhere}>Skip, any area is fine</button>
      </>
    );
  }
  if (screen === "resume") {
    if (resumeName) return <button className="quiz-btn" type="button" onClick={onNext}>Find my jobs</button>;
    return (
      <>
        <label className="quiz-btn" htmlFor="quiz-file">Upload my resume</label>
        <button className="quiz-link" type="button" onClick={onSkipResume}>Skip, I&apos;ll add it later</button>
      </>
    );
  }
  if (screen === "loading") {
    return <button className="quiz-btn" type="button" disabled={!loadReady} onClick={onNext}>Show my jobs</button>;
  }
  if (screen === "reveal") return <button className="quiz-btn" type="button" onClick={onNext}>See my jobs</button>;
  if (screen === "matches") return <button className="quiz-btn" type="button" onClick={onNext}>Continue</button>;
  if (screen === "why") {
    return (
      <>
        <button className="quiz-btn" type="button" onClick={onNext}>
          Makes sense
        </button>
        <p className="quiz-cmp-fine">
          Apply links always free · Cancel anytime · Full refund within {LEGAL.refundWindowDays} days · Prices plus HST
        </p>
      </>
    );
  }
  if (screen === "fix") return <button className="quiz-btn" type="button" onClick={onNext}>Show me jobs that fit</button>;
  return <button className="quiz-btn" type="button" onClick={onNext}>Next</button>;
}

function EmailAsk({
  titleId,
  eyebrow,
  heading,
  lead,
  button,
  email,
  error,
  pending,
  onSubmit,
}: {
  titleId: string;
  eyebrow: string;
  heading: string;
  lead?: string;
  button: string;
  email: string;
  error: string;
  pending: boolean;
  onSubmit: (email: string, agreed: boolean) => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit(String(data.get("email") || ""), data.get("casl_consent") === "yes");
      }}
    >
      <p className="quiz-eyebrow">{eyebrow}</p>
      <h2 id={titleId}>{heading}</h2>
      {lead ? <p className="quiz-lead">{lead}</p> : null}
      <div className="quiz-field">
        <label htmlFor={`${titleId}-email`}>Email</label>
        <input id={`${titleId}-email`} name="email" type="email" autoComplete="email" required defaultValue={email} placeholder="you@example.com" />
      </div>
      <label className="quiz-consent" htmlFor={`${titleId}-consent`}>
        <input id={`${titleId}-consent`} name="casl_consent" type="checkbox" value="yes" />
        <span>
          {alertConsentLabel()}
          <span className="quiz-small">{alertConsentSender()}</span>
        </span>
      </label>
      {error ? <p className="quiz-err">{error}</p> : null}
      <button className="quiz-btn" type="submit" disabled={pending}>{button}</button>
    </form>
  );
}
