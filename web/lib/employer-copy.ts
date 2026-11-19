import { englishList } from "./format";
import { annualAmount } from "./quiz-tag";
import { BRAND } from "./site";

export type PaySample = {
  posted: string;
  closing: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryUnit: string;
};

export type EmployerFaq = { question: string; answer: string };

export type EmployerProfile = {
  slug: string;
  /** Short name used in titles, questions, and "current X openings". */
  name: string;
  /** Words before "Jobs" in the title tag. */
  titleName: string;
  /** Natural subject: "the City of Toronto", "the TTC", "Metrolinx". */
  subject: string;
  /** Natural possessive: "the City of Toronto's", "the TTC's". */
  possessive: string;
  h1: string;
  /** First intro paragraph, fixed copy. */
  intro: string;
  /** Where the apply link goes, used in the intro and the apply answer. */
  portal: string;
  extraFaq?: EmployerFaq;
};

const PROFILES: Record<string, EmployerProfile> = {
  "city-of-toronto": {
    slug: "city-of-toronto",
    name: "City of Toronto",
    titleName: "City of Toronto",
    subject: "the City of Toronto",
    possessive: "the City of Toronto's",
    h1: "City of Toronto jobs",
    intro:
      "The City of Toronto is Canada's largest municipal employer. Its roles run from frontline public health, paramedic and recreation work to planning, IT and senior management across the City's divisions.",
    portal: "the City's own careers site (jobs.toronto.ca)",
    extraFaq: {
      question: "Does the City of Toronto hire paramedics and nurses?",
      answer:
        "Yes. Toronto Paramedic Services and Toronto Public Health are City divisions, and paramedic and public health nurse roles appear in the openings listed here when the City posts them.",
    },
  },
  "toronto-transit-commission": {
    slug: "toronto-transit-commission",
    name: "TTC",
    titleName: "TTC",
    subject: "the TTC",
    possessive: "the TTC's",
    h1: "TTC (Toronto Transit Commission) jobs",
    intro:
      "The TTC runs Toronto's subway, streetcar and bus network. Beyond operators, it hires skilled trades, track and maintenance crews, engineers, project and procurement staff, and enforcement officers.",
    portal: "the TTC's SAP SuccessFactors careers portal",
    extraFaq: {
      question: "Does the TTC hire for jobs other than drivers?",
      answer:
        "Yes. Most TTC postings listed here are for trades, maintenance, project, procurement, engineering and office roles, not only operators.",
    },
  },
  metrolinx: {
    slug: "metrolinx",
    name: "Metrolinx",
    titleName: "Metrolinx",
    subject: "Metrolinx",
    possessive: "Metrolinx's",
    h1: "Metrolinx and GO Transit jobs",
    intro:
      "Metrolinx is the Ontario agency behind GO Transit, UP Express and PRESTO, and it is building the region's new rapid transit lines. That makes it one of the GTA's busiest public-sector hirers, with rail operations, maintenance trades, engineering, project delivery and corporate roles.",
    portal: "Metrolinx's Oracle careers portal",
    extraFaq: {
      question: "Are Metrolinx and GO Transit the same employer?",
      answer:
        "Yes. GO Transit, UP Express and PRESTO are run by Metrolinx, so their jobs are posted as Metrolinx jobs.",
    },
  },
  "toronto-hydro-corporation": {
    slug: "toronto-hydro-corporation",
    name: "Toronto Hydro",
    titleName: "Toronto Hydro",
    subject: "Toronto Hydro",
    possessive: "Toronto Hydro's",
    h1: "Toronto Hydro jobs",
    intro:
      "Toronto Hydro owns and runs the electricity distribution grid for the City of Toronto. It hires engineers, certified powerline technicians, grid operations staff, and communications, HR and customer-energy specialists.",
    portal: "Toronto Hydro's careers site (jobs.torontohydro.com)",
    extraFaq: {
      question: "Is Toronto Hydro a government job?",
      answer:
        "Toronto Hydro is owned by the City of Toronto, so it is a public-sector employer, but it runs as a corporation with its own hiring and pay.",
    },
  },
  "ontario-public-service": {
    slug: "ontario-public-service",
    name: "Ontario Public Service",
    titleName: "Ontario Government (OPS)",
    subject: "the Ontario Public Service",
    possessive: "the Ontario Public Service's",
    h1: "Ontario Public Service jobs",
    intro:
      "The Ontario Public Service (OPS) is the provincial government's own workforce: the ministries, courts administration, inspectors and program staff who run Ontario's services. Many OPS jobs are based in Toronto, with others across the GTA and the province.",
    portal: "Ontario Public Service Careers (gojobs.gov.on.ca)",
    extraFaq: {
      question: "Are Ontario government jobs often temporary?",
      answer:
        "Many are. A large share of the OPS postings listed here are temporary or contract roles, so check each posting's term before applying.",
    },
  },
  "city-of-mississauga": {
    slug: "city-of-mississauga",
    name: "City of Mississauga",
    titleName: "City of Mississauga",
    subject: "the City of Mississauga",
    possessive: "the City of Mississauga's",
    h1: "City of Mississauga jobs",
    intro:
      "The City of Mississauga hires across recreation and culture, transit, parks and forestry, facilities, IT and finance, with a steady mix of full-time and part-time roles.",
    portal: "the City's careers site (jobs.mississauga.ca)",
  },
  "city-of-markham": {
    slug: "city-of-markham",
    name: "City of Markham",
    titleName: "City of Markham",
    subject: "the City of Markham",
    possessive: "the City of Markham's",
    h1: "City of Markham jobs",
    intro:
      "The City of Markham hires for recreation, community centres, the Flato Markham Theatre, waterworks, animal services and senior management. Many of its postings are part-time or seasonal, which makes it a common first public-sector job.",
    portal: "the employer's ADP Workforce Now careers portal",
    extraFaq: {
      question: "Does the City of Markham have part-time jobs?",
      answer:
        "Yes. A large share of Markham's postings are part-time or temporary roles in recreation, aquatics, camps and community programs.",
    },
  },
  "city-of-burlington": {
    slug: "city-of-burlington",
    name: "City of Burlington",
    titleName: "City of Burlington",
    subject: "the City of Burlington",
    possessive: "the City of Burlington's",
    h1: "City of Burlington jobs",
    intro:
      "The City of Burlington hires for roads and operations, Burlington Transit, recreation and facilities, planning, legal, IT and finance, with both full-time and part-time positions.",
    portal: "the City's Workday careers portal",
  },
  "town-of-whitby": {
    slug: "town-of-whitby",
    name: "Town of Whitby",
    titleName: "Town of Whitby",
    subject: "the Town of Whitby",
    possessive: "the Town of Whitby's",
    h1: "Town of Whitby jobs",
    intro:
      "The Town of Whitby in Durham Region hires for arenas and recreation, operations, crossing guards, administration and corporate services. It posts fewer jobs than the large cities, so openings can go quickly.",
    portal: "the Town's Workday careers portal",
  },
  "town-of-aurora": {
    slug: "town-of-aurora",
    name: "Town of Aurora",
    titleName: "Town of Aurora",
    subject: "the Town of Aurora",
    possessive: "the Town of Aurora's",
    h1: "Town of Aurora jobs",
    intro:
      "The Town of Aurora in York Region hires for roads and operations, facility maintenance, fitness and recreation programs, and town administration. It is a smaller employer with a handful of openings at a time.",
    portal: "the employer's ADP Workforce Now careers portal",
  },
};

