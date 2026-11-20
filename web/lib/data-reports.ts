import { existsSync, readFileSync } from "fs";
import path from "path";
import { GUIDES } from "./guides";

/** Shown once on each report. JSON-LD keeps the Creative Commons URL. */
export const DATA_LICENSE_NAME = "CC BY 4.0";
export const DATA_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

export type DataHighlight = { value: string; label: string };
export type DataFile = { href: string; label: string };

export type FaqEntry = { question: string; answer: string };

export type DataReport = {
  slug: string;
  title: string;
  description: string;
  /** First sentence, used on the hub and in llms.txt. */
  summary: string;
  /** YYYY-MM-DD. The snapshot date, also the sitemap lastmod. */
  published: string;
  /** Short date in the required source line. */
  sourceAsOf: string;
  citation: string;
  markdownPath: string;
  jsonPath: string;
  xlsxPath: string;
  csv: DataFile[];
  highlights: DataHighlight[];
  /** File name under content/data/. */
  datasetJsonLd: string;
  /** File name under content/data/. Missing until a report ships an FAQ file. */
  faqJsonLd: string;
};

export const DATA_HUB_PATH = "/data/";

export function dataReportPath(slug: string): string {
  return `/data/${slug}/`;
}

/**
 * Published snapshots, newest first.
 * To add a month: copy its files into public/data and content/data, then add an entry here.
 * The hub, the report page, the sitemap, and llms.txt all read this list.
 */
export const DATA_REPORTS: DataReport[] = [
  {
    slug: "ontario-public-jobs-november-2026",
    title: "Ontario Public-Sector Jobs Snapshot, November 2026",
    description:
      "Aggregate statistics on 3,497 open public-sector job postings from 155 employers tracked by PublicJobs.ca, mostly in the Greater Toronto Area, as of November 19, 2026: counts by sector, employer and region, posted-salary statistics (share with salary, median, share paying $100K+), employment type, work mode and closing dates.",
    summary:
      "Aggregate statistics on 3,497 open public-sector job postings from 155 employers tracked by PublicJobs.ca, mostly in the Greater Toronto Area, as of November 19, 2026.",
    published: "2026-11-19",
    sourceAsOf: "Nov 19, 2026",
    citation:
      "PublicJobs.ca. (2026). Ontario Public-Sector Jobs Snapshot, November 2026 (data as of November 19, 2026). https://publicjobs.ca/data/ontario-public-jobs-november-2026",
    markdownPath: "/data/ontario-public-jobs-november-2026.md",
    jsonPath: "/data/snapshot-2026-11.json",
    xlsxPath: "/data/ontario-public-jobs-snapshot-2026-11.xlsx",
    csv: [
      { href: "/data/csv/headline_metrics.csv", label: "Headline metrics" },
      { href: "/data/csv/sector_summary.csv", label: "Sector summary" },
      { href: "/data/csv/top_15_employers.csv", label: "Top 15 employers" },
      { href: "/data/csv/top_10_highest_paying_postings.csv", label: "Top 10 highest-paying postings" },
      { href: "/data/csv/salary_bands.csv", label: "Salary bands" },
      { href: "/data/csv/region.csv", label: "Region" },
      { href: "/data/csv/employment_type.csv", label: "Employment type" },
      { href: "/data/csv/work_mode.csv", label: "Work mode" },
      { href: "/data/csv/closing_dates.csv", label: "Closing dates" },
      { href: "/data/csv/employer_spotlights.csv", label: "Employer spotlights" },
      { href: "/data/csv/faq.csv", label: "Questions and answers" },
    ],
    highlights: [
      { value: "3,497", label: "Open public-sector jobs" },
      { value: "155", label: "Employers" },
      { value: "$90,750", label: "Median posted salary" },
      { value: "65.0%", label: "With a readable salary" },
      { value: "53.4%", label: "Range reaches $100,000+" },
      { value: "59.5%", label: "Openings at hospitals" },
    ],
    datasetJsonLd: "ontario-public-jobs-november-2026.dataset.jsonld",
    faqJsonLd: "ontario-public-jobs-november-2026.faq.jsonld",
  },
];

export function dataReportBySlug(slug: string): DataReport | undefined {
  return DATA_REPORTS.find((report) => report.slug === slug);
}

export function dataHubLastmod(): string {
  return DATA_REPORTS.reduce((latest, report) => (report.published > latest ? report.published : latest), "");
}

function contentFile(name: string): string {
  return path.join(process.cwd(), "content", "data", name);
}

function publicFile(urlPath: string): string {
  return path.join(process.cwd(), "public", urlPath.replace(/^\//, ""));
}

function readJson(filePath: string): unknown | null {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function readReportMarkdown(report: DataReport): string {
  return readFileSync(publicFile(report.markdownPath), "utf8");
}

export function readDatasetJsonLd(report: DataReport): unknown {
  const data = readJson(contentFile(report.datasetJsonLd));
  if (!data) throw new Error(`Missing dataset JSON-LD for ${report.slug}`);
  return data;
}

export function readFaqJsonLd(report: DataReport): unknown | null {
  return readJson(contentFile(report.faqJsonLd));
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join("\n\n");
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if ("text" in row) return textOf(row.text);
    if ("answer" in row) return textOf(row.answer);
    if ("acceptedAnswer" in row) return textOf(row.acceptedAnswer);
  }
  return "";
}

function field(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = textOf(row[key]);
    if (value) return value;
  }
  return "";
}

/** Reads a snapshot `faq` array. Returns nothing when the key is absent. */
export function faqFromSnapshot(data: unknown): FaqEntry[] {
  if (!data || typeof data !== "object" || !("faq" in data)) return [];
  const faq = (data as { faq?: unknown }).faq;
  if (!Array.isArray(faq)) return [];
  const items: FaqEntry[] = [];
  for (const entry of faq) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const question = field(row, ["question", "q", "name", "title"]);
    const answer = field(row, ["answer", "a", "text", "acceptedAnswer"]);
    if (question && answer) items.push({ question, answer });
  }
  return items;
}

export function reportFaq(report: DataReport): FaqEntry[] {
  const snapshot = readJson(publicFile(report.jsonPath));
  return faqFromSnapshot(snapshot);
}

/** Root-relative path for a PublicJobs.ca URL, or null when it points elsewhere. */
export function localPathFor(url: string): string | null {
  const cleaned = url.replace(/[.,;:]+$/, "");
  const match = cleaned.match(/^https?:\/\/(?:www\.)?publicjobs\.ca(\/[^?#]*)/i);
  const raw = match ? match[1] : cleaned.startsWith("/") ? cleaned : "";
  if (!raw) return null;
  if (/\.[a-z0-9]+$/i.test(raw)) return raw;
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/**
 * Guide paths named in FAQ answers that are not a published guide.
 * An empty list means every /guides/ link in the answers is a real slug.
 */
export function brokenGuideLinks(items: FaqEntry[]): string[] {
  const slugs = new Set(GUIDES.map((guide) => guide.slug));
  const broken: string[] = [];
  for (const item of items) {
    const urls = item.answer.match(/https?:\/\/[^\s)]+|\/guides\/[^\s)]+/g) || [];
    for (const url of urls) {
      const local = localPathFor(url);
      const guide = local?.match(/^\/guides\/([^/]+)\/$/);
      if (!guide) continue;
      const file = path.join(process.cwd(), "content", "guides", `${guide[1]}.html`);
      if (!slugs.has(guide[1]) || !existsSync(file)) broken.push(`/guides/${guide[1]}/`);
    }
  }
  return broken;
}
