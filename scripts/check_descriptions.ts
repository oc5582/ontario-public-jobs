// Flags broken description formatting and checks that formatting drops no words.
//
//   node --experimental-strip-types scripts/check_descriptions.ts
//
// "Before" is the previous pipeline: every newline became its own paragraph.
// "After" is web/lib/description.ts, the formatter job pages render.
// Text-loss compares letters and digits only, after decoding HTML entities,
// so rejoining a wrapped word or attaching a stray period is not a loss.

import { formatDescription, signature } from "../web/lib/description.ts";
import { readFileSync } from "fs";
import { resolve } from "path";

type Job = { title: string; employer: string; source: string; description: string };

const jobs = JSON.parse(readFileSync(resolve(process.cwd(), "data/listings.json"), "utf8")) as Job[];

function legacyParagraphs(raw: string): string[] {
  let text = (raw || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\u00a0/g, " ");
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n");
  const chunks = text.includes("\n\n") ? text.split(/\n{2,}/) : text.split(/\n+/);
  const paras: string[] = [];
  for (const chunk of chunks) {
    const line = chunk.replace(/[ \t]{2,}/g, " ").replace(/\n+/g, "\n").trim();
    if (!line || line === "•" || line === "-" || line === "*") continue;
    paras.push(line);
  }
  return paras;
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function oneWord(value: string): boolean {
  return wordCount(value) === 1 && /[0-9A-Za-zÀ-ÿ]/.test(value);
}

function lonePunct(value: string): boolean {
  const text = value.trim();
  return Boolean(text) && !/[0-9A-Za-zÀ-ÿ]/.test(text);
}

function htmlParts(html: string): { tag: string; text: string }[] {
  const out: { tag: string; text: string }[] = [];
  const re = /<(p|li|h3|dt|dd)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    out.push({
      tag: match[1],
      text: match[2].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
    });
  }
  return out;
}

type Row = {
  n: number;
  described: number;
  beforeOne: number;
  afterOne: number;
  beforeLone: number;
  afterLone: number;
  loss: number;
};

function blankRow(): Row {
  return { n: 0, described: 0, beforeOne: 0, afterOne: 0, beforeLone: 0, afterLone: 0, loss: 0 };
}

let beforeOne = 0;
let beforeLone = 0;
let afterOne = 0;
let afterLone = 0;
let loss = 0;
let described = 0;
const bySource = new Map<string, Row>();
const byEmployer = new Map<string, Row>();
const lossSamples: string[] = [];

for (const job of jobs) {
  const source = (job.source || "unknown").split(":")[0];
  const sourceRow = bySource.get(source) || blankRow();
  const employerRow = byEmployer.get(job.employer) || blankRow();
  sourceRow.n += 1;
  employerRow.n += 1;
  const raw = job.description || "";
  if (!raw.trim()) {
    bySource.set(source, sourceRow);
    byEmployer.set(job.employer, employerRow);
    continue;
  }
  described += 1;
  sourceRow.described += 1;
  employerRow.described += 1;
  const before = legacyParagraphs(raw);
  const b1 = before.filter(oneWord).length;
  const bl = before.filter(lonePunct).length;
  beforeOne += b1;
  beforeLone += bl;
  sourceRow.beforeOne += b1;
  sourceRow.beforeLone += bl;
  employerRow.beforeOne += b1;
  employerRow.beforeLone += bl;
  const html = formatDescription(raw);
  const visible = html.replace(/<[^>]+>/g, " ");
  if (signature(raw) !== signature(visible)) {
    loss += 1;
    sourceRow.loss += 1;
    employerRow.loss += 1;
    if (lossSamples.length < 10) lossSamples.push(`${job.employer} | ${job.title}`);
  }
  const parts = htmlParts(html);
  const a1 = parts.filter((part) => part.tag === "p" && oneWord(part.text)).length;
  const al = parts.filter((part) => part.tag === "p" && lonePunct(part.text)).length;
  afterOne += a1;
  afterLone += al;
  sourceRow.afterOne += a1;
  sourceRow.afterLone += al;
  employerRow.afterOne += a1;
  employerRow.afterLone += al;
  bySource.set(source, sourceRow);
  byEmployer.set(job.employer, employerRow);
}

console.log(`jobs ${jobs.length} with description ${described}`);
console.log(`BEFORE one-word paragraphs ${beforeOne} lone punctuation ${beforeLone}`);
console.log(`AFTER  one-word paragraphs ${afterOne} lone punctuation ${afterLone} text-loss jobs ${loss}`);
console.log("by source (one-word before->after, lone before->after, text-loss jobs)");
for (const [source, row] of [...bySource.entries()].sort((a, b) => b[1].n - a[1].n)) {
  console.log(
    `${source.padEnd(22)} n=${String(row.n).padStart(3)} described=${String(row.described).padStart(3)} one ${row.beforeOne}->${row.afterOne} lone ${row.beforeLone}->${row.afterLone} loss ${row.loss}`,
  );
}

const employers = [...byEmployer.entries()].sort((a, b) => b[1].n - a[1].n);
console.log("\nLargest employers, 3 described jobs each (Export Development Canada has none)");
let shown = 0;
for (const [name, row] of employers) {
  if (shown >= 12) break;
  shown += 1;
  const sample = jobs.filter((job) => job.employer === name && (job.description || "").trim()).slice(0, 3);
  console.log(`${shown}. ${name} (${row.n} jobs, ${row.described} with description, one ${row.beforeOne}->${row.afterOne}, loss ${row.loss})`);
  if (!sample.length) {
    console.log("   no descriptions in the feed");
    continue;
  }
  for (const job of sample) console.log(`   - ${job.title}`);
}

console.log("\nsmaller sources (everything after the 10 largest source feeds is included above; workable is empty)");
if (lossSamples.length) {
  console.log("text-loss samples:");
  for (const sample of lossSamples) console.log(`  ${sample}`);
}
if (loss !== 0) process.exitCode = 1;