export function employerProfile(slug: string): EmployerProfile | null {
  return PROFILES[slug] ?? null;
}

export function wordCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function countLabel(count: number): string {
  return count.toLocaleString("en-CA");
}

function dayWord(days: number): string {
  return days === 1 ? "day" : "days";
}

function formatPay(value: number): string {
  return `$${Math.round(value).toLocaleString("en-CA")}`;
}

function roundToThousand(value: number): number {
  return Math.round(value / 1000) * 1000;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function annualBound(value: number | null, unit: string): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const annual = annualAmount(value, unit);
  return annual > 0 ? annual : null;
}

export type PayLine = { sentence: string; low: string; high: string; median: string };

/**
 * Range and median of posted pay. Hourly (and other periodic) rates are
 * annualized. Figures are rounded to the nearest $1,000. Null when fewer
 * than 3 jobs have a pay figure.
 */
export function payLine(rows: PaySample[], name: string): PayLine | null {
  const jobs: { low: number; high: number; typical: number }[] = [];
  for (const row of rows) {
    const low = annualBound(row.salaryMin, row.salaryUnit);
    const high = annualBound(row.salaryMax, row.salaryUnit);
    const floor = low ?? high;
    const ceiling = high ?? low;
    if (floor == null || ceiling == null) continue;
    const lo = Math.min(floor, ceiling);
    const hi = Math.max(floor, ceiling);
    jobs.push({ low: lo, high: hi, typical: (lo + hi) / 2 });
  }
  if (jobs.length < 3) return null;
  const low = roundToThousand(Math.min(...jobs.map((job) => job.low)));
  const high = roundToThousand(Math.max(...jobs.map((job) => job.high)));
  const mid = roundToThousand(median(jobs.map((job) => job.typical)));
  const lowText = formatPay(low);
  const highText = formatPay(high);
  const midText = formatPay(mid);
  const sentence =
    low === high
      ? `Posted pay for current ${name} openings is about ${lowText} a year, with a typical posting around ${midText}.`
      : `Posted pay for current ${name} openings runs from about ${lowText} to ${highText} a year, with a typical posting around ${midText}.`;
  return { sentence, low: lowText, high: highText, median: midText };
}

