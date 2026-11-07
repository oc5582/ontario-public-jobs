import { LEGAL } from "./legal-config";
import { BRAND, FREE_LIST_LIMIT, PLANS, SITE_URL, type PlanId } from "./site";
import { formatCount } from "./stats";

export const LEGIT_PATH = "/is-publicjobs-ca-legit/";
export const LEGIT_TITLE = "Is PublicJobs.ca Legit?";
export const LEGIT_H1 = "Is PublicJobs.ca legit?";
export const LEGIT_DESCRIPTION =
  "Wondering if PublicJobs.ca is legit? The founder explains who runs it, where the jobs come from, what is free, what a membership costs, and how refunds work.";
/** Visible byline date. JSON-LD uses LEGIT_PUBLISHED. */
export const LEGIT_UPDATED_LABEL = "7 November 2026";
export const LEGIT_PUBLISHED = "2026-11-07";

export type InlinePart = string | { text: string; href: string };

export type LegitQuote = { text: string; cite: string };

export type LegitSection = {
  id: string;
  heading: string;
  before: InlinePart[][];
  list?: string[];
  after?: InlinePart[][];
  quotes?: LegitQuote[];
  note?: string;
  /** Question-shaped sections also go in FAQPage JSON-LD. */
  faq: boolean;
};

function plan(id: PlanId) {
  const found = PLANS.find((item) => item.id === id);
  if (!found) throw new Error(`Missing plan ${id}`);
  return found;
}

function cad(amount: number): string {
  return `CA$${amount.toFixed(2)}`;
}

function perMonthCad(perMonth: string): string {
  if (perMonth.startsWith("CA$")) return perMonth;
  if (perMonth.startsWith("$")) return `CA${perMonth}`;
  throw new Error(`Unexpected per-month price ${perMonth}`);
}

/** Membership prices for this page, taken from the live plan table. */
export function legitPriceLines(): { month: string; quarter: string; year: string } {
  const month = plan("month");
  const quarter = plan("quarter");
  const year = plan("year");
  return {
    month: `${cad(month.amount)} every month`,
    quarter: `${cad(quarter.amount)} every 3 months (${perMonthCad(quarter.perMonth)} a month)`,
    year: `${cad(year.amount)} every year (about ${perMonthCad(year.perMonth)} a month)`,
  };
}

/**
 * Scale sentence for the short answer.
 * A missing count stays qualitative. A live count is never replaced with a stale hardcoded total.
 */
export function openingCountSentence(input: { openJobs: number; employerCount: number } | null): string {
  const fallback = "It lists hundreds of current openings from public employers in Toronto and the GTA.";
  if (!input) return fallback;
  const { openJobs, employerCount } = input;
  if (!Number.isInteger(openJobs) || openJobs < 1 || !Number.isInteger(employerCount) || employerCount < 1) {
    return fallback;
  }
  const jobs = formatCount(openJobs);
  const employers = formatCount(employerCount);
  const jobWord = openJobs === 1 ? "opening" : "openings";
  const employerWord = employerCount === 1 ? "public employer" : "public employers";
  if (openJobs >= 200) {
    return `${fallback} The latest weekday refresh shows ${jobs} current ${jobWord} from ${employers} ${employerWord}.`;
  }
  return `It lists ${jobs} current ${jobWord} from ${employers} ${employerWord} in Toronto and the GTA.`;
}

function inlineText(parts: InlinePart[]): string {
  return parts.map((part) => (typeof part === "string" ? part : part.text)).join("");
}

export function sectionText(section: LegitSection): string {
  const chunks = [
    ...section.before.map(inlineText),
    ...(section.list ?? []),
    ...(section.quotes ?? []).map((quote) => `${quote.text} ${quote.cite}`),
    ...(section.note ? [section.note] : []),
    ...(section.after ?? []).map(inlineText),
  ];
  return chunks.join(" ");
}

