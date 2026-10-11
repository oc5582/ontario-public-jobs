import { formatDescription } from "./description";
import { LEGAL } from "./legal-config";
import { SITE_URL } from "./site";
import type { JobDetail, ListJob } from "./types";

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function homeJsonLd(): unknown {
  const orgId = `${SITE_URL}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "PublicJobs.ca",
        url: `${SITE_URL}/`,
        email: LEGAL.supportEmail,
        telephone: LEGAL.phoneTel.replace(/^tel:/, ""),
        address: {
          "@type": "PostalAddress",
          streetAddress: LEGAL.streetAddress,
          addressLocality: LEGAL.addressLocality,
          addressRegion: LEGAL.addressRegion,
          postalCode: LEGAL.postalCode,
          addressCountry: LEGAL.addressCountry,
        },
        founder: {
          "@type": "Person",
          name: LEGAL.legalName,
          jobTitle: "Founder and operator",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "PublicJobs.ca",
        url: `${SITE_URL}/`,
        publisher: { "@id": orgId },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export function itemListJsonLd(name: string, url: string, jobs: ListJob[]): unknown {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url,
    numberOfItems: jobs.length,
    itemListElement: jobs.map((job, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}${job.href}`,
      name: job.title,
    })),
  };
}

export function jobPostingJsonLd(job: JobDetail): unknown | null {
  if (job.closed || !job.jobposting) return null;
  const data: Record<string, unknown> = { ...job.jobposting, directApply: false };
  const description = formatDescription(job.description);
  if (description) data.description = description;
  const org = data.hiringOrganization;
  if (org && typeof org === "object") {
    const organization = { ...(org as Record<string, unknown>) };
    if (job.website) organization.sameAs = job.website;
    delete organization.logo;
    data.hiringOrganization = organization;
  }
  return data;
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]): unknown {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
