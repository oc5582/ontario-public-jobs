import { ApplyRow } from "@/components/ApplyRow";
import { ClosingSoon } from "@/components/ClosingSoon";
import { JobList } from "@/components/JobList";
import { JsonLd } from "@/components/JsonLd";
import { ResumeFitLink } from "@/components/ResumeFitLink";
import { SignupForm } from "@/components/SignupForm";
import type { ReactNode } from "react";
import { formatDescription } from "@/lib/description";
import { displayLocation } from "@/lib/display-location";
import { employerHeading } from "@/lib/employer-page";
import { formatLongDate, parseIsoDate } from "@/lib/format";
import { breadcrumbJsonLd, jobPostingJsonLd } from "@/lib/jsonld";
import { alertConsentLabel } from "@/lib/legal-copy";
import { hasDescription } from "@/lib/has-description";
import { isFrench } from "@/lib/language";
import { elsewhereJobs, employerOpenJobs, getJob, neighbourJobs } from "@/lib/jobs";
import { pageMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import type { JobDetail } from "@/lib/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const UNAVAILABLE =
  "A job description is not available for this posting. Use the Apply button to view details on the employer site.";

function metaRows(job: JobDetail): { label: string; value: string; href?: string; closingIso?: string }[] {
  const closing = formatLongDate(job.closing);
  const rows: { label: string; value: string; href?: string; closingIso?: string }[] = [
    { label: "Employer", value: job.employer, href: `/employers/${job.employer_slug}/` },
    { label: "Location", value: displayLocation(job.location, job.location_places) },
    job.posted
      ? { label: "Posted", value: formatLongDate(job.posted) }
      : { label: "Listed on PublicJobs.ca", value: formatLongDate(job.first_seen) },
    { label: "Closes", value: closing, closingIso: closing ? parseIsoDate(job.closing) : "" },
    { label: "Employment type", value: job.employment_type },
    { label: "Work mode", value: job.work_mode },
    { label: "Salary", value: job.salary },
    { label: "Department", value: job.department },
  ];
  return rows.filter((row) => row.value);
}

function alertHeading(employer: string): string {
  const name = employer ? employerHeading(employer).alertName : "";
  if (!name) return "Get new similar public jobs by email, free";
  return `Get new ${name} and similar public jobs by email, free`;
}

export async function jobMetadata(employer: string, slug: string): Promise<Metadata> {
  const job = await getJob(employer, slug);
  if (!job) return { title: "Page not found" };
  return pageMetadata({
    title: job.page_title,
    description: job.meta_description,
    path: job.href,
    index: !job.closed && hasDescription(job),
  });
}

export async function JobView({
  employer,
  slug,
  applyToggle = null,
}: {
  employer: string;
  slug: string;
  applyToggle?: ReactNode | Promise<ReactNode | null>;
}) {
  const job = await getJob(employer, slug);
  if (!job) notFound();
  const [neighbours, toggle, openings] = await Promise.all([
    job.closed ? Promise.resolve([]) : neighbourJobs(job),
    Promise.resolve(applyToggle ?? null),
    job.closed ? employerOpenJobs(job.employer_slug) : Promise.resolve([]),
  ]);
  const elsewhere = job.closed ? [] : await elsewhereJobs(job, [job.path, ...neighbours.map((item) => item.path)]);
  const rows = metaRows(job);
  const posting = jobPostingJsonLd(job);
  const descriptionHtml = formatDescription(job.description.trim() ? job.description : job.paragraphs.join("\n"));
  const employerHref = `/employers/${job.employer_slug}/`;
  const crumbs = [
    { name: "All openings", url: `${SITE_URL}/` },
    { name: "Employers", url: `${SITE_URL}/employers/` },
    { name: job.employer || "Employer", url: `${SITE_URL}${employerHref}` },
    { name: job.title, url: `${SITE_URL}${job.href}` },
  ];

  return (
    <main>
      {posting ? <JsonLd data={posting} /> : null}
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <article className="job-page content" {...(isFrench(job) ? { lang: "fr" } : {})}>
        <p className="crumb">
          <a href="/">All openings</a>
          {" / "}
          <a href="/employers/">Employers</a>
          {job.employer ? (
            <>
              {" / "}
              <a href={employerHref}>{job.employer}</a>
            </>
          ) : null}
        </p>
        {job.closed ? (
          <p className="closed-banner" role="status">
            This job is no longer available.
          </p>
        ) : null}
        <h1>{job.title}</h1>
        {job.employer ? (
          <p className="employer">
            <a href={`/employers/${job.employer_slug}/`}>{job.employer}</a>
          </p>
        ) : null}
        <dl className="job-meta">
          {rows.map((row) => (
            <div className="meta-row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                {row.href ? <a href={row.href}>{row.value}</a> : row.value}
                {row.closingIso ? <ClosingSoon iso={row.closingIso} /> : null}
              </dd>
            </div>
          ))}
        </dl>
        <div className="job-apply">
          <ApplyRow
            url={job.apply_url}
            extra={toggle}
            track={{ employer: job.employer_slug, job: job.id, position: "top" }}
          />
          {job.apply_url ? (
            <div className="job-followup">
              <SignupForm
                consent={alertConsentLabel()}
                sender=""
                heading={alertHeading(job.employer)}
                submitLabel="Sign up"
                idPrefix="job-"
                placement="job"
                lazyTurnstile
                analytics={{
                  name: "job_alert_signup",
                  properties: { source: "job_page", employer: job.employer_slug },
                }}
              />
              <ResumeFitLink jobId={job.id} employer={job.employer_slug} />
            </div>
          ) : null}
        </div>
        <section className="description" aria-labelledby="desc-heading">
          <h2 id="desc-heading">Job description</h2>
          {descriptionHtml ? <div dangerouslySetInnerHTML={{ __html: descriptionHtml }} /> : <p>{UNAVAILABLE}</p>}
        </section>
        <ApplyRow
          url={job.apply_url}
          track={{ employer: job.employer_slug, job: job.id, position: "bottom" }}
        />
        <p className="source-note">
          Collected from {job.employer ? `${job.employer}'s` : "the employer's"} public careers site
          {job.fetched ? ` on ${formatLongDate(job.fetched)}` : ""}. PublicJobs.ca is not affiliated with this
          employer. The employer can ask us to correct or remove a listing.{" "}
          <a href={`/report/?job=${encodeURIComponent(job.path)}`}>Report a fake or suspicious job</a>
        </p>
        {job.closed ? (
          <section className="similar-jobs" aria-labelledby="openings-heading">
            <h2 id="openings-heading">Current openings at {job.employer || "this employer"}</h2>
            <p className="openings-note">
              This job is no longer available.{" "}
              <a href={employerHref}>See current {job.employer || "employer"} openings</a>.
            </p>
            {openings.length ? <JobList jobs={openings} /> : <p className="listings-empty">No current openings.</p>}
          </section>
        ) : null}
        {!job.closed && (neighbours.length || elsewhere.length) ? (
          <section className="similar-jobs" aria-labelledby="related-heading">
            <h2 id="related-heading">More jobs like this</h2>
            {neighbours.length ? (
              <>
                <h3>More at {job.employer}</h3>
                <JobList jobs={neighbours} />
              </>
            ) : null}
            {elsewhere.length ? (
              <>
                <h3>Similar jobs elsewhere</h3>
                <JobList jobs={elsewhere} />
              </>
            ) : null}
          </section>
        ) : null}
      </article>
    </main>
  );
}
