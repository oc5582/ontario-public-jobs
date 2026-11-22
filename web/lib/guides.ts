import { readContent } from "./content";
import { LEGAL } from "./legal-config";
import { BRAND, SITE_URL } from "./site";

export const GUIDES_NAME = "Guides to GTA public-sector jobs";

export type Guide = {
  slug: string;
  title: string;
  /** Title tag, 60 characters or fewer. The H1 uses title. */
  seoTitle: string;
  description: string;
  /** YYYY-MM-DD, America/Toronto */
  published: string;
  /** YYYY-MM-DD. Change only when facts or advice change, not to look fresh. */
  updated: string;
};

/** Newest first. Each body lives in content/guides/{slug}.html, without the H1. */
export const GUIDES: Guide[] = [
  {
    slug: "how-federal-government-hiring-works-gta",
    title: "How Federal Government Hiring Works in the GTA: GC Jobs, Pools and Language Tests",
    seoTitle: "How Federal Hiring Works in the GTA: GC Jobs and Pools",
    description:
      "How federal government hiring works in the GTA: applying on GC Jobs, screening questions, pools and inventories, language levels, security checks and timing.",
    published: "2026-11-22",
    updated: "2026-11-22",
  },
  {
    slug: "how-to-get-a-government-job-in-toronto",
    title: "How to Get a Government Job in Toronto: A Step-by-Step Guide",
    seoTitle: "How to Get a Government Job in Toronto: Step-by-Step Guide",
    description:
      "How to get a government job in Toronto: the federal, Ontario and City of Toronto employers, the organizations they own, where to find jobs and how hiring works.",
    published: "2026-11-18",
    updated: "2026-11-18",
  },
  {
    slug: "emergency-management-jobs-gta-public-sector",
    title: "Emergency Management Jobs in the GTA Public Sector: Roles, Pay and Training",
    seoTitle: "Emergency Management Jobs in the GTA: Roles, Pay, Training",
    description:
      "Who hires emergency managers in the GTA public sector, what the jobs involve, what November 2026 postings paid, and the free training Ontario offers.",
    published: "2026-11-18",
    updated: "2026-11-18",
  },
  {
    slug: "how-the-ontario-public-service-hires",
    title: "How the Ontario Public Service Hires: Job Ads, Interviews and Security Checks",
    seoTitle: "How the Ontario Public Service Hires: Steps and Checks",
    description:
      "How Ontario Public Service hiring works: the 5 steps, the 5-page application limit, scored panel interviews, security screening checks and how pay is posted.",
    published: "2026-11-16",
    updated: "2026-11-16",
  },
  {
    slug: "how-csis-hiring-works",
    title: "How CSIS Hiring Works: Security Clearance, Polygraph and Timeline",
    seoTitle: "How CSIS Hiring Works: Clearance, Polygraph, Timeline",
    description:
      "How CSIS hires: 10 steps, the Enhanced Top Secret clearance and polygraph, a 6 to 18 month timeline, pay levels and Toronto roles.",
    published: "2026-11-13",
    updated: "2026-11-13",
  },
  {
    slug: "how-to-get-a-job-at-the-city-of-burlington",
    title: "How to Get a Job at the City of Burlington: Hiring Steps, Pay and Tips",
    seoTitle: "How to Get a Job at the City of Burlington",
    description:
      "How City of Burlington hiring works: applying on Workday, the panel interview, tests and police checks, current pay ranges, unions and the OMERS pension.",
    published: "2026-11-12",
    updated: "2026-11-12",
  },
  {
    slug: "gta-public-sector-jobs-report-november-2026",
    title: "GTA Public-Sector Jobs Report, November 2026",
    seoTitle: "GTA Public-Sector Jobs Report: November 2026",
    description:
      "Open jobs at Toronto and GTA public employers: which have the most openings, what they pay, and where the jobs are. Counts as of November 6, 2026.",
    published: "2026-11-07",
    updated: "2026-11-07",
  },
  {
    slug: "how-city-of-toronto-hiring-works",
    title: "How City of Toronto Hiring Works, Step by Step",
    seoTitle: "How City of Toronto Hiring Works: Steps and Tips",
    description:
      "The City of Toronto's 5 hiring steps, how to read a City posting, what City panel interviews are like, checks before an offer, and what the City says on timing.",
    published: "2026-10-30",
    updated: "2026-10-30",
  },
  {
    slug: "ttc-hiring-process",
    title: "TTC Hiring Process: Steps, Tests, Interviews and Timing",
    seoTitle: "TTC Hiring Process: Steps, Tests and Interviews",
    description:
      "How TTC hiring works: steps for most jobs, the 8-step Transit Operator process, driver's abstract rules, panel interviews and what the TTC says on timing.",
    published: "2026-10-27",
    updated: "2026-10-27",
  },
  {
    slug: "how-to-become-a-go-bus-driver",
    title: "How to Become a GO Bus Driver: Requirements, Hiring Steps and Training",
    seoTitle: "How to Become a GO Bus Driver: Requirements and Training",
    description:
      "What you need to apply as a GO Transit bus driver, the 9 steps in Metrolinx's hiring process, how the 4-week or 7.5-week training works, and where to apply.",
    published: "2026-10-24",
    updated: "2026-10-24",
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}

export function guideBody(slug: string): string {
  return readContent(`guides/${slug}.html`);
}

export function guidePath(slug: string): string {
  return `/guides/${slug}/`;
}

/** Made by scripts/guide_og_card.py. */
export function guideImage(slug: string): string {
  return `/guides/${slug}.png`;
}

export function formatGuideDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function guideJsonLd(guide: Guide): unknown {
  const url = `${SITE_URL}${guidePath(guide.slug)}`;
  const orgId = `${SITE_URL}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: guide.title,
        description: guide.description,
        url,
        mainEntityOfPage: url,
        datePublished: guide.published,
        dateModified: guide.updated,
        inLanguage: "en-CA",
        image: `${SITE_URL}${guideImage(guide.slug)}`,
        author: {
          "@type": "Person",
          name: LEGAL.legalName,
          url: `${SITE_URL}/about/`,
          jobTitle: "Founder and operator, PublicJobs.ca",
        },
        publisher: { "@id": orgId },
      },
      { "@type": "Organization", "@id": orgId, name: BRAND, url: `${SITE_URL}/` },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "All openings", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides/` },
          { "@type": "ListItem", position: 3, name: guide.title, item: url },
        ],
      },
    ],
  };
}