/** Median days from posted date to closing date. Null when fewer than 3 jobs have both. */
export function medianDaysOpen(rows: PaySample[]): number | null {
  const days: number[] = [];
  for (const row of rows) {
    const posted = (row.posted || "").slice(0, 10);
    const closing = (row.closing || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(posted) || !/^\d{4}-\d{2}-\d{2}$/.test(closing)) continue;
    const span = Math.round(
      (Date.parse(`${closing}T00:00:00Z`) - Date.parse(`${posted}T00:00:00Z`)) / 86400000,
    );
    if (!Number.isFinite(span) || span < 0) continue;
    days.push(span);
  }
  if (days.length < 3) return null;
  return Math.round(median(days));
}

function daysSentence(days: number): string {
  return `Postings here stay open for a median of ${days} ${dayWord(days)}, so check often or turn on the free job alert email.`;
}

function applyParagraph(profile: EmployerProfile): string {
  return `To apply, open a posting on this page and follow its apply link to the original listing on ${profile.portal}. That page is the employer's own advertisement. The closing date, the pay, and the full description there are the ones to use, and it is worth reading them before you apply. Applying is free. The application goes to the employer, not to PublicJobs.ca. PublicJobs.ca is not part of ${profile.subject}. It is independent and is not affiliated with ${profile.subject} or any government.`;
}

export type EmployerSeo = {
  title: string;
  description: string;
  h1: string;
  paragraphs: string[];
  faqs: EmployerFaq[];
};

export function buildEmployerSeo(
  profile: EmployerProfile,
  count: number,
  recentTitles: string[],
  pay: PaySample[],
): EmployerSeo {
  const shown = countLabel(count);
  const titles = recentTitles.map((title) => title.trim()).filter(Boolean).slice(0, 3);
  const recent = titles.length ? ` Recent postings include ${englishList(titles)}.` : "";
  const opening = count === 1 ? "there is 1 opening" : `there are ${shown} openings`;
  const check = `PublicJobs.ca checks ${profile.possessive} careers site every weekday and lists the open postings here with their pay, location and closing date. Right now ${opening}.${recent}`;
  const payInfo = payLine(pay, profile.name);
  const days = medianDaysOpen(pay);
  const facts = [payInfo?.sentence, days == null ? "" : daysSentence(days)].filter(Boolean).join(" ");
  const paragraphs = [profile.intro, check, ...(facts ? [facts] : []), applyParagraph(profile)];
  const jobWord = count === 1 ? "job" : "jobs";
  const openNow =
    count === 1
      ? `There is 1 ${profile.name} job open right now.`
      : `There are ${shown} ${profile.name} ${jobWord} open right now.`;
  const faqs: EmployerFaq[] = [
    {
      question: `How many ${profile.name} jobs are open right now?`,
      answer: `${openNow} PublicJobs.ca refreshes this list every weekday and removes closed postings.`,
    },
  ];
  if (payInfo) {
    faqs.push({
      question: `How much do ${profile.name} jobs pay?`,
      answer: `${payInfo.sentence} Each listing shows the exact rate from the original posting.`,
    });
  }
  if (days != null) {
    faqs.push({
      question: `How long do ${profile.name} job postings stay open?`,
      answer: `${profile.name} job postings stay open for a median of ${days} ${dayWord(days)}, counted from the posted date to the closing date.`,
    });
  }
  faqs.push(
    {
      question: `How do I apply for a ${profile.name} job?`,
      answer: `Follow the apply link on a posting to the original posting on ${profile.portal}. Applying is free.`,
    },
    {
      question: `Is PublicJobs.ca part of ${profile.subject}?`,
      answer: `No. PublicJobs.ca is independent and is not affiliated with ${profile.subject} or any government.`,
    },
  );
  if (profile.extraFaq) faqs.push(profile.extraFaq);
  return {
    title: `${profile.titleName} Jobs – ${shown} Open Now | ${BRAND}`,
    description: `See all ${shown} current ${profile.name} ${count === 1 ? "job opening" : "job openings"} in one list, updated every weekday, with pay, closing dates and a direct link to apply.`,
    h1: profile.h1,
    paragraphs,
    faqs,
  };
}
