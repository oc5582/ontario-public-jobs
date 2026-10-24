import { formatDescription } from "./description";
import { validThrough } from "./format";
import { LEGAL } from "./legal-config";
import {
  baseSalaryFromJob,
  employmentTypesFor,
  httpUrl,
  missingEmploymentType,
  usableBaseSalary,
} from "./schema-fill";
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
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icon-512.png`,
        },
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
  data["@context"] = "https://schema.org";
  const posted = job.posted || job.first_seen;
  if (posted) data.datePosted = posted;
  else delete data.datePosted;
  // Closing date only. A missing date stays missing. Do not invent validThrough.
  const through = validThrough(job.closing);
  if (through) data.validThrough = through;
  else delete data.validThrough;
  const description = formatDescription(job.description);
  if (description) data.description = description;
  if (missingEmploymentType(data.employmentType)) {
    const types = employmentTypesFor(job.employment_type || "", job.description || "");
    if (types.length === 1) data.employmentType = types[0];
    else if (types.length > 1) data.employmentType = types;
    else delete data.employmentType;
  }
  const salary = usableBaseSalary(data.baseSalary) || baseSalaryFromJob(job.salary || "", job.description || "");
  if (salary) data.baseSalary = salary;
  else delete data.baseSalary;
  const org = data.hiringOrganization;
  if (org && typeof org === "object") {
    const organization = { ...(org as Record<string, unknown>) };
    const website = httpUrl(job.website);
    if (website) {
      organization.sameAs = website;
      organization.url = website;
    } else {
      if (!httpUrl(typeof organization.url === "string" ? organization.url : "")) delete organization.url;
      if (!httpUrl(typeof organization.sameAs === "string" ? organization.sameAs : "")) delete organization.sameAs;
    }
    // Only the employer's own official logo URL (employers.logo_url); never a guessed one.
    const logo = httpUrl(job.logo_url);
    if (logo) organization.logo = logo;
    else delete organization.logo;
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
