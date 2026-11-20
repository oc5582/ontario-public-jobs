import { DATA_HUB_PATH, DATA_REPORTS, dataReportPath } from "./data-reports";
import { strengthenedEmployers } from "./employer-copy";
import { GUIDES, guidePath } from "./guides";
import { LEGIT_PATH } from "./legit";
import { LEGAL } from "./legal-config";
import { FREE_RESULTS, MEMBER_DAILY_LIMIT } from "./match";
import { FREE_LIST_LIMIT, SITE_URL, planPriceLine } from "./site";

export type LlmsFacts = {
  /** Sentence from listingFacts(). Live fetch window, or the no-fetch fallback. */
  fetched: string;
};

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  return match ? match[0] : trimmed;
}

function link(title: string, url: string, note: string): string {
  return `- [${title}](${url}): ${note}`;
}

/**
 * llmstxt.org document for /llms.txt.
 * Counts of open jobs are omitted. The fetch sentence is the only live clause.
 * No mailing address and no phone.
 */
export function renderLlmsTxt(facts: LlmsFacts): string {
  const prices = `${planPriceLine("month")}, ${planPriceLine("quarter")}, or ${planPriceLine("year")}`;
  const employers = strengthenedEmployers().map((profile) =>
    link(profile.h1, `${SITE_URL}/employers/${profile.slug}/`, firstSentence(profile.intro)),
  );
  const guides = GUIDES.map((guide) =>
    link(guide.title, `${SITE_URL}${guidePath(guide.slug)}`, guide.description),
  );
  const lines = [
    "# PublicJobs.ca",
    "",
    "> Independent job board for government and public-sector jobs in Ontario and the GTA. Not affiliated with any government.",
    "",
    "PublicJobs.ca lists current openings for job seekers in Ontario and the GTA who are looking for government and public-sector work. The board includes provincial jobs from Ontario Public Service Careers (gojobs.gov.on.ca), federal jobs from GC Jobs, and jobs at municipalities, agencies, and Crown corporations. Listings are gathered from those employers' own career sites. The site does not take applications. Each job page links to the employer's posting, and you apply there. It is not affiliated with any government or listed employer. Listings are refreshed every weekday. " +
      `${facts.fetched} Contact: ${LEGAL.supportEmail}.`,
    "",
    `Job pages are free and need no account. Lists on the homepage, /jobs/, and employer pages show the newest ${FREE_LIST_LIMIT} openings to visitors who are not members, plus the total. A posting whose closing date has passed stays on its own page, marked no longer available, and is left off those lists.`,
    "",
    "## Main pages",
    "",
    link(
      "Home",
      `${SITE_URL}/`,
      `Newest openings, with search by job title and employer. Visitors see the newest ${FREE_LIST_LIMIT}. Members see the filtered list.`,
    ),
    link(
      "Employers",
      `${SITE_URL}/employers/`,
      "Public employers in Toronto and the GTA, each with a page of its current openings. You apply on the employer's own website.",
    ),
    link(
      "Guides",
      `${SITE_URL}/guides/`,
      "Plain guides to applying for public-sector jobs in Toronto and the GTA, with sources and the date the facts were checked.",
    ),
    link(
      "Membership",
      `${SITE_URL}/pricing/`,
      `${prices}, plus applicable GST/HST. Sold in Canada only. A full refund is available within ${LEGAL.refundWindowDays} days of the first purchase and of each renewal, once per account in any 12 months.`,
    ),
    link(
      "Is PublicJobs.ca legit?",
      `${SITE_URL}${LEGIT_PATH}`,
      "Who runs the site, where the jobs come from, what is free, what a membership costs, and how refunds work.",
    ),
    link(
      "FAQ",
      `${SITE_URL}/faq/`,
      "Answers about the site, levels of government, Crown corporations, agencies, and working in the public sector.",
    ),
    link(
      "Job alerts",
      `${SITE_URL}/#signup-heading`,
      "Free weekly email of new openings. The signup form is on the homepage. Unsubscribe anytime.",
    ),
    link(
      "Find public jobs that fit you",
      `${SITE_URL}/start/`,
      "A short quiz that matches you with current public-sector jobs in Toronto and the GTA. Applying stays free.",
    ),
    link(
      "All openings",
      `${SITE_URL}/jobs/`,
      `Current openings. Visitors see the newest ${FREE_LIST_LIMIT}. Members see the full filtered list.`,
    ),
    link(
      "Match your resume",
      `${SITE_URL}/match/`,
      `Compare a resume with current openings. The resume on that page is not stored. One match is free with an email address and shows the top ${FREE_RESULTS} jobs. A membership includes up to ${MEMBER_DAILY_LIMIT} matches a day, and a member can save one resume on the account for an optional Saturday email.`,
    ),
    link(
      "Job stats",
      `${SITE_URL}/stats/`,
      `Counts of open public-sector jobs in the GTA by employer, city, and salary band. No job titles. The same counts are at ${SITE_URL}/stats.json and ${SITE_URL}/stats.csv (CC BY 4.0).`,
    ),
    link(
      "About",
      `${SITE_URL}/about/`,
      "Who runs the site, what it covers, how listings are collected, and how often they are updated.",
    ),
    "",
    "## Top employers",
    "",
    "Employer pages with a fuller introduction. Each page lists that employer's current openings and links to the employer's own posting.",
    "",
    ...employers,
    "",
    "## Guides",
    "",
    ...guides,
    "",
    "## Data",
    "",
    "Published snapshots of open public-sector jobs. Free to reuse under CC BY 4.0 with attribution to PublicJobs.ca.",
    "",
    ...DATA_REPORTS.map(
      (report) =>
        `- [${report.title}](${SITE_URL}${dataReportPath(report.slug)}): ${report.summary} [Markdown](${SITE_URL}${report.markdownPath}). [JSON](${SITE_URL}${report.jsonPath}).`,
    ),
    link(
      "Data",
      `${SITE_URL}${DATA_HUB_PATH}`,
      "Index of published snapshots and downloadable files.",
    ),
    "",
    "## Optional",
    "",
    link(
      "Sitemap",
      `${SITE_URL}/sitemap.xml`,
      "Published URLs: open job pages, employer pages, guides, and the static pages. Filtered list URLs are not included.",
    ),
    link(
      "Privacy",
      `${SITE_URL}/privacy/`,
      "What personal information the site collects and how email alerts and accounts work.",
    ),
    link("Terms", `${SITE_URL}/terms/`, "Terms of use, including membership, cancellation, and refunds."),
    "",
  ];
  return lines.join("\n");
}
