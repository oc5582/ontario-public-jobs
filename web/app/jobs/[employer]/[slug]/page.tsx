import { ApplyRow } from "@/components/ApplyRow";
import { JobList } from "@/components/JobList";
import { JsonLd } from "@/components/JsonLd";
import { formatLongDate } from "@/lib/format";
import { jobPostingJsonLd } from "@/lib/jsonld";
import { getJob, similarOpenJobs } from "@/lib/jobs";
import { pageMetadata } from "@/lib/seo";
import type { JobDetail } from "@/lib/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ employer: string; slug: string }> };

const UNAVAILABLE =
  "A job description is not available for this posting. Use the Apply button to view details on the employer site.";

function metaRows(job: JobDetail): { label: string; value: string; href?: string }[] {
  const rows: { label: string; value: string; href?: string }[] = [
    { label: "Employer", value: job.employer, href: `/employers/${job.employer_slug}/` },
    { label: "Location", value: job.location },
    { label: "Posted", value: formatLongDate(job.posted) },
    { label: "Closes", value: formatLongDate(job.closing) },
    { label: "Employment type", value: job.employment_type },
    { label: "Work mode", value: job.work_mode },
    { label: "Salary", value: job.salary },
    { label: "Department", value: job.department },
  ];
  return rows.filter((row) => row.value);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { employer, slug } = await params;
  const job = await getJob(employer, slug);
  if (!job) return { title: "Page not found" };
  return pageMetadata({
    title: job.page_title,
    description: job.meta_description,
    path: job.href,
    index: !job.closed,
  });
}

export default async function JobPage({ params }: Props) {
  const { employer, slug } = await params;
  const job = await getJob(employer, slug);
  if (!job) notFound();
  const similar = job.closed ? await similarOpenJobs(job) : [];
  const rows = metaRows(job);
  const posting = jobPostingJsonLd(job);

  return (
    <main>
      {posting ? <JsonLd data={posting} /> : null}
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
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
              <dd>{row.href ? <a href={row.href}>{row.value}</a> : row.value}</dd>
            </div>
          ))}
        </dl>
        <ApplyRow url={job.apply_url} />
        <section className="description" aria-labelledby="desc-heading">
          <h2 id="desc-heading">Job description</h2>
          {job.paragraphs.length ? (
            job.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
          ) : (
            <p>{UNAVAILABLE}</p>
          )}
        </section>
        <ApplyRow url={job.apply_url} />
        {job.closed && similar.length ? (
          <section className="similar-jobs" aria-labelledby="similar-heading">
            <h2 id="similar-heading">Similar open jobs</h2>
            <JobList jobs={similar} />
          </section>
        ) : null}
      </article>
    </main>
  );
}
