import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FilterBar, JobList, SiteFooter, SiteHeader, UnlockCard } from "@/components/ui";
import { filtersActive, readFilters, type SearchParams } from "@/lib/filters";
import { memberState } from "@/lib/member";
import { pageMeta } from "@/lib/seo";
import { filterChoices, listEmployers, searchJobs } from "@/lib/store";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const employers = await listEmployers();
  const employer = employers.find((item) => item.slug === slug);
  if (!employer) {
    return pageMeta({
      title: "Page not found | PublicJobs.ca",
      description: "This page may have moved, or the job may have closed.",
      path: `/employers/${slug}/`,
      noindex: true,
    });
  }
  const noun = employer.openCount === 1 ? "opening" : "openings";
  return pageMeta({
    title: `${employer.name} jobs | PublicJobs.ca`,
    description: `${employer.openCount} current ${employer.name} ${noun} listed on PublicJobs.ca. You apply on the employer's own website.`,
    path: `/employers/${slug}/`,
    noindex: filtersActive(sp),
  });
}

export default async function EmployerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const employers = await listEmployers();
  const employer = employers.find((item) => item.slug === slug);
  if (!employer) notFound();
  const filters = { ...readFilters(sp), employer: slug };
  const member = await memberState();
  const [{ total, jobs }, choices] = await Promise.all([
    searchJobs(filters, member.member),
    filterChoices(),
  ]);
  const noun = total === 1 ? "opening" : "openings";
  const intro = total
    ? `${total} current ${noun} at ${employer.name}. PublicJobs.ca lists them in one place. You apply on the employer's own website. We are independent and not affiliated with ${employer.name}.`
    : `No current openings at ${employer.name}. Closed postings stay off this page. You apply on the employer's own website when a job is posted. We are independent and not affiliated with ${employer.name}.`;
  return (
    <>
      <SiteHeader current="employers" />
      <main>
        <article className="job-page content">
          <p className="crumb">
            <a href="/">All openings</a> / <a href="/employers/">Employers</a>
          </p>
          <h1>{employer.name} jobs</h1>
          <section className="description">
            <p>{intro}</p>
          </section>
          <FilterBar action={`/employers/${slug}/`} filters={filters} choices={choices} sp={sp} includeSearch showEmployer={false} />
          {jobs.length ? <JobList jobs={jobs} /> : null}
          {member.member ? null : <UnlockCard total={total} shown={jobs.length} />}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
