import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobList, JsonLd, SiteFooter, SiteHeader } from "@/components/ui";
import { SHORT_EMPLOYERS } from "@/lib/classify";
import { jobPosting } from "@/lib/jsonld";
import type { JobRecord } from "@/lib/jobs";
import { pageMeta } from "@/lib/seo";
import { getJob, similarJobs } from "@/lib/store";
import { formatDate, paragraphs, torontoToday } from "@/lib/text";

type Props = { params: Promise<{ employer: string; slug: string }> };

function unavailable(job: JobRecord): boolean {
  if (!job.inFeed) return true;
  if (!job.closingDate) return false;
  return job.closingDate < torontoToday();
}

function docTitle(job: JobRecord): string {
  const employer = SHORT_EMPLOYERS[job.employer] || job.employer;
  const base = `${job.title}, ${employer}`;
  const full = `${base} | PublicJobs.ca`;
  return full.length <= 70 ? full : base;
}

function docDescription(job: JobRecord): string {
  const city = job.city ? `, ${job.city}` : "";
  let salary = "";
  if (job.salaryMinAnnual && job.salaryMaxAnnual) {
    const k = (amount: number) => `$${Math.round(amount / 1000)}k`;
    salary = job.salaryMinAnnual === job.salaryMaxAnnual ? ` ${k(job.salaryMinAnnual)}.` : ` ${k(job.salaryMinAnnual)}-${k(job.salaryMaxAnnual)}.`;
  }
  const closes = job.closingDate ? ` Closes ${formatDate(job.closingDate)}.` : "";
  return `${job.title} at ${job.employer}${city}.${salary}${closes} Apply on the employer's site.`.replace(/\s+/g, " ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { employer, slug } = await params;
  const job = await getJob(employer, slug);
  if (!job) return pageMeta({ title: "Page not found | PublicJobs.ca", description: "This page may have moved, or the job may have closed.", path: `/jobs/${employer}/${slug}/`, noindex: true });
  const closed = unavailable(job);
  return pageMeta({
    title: docTitle(job),
    description: docDescription(job),
    path: `/${job.path}`,
    noindex: closed,
  });
}

export default async function JobPage({ params }: Props) {
  const { employer, slug } = await params;
  const job = await getJob(employer, slug);
  if (!job) notFound();
  const closed = unavailable(job);
  const ld = closed ? null : jobPosting(job);
  const similar = closed ? await similarJobs(job) : [];
  const rows: [string, string][] = [
    ["Employer", job.employer],
    ["Location", job.location],
    ["Posted", job.postedDate ? formatDate(job.postedDate) : ""],
    ["Closes", job.closingDate ? formatDate(job.closingDate) : ""],
    ["Employment type", job.employmentType],
    ["Work mode", job.workMode],
    ["Salary", job.salary],
    ["Department", job.department],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const body = paragraphs(job.description);
  return (
    <>
      {ld ? <JsonLd data={ld} /> : null}
      <SiteHeader />
      <main>
        <article className="job-page content">
          <p className="crumb">
            <a href="/">All openings</a>
          </p>
          {closed ? (
            <p className="closed-banner" role="status">
              This job is no longer available.
            </p>
          ) : null}
          <h1>{job.title}</h1>
          <p className="employer">
            <a href={`/employers/${job.employerSlug}/`}>{job.employer}</a>
          </p>
          <dl className="job-meta">
            {rows.map(([label, value]) => (
              <div className="meta-row" key={label}>
                <dt>{label}</dt>
                <dd>
                  {label === "Employer" ? <a href={`/employers/${job.employerSlug}/`}>{value}</a> : value}
                </dd>
              </div>
            ))}
          </dl>
          {job.applyUrl ? <Apply url={job.applyUrl} /> : null}
          <section className="description" aria-labelledby="desc-heading">
            <h2 id="desc-heading">Job description</h2>
            {body.length ? body.map((paragraph, index) => <p key={index}>{paragraph}</p>) : (
              <p className="unavailable">A job description is not available for this posting. Use the Apply button to view details on the employer site.</p>
            )}
          </section>
          {job.applyUrl ? <Apply url={job.applyUrl} /> : null}
          {closed && similar.length ? (
            <section className="listings" aria-labelledby="similar-heading">
              <h2 id="similar-heading">Similar open jobs</h2>
              <JobList jobs={similar} />
            </section>
          ) : null}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

function Apply({ url }: { url: string }) {
  return (
    <div className="apply-row">
      <a className="apply-btn" href={url} target="_blank" rel="noopener noreferrer">
        Apply on employer site
      </a>
      <p className="apply-note">For the latest details and the full posting, view this job on the employer&apos;s site.</p>
    </div>
  );
}