export function legitSections(): LegitSection[] {
  const prices = legitPriceLines();
  const email: InlinePart = { text: LEGAL.supportEmail, href: `mailto:${LEGAL.supportEmail}` };
  return [
    {
      id: "honest",
      heading: "An honest answer from the founder",
      faq: false,
      before: [
        [
          "If you found this page, you probably searched “is PublicJobs.ca legit” before paying for a membership. That is a smart thing to do before you give any job site your card.",
        ],
        [
          "There are a lot of sketchy job sites online. Some hide who runs them, some charge you and then show listings you could have found yourself, and some pretend to be something they are not.",
        ],
        [
          "I’m Osama Chaudhary. I run PublicJobs.ca independently as a sole proprietorship in Ontario. I’d rather you hear how this site works from me than from a random review page.",
        ],
        [
          "Here is the straightforward version: what this site is, who is behind it, where the jobs come from, what is free, what a membership costs, and how to get a refund if it isn’t for you.",
        ],
      ],
    },
    {
      id: "short-answer",
      heading: "The short answer",
      faq: false,
      before: [
        ["Yes. PublicJobs.ca is a real, independently run job board for public-sector jobs in Toronto and the GTA."],
        [
          "It is not a government website, and it is not affiliated with, endorsed by, or acting for any government or any employer listed here.",
        ],
        [
          "It collects current openings from public employers’ own career pages and puts them in one place, so you don’t have to check dozens of sites. You can read a job here, then you apply on the employer’s own posting. I don’t take applications, I don’t contact employers for you, and employers don’t pay me to list jobs.",
        ],
      ],
    },
    {
      id: "who",
      heading: "Who is behind PublicJobs.ca?",
      faq: true,
      before: [
        [
          "I am. My name is ",
          LEGAL.legalName,
          ", and I operate PublicJobs.ca as a registered Canadian sole proprietorship. The business GST/HST number is ",
          LEGAL.hstNumber,
          ", which is also listed on the ",
          { text: "about", href: "/about/" },
          ", ",
          { text: "FAQ", href: "/faq/" },
          ", and ",
          { text: "terms", href: "/terms/" },
          " pages.",
        ],
        ["If something goes wrong with an account or a payment, email ", email, ". That’s me."],
        [
          "I’m putting my name on this page because “who runs this?” is a fair test for any job board, especially one that lists government and Crown corporation jobs. There is no anonymous company behind PublicJobs.ca, and this is not a government service.",
        ],
      ],
    },
    {
      id: "sources",
      heading: "Where do the jobs come from?",
      faq: true,
      before: [
        [
          "Listings are read from employers’ public career pages. I don’t wait for employers to pay to post here, and I don’t accept listings from anyone else.",
        ],
        [
          "When you choose “Apply on employer site,” you leave PublicJobs.ca and go to the employer’s own posting. Always confirm the details there, including whether the job is still open and what it pays.",
        ],
        [
          "That is also why the site exists: public employers in the GTA post on many different career sites, and checking them one by one is how people miss a closing date.",
        ],
      ],
    },
    {
      id: "closed",
      heading: "“But I opened a job and it was already closed”",
      faq: true,
      before: [
        ["That can happen, and I don’t want to pretend otherwise."],
        [
          "Employers change and take down postings on their own schedule. PublicJobs.ca refreshes listings every weekday, but a role can close after it was last fetched and before you click through. The ",
          { text: "terms", href: "/terms/" },
          " say the same thing: listings may be out of date, and you should always check the employer’s site.",
        ],
        [
          "If a listing looks wrong or suspicious, report it from the job page or email ",
          email,
          ". The ",
          { text: "fraudulent job postings policy", href: "/fraud-policy/" },
          " explains what happens next. Real public-sector employers will not charge you to apply.",
        ],
      ],
    },
    {
      id: "membership",
      heading: "Why is there a paid membership?",
      faq: true,
      before: [
        [
          "Most of the site is free. Every job page is free. Applying is free. The weekly email of new openings is free. You can also run one resume match for free, with no account.",
        ],
        [
          "A membership is for convenience: the full list with filters (without one, lists show the newest ",
          String(FREE_LIST_LIMIT),
          "), up to 20 resume matches a day, a weekly email of new openings that look like a fit, and a list of jobs you’ve marked as applied.",
        ],
        [
          "I don’t charge employers to appear here, so the membership is what pays for keeping the board updated. It will not get you a job or an interview. No job board can honestly promise that.",
        ],
        [
          "If you’re only browsing a few postings, you may not need a membership. If you’re actively searching and tired of checking dozens of career sites, that’s who it’s for.",
        ],
      ],
    },
    {
      id: "price",
      heading: "How much does a membership cost?",
      faq: true,
      before: [
        [
          "Prices are in Canadian dollars, plus GST/HST. You see the total with tax before you pay. Memberships are sold to people in Canada only.",
        ],
      ],
      list: [`Monthly: ${prices.month}`, `3 months: ${prices.quarter}`, `Year: ${prices.year}`],
      after: [
        [
          "Plans renew automatically until you cancel. There is no free trial that later turns into a charge. See current options on the ",
          { text: "pricing page", href: "/pricing/" },
          ".",
        ],
        [
          "If it isn’t for you, email ",
          email,
          " from your account email within ",
          String(LEGAL.refundWindowDays),
          " days of a purchase or a renewal and you’ll get a full refund, including tax. That is limited to one such refund per account in any 12-month period.",
        ],
      ],
    },
    {
      id: "cancel",
      heading: "How do I cancel?",
      faq: true,
      before: [
        [
          "You can cancel yourself on your ",
          { text: "Account page", href: "/account/" },
          " (Manage billing). You can also email ",
          email,
          ". After you cancel, you keep access until the end of the period you already paid for, and you are not charged again.",
        ],
      ],
    },
    {
      id: "feedback",
      heading: "What do people say?",
      faq: true,
      before: [
        [
          "The site is still early, so I’m not going to invent a wall of reviews. On the ",
          { text: "pricing page", href: "/pricing/" },
          " I share feedback from early users, with names changed:",
        ],
      ],
      quotes: [
        {
          text: "I like that new jobs show up every day. The list always feels current.",
          cite: "— Daniel M., early user",
        },
        {
          text: "I was impressed by the resume match. The jobs it suggested actually fit my background.",
          cite: "— Amira K., early user",
        },
      ],
      note: "Names changed for privacy. Feedback shortened.",
      after: [["If a membership isn’t useful, the ", String(LEGAL.refundWindowDays), "-day refund is there for that reason."]],
    },
    {
      id: "bottom",
      heading: "The bottom line",
      faq: false,
      before: [
        [
          "PublicJobs.ca is a legitimate, independently run job board. I put public-sector openings from Toronto and the GTA in one list, refreshed on weekdays, and I send you to the employer’s own site to apply.",
        ],
        [
          "It is not a government website. It will not apply for you or guarantee an offer. A posting can close before you click it. The pages you need in order to apply are free.",
        ],
        [
          "If that trade sounds fair, ",
          { text: "browse the current openings", href: "/jobs/" },
          " or look at ",
          { text: "membership options", href: "/pricing/" },
          ". If you still have questions, write to me at ",
          email,
          ", or read the ",
          { text: "privacy policy", href: "/privacy/" },
          ".",
        ],
      ],
    },
  ];
}

