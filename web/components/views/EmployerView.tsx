import { JobList } from "@/components/JobList";
import { JsonLd } from "@/components/JsonLd";
import { SignupForm } from "@/components/SignupForm";
import { buildEmployerSeo, employerProfile } from "@/lib/employer-copy";
import { employerHeading } from "@/lib/employer-page";
import { breadcrumbJsonLd, faqPageJsonLd, itemListJsonLd } from "@/lib/jsonld";
import { employerBySlug, employerOpenJobs, employerPayRows } from "@/lib/jobs";
import { alertConsentLabel, alertConsentSender } from "@/lib/legal-copy";
import { pageMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

async function employerSeo(slug: string, jobs: { title: string }[]) {
  const profile = employerProfile(slug);
  if (!profile) return null;
  const pay = await employerPayRows(slug);
  return buildEmployerSeo(
    profile,
    jobs.length,
    jobs.map((job) => job.title),
    pay,
  );
}

export async function employerMetadata(slug: string): Promise<Metadata> {
  const employer = await employerBySlug(slug);
  if (!employer) return { title: "Page not found" };
  const jobs = await employerOpenJobs(slug);
  const seo = await employerSeo(slug, jobs);
  const heading = employerHeading(employer.name);
  const noun = jobs.length === 1 ? "opening" : "openings";
  const description = seo
    ? seo.description
    : jobs.length
      ? `${jobs.length} current ${employer.name} ${noun} listed on PublicJobs.ca. You apply on the employer's own website.`
      : `No current ${employer.name} openings on PublicJobs.ca. You apply on the employer's own website when a job is posted.`;
  return pageMetadata({
    title: seo ? seo.title : heading.title,
    description,
    path: `/employers/${slug}/`,
    index: jobs.length > 0,
  });
}

export async function EmployerView({ slug }: { slug: string }) {
  const employer = await employerBySlug(slug);
  if (!employer) notFound();
  const jobs = await employerOpenJobs(slug);
  const seo = await employerSeo(slug, jobs);
  const heading = employerHeading(employer.name);
  const noun = jobs.length === 1 ? "opening" : "openings";
  const intro = jobs.length
    ? `${jobs.length} current ${noun} at ${employer.name}. PublicJobs.ca lists them in one place. You apply on the employer's own website. We are independent and not affiliated with ${employer.name}.`
    : `No current openings at ${employer.name}. Closed postings stay off this page. You apply on the employer's own website when a job is posted. We are independent and not affiliated with ${employer.name}.`;
  const pageUrl = `${SITE_URL}/employers/${employer.slug}/`;
  const h1 = seo ? seo.h1 : heading.h1;

  return (
    <main>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "All openings", url: `${SITE_URL}/` },
          { name: "Employers", url: `${SITE_URL}/employers/` },
          { name: employer.name, url: pageUrl },
        ])}
      />
      <JsonLd data={itemListJsonLd(h1, pageUrl, jobs)} />
      {seo ? <JsonLd data={faqPageJsonLd(pageUrl, seo.faqs)} /> : null}
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a> / <a href="/employers/">Employers</a>
        </p>
        <h1>{h1}</h1>
        <section className="description">
          {seo ? (
            seo.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
          ) : (
            <p>
              {heading.lead ? <>{heading.lead} </> : null}
              {intro}
            </p>
          )}
        </section>
        <SignupForm
          consent={alertConsentLabel()}
          sender={alertConsentSender()}
          heading={`Email me new ${heading.alertName} jobs every week (free)`}
          idPrefix="employer-"
          placement="employer"
        />
        {jobs.length === 0 ? (
          <p className="listings-empty">No current openings.</p>
        ) : (
          <JobList jobs={jobs} />
        )}
        {seo ? (
          <section className="description employer-questions" aria-labelledby="employer-questions">
            <h2 id="employer-questions">Questions</h2>
            {seo.faqs.map((faq) => (
              <div key={faq.question}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </div>
            ))}
          </section>
        ) : null}
      </article>
    </main>
  );
}