export function legitCanonical(): string {
  return `${SITE_URL}${LEGIT_PATH}`;
}

export function legitJsonLd(): unknown {
  const url = legitCanonical();
  const personId = `${url}#osama-chaudhary`;
  const orgId = `${SITE_URL}/#organization`;
  const person = {
    "@type": "Person",
    "@id": personId,
    name: LEGAL.legalName,
    url: `${SITE_URL}/about/`,
    jobTitle: "Founder, PublicJobs.ca",
  };
  const faqs = legitSections().filter((section) => section.faq);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: BRAND,
        url: `${SITE_URL}/`,
        email: LEGAL.supportEmail,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icon-512.png`,
        },
        founder: { "@id": personId },
      },
      person,
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: LEGIT_TITLE,
        description: LEGIT_DESCRIPTION,
        url,
        mainEntityOfPage: url,
        datePublished: LEGIT_PUBLISHED,
        dateModified: LEGIT_PUBLISHED,
        inLanguage: "en-CA",
        image: `${SITE_URL}/og-image.png`,
        author: { "@id": personId },
        publisher: { "@id": orgId },
      },
      {
        "@type": "FAQPage",
        url,
        mainEntity: faqs.map((section) => ({
          "@type": "Question",
          name: section.heading,
          acceptedAnswer: { "@type": "Answer", text: sectionText(section) },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "All openings", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: LEGIT_H1, item: url },
        ],
      },
    ],
  };
}
