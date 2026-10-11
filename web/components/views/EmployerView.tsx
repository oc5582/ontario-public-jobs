import { FilterBar } from "@/components/FilterBar";
import { JobList } from "@/components/JobList";
import { JsonLd } from "@/components/JsonLd";
import { UnlockCard } from "@/components/UnlockCard";
import type { JobFilters } from "@/lib/filters";
import { itemListJsonLd } from "@/lib/jsonld";
import { employerBySlug, getFacets, searchJobs } from "@/lib/jobs";
import { SITE_URL } from "@/lib/site";
import { notFound } from "next/navigation";

export async function EmployerView({ filters, member }: { filters: JobFilters; member: boolean }) {
  const employer = await employerBySlug(filters.employer);
  if (!employer) notFound();
  const [result, facets] = await Promise.all([
    searchJobs({ ...filters, employer: employer.slug }, member),
    getFacets(),
  ]);
  const noun = result.total === 1 ? "opening" : "openings";
  const intro = result.total
    ? `${result.total} current ${noun} at ${employer.name}. PublicJobs.ca lists them in one place. You apply on the employer's own website. We are independent and not affiliated with ${employer.name}.`
    : `No current openings at ${employer.name}. Closed postings stay off this page. You apply on the employer's own website when a job is posted. We are independent and not affiliated with ${employer.name}.`;
  const memberNote = member ? " You are signed in, so this is the full list." : "";

  return (
    <main>
      <JsonLd data={itemListJsonLd(`${employer.name} jobs`, `${SITE_URL}/employers/${employer.slug}/`, result.jobs)} />
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a> / <a href="/employers/">Employers</a>
        </p>
        <h1>{employer.name} jobs</h1>
        <section className="description">
          <p>
            {intro}
            {memberNote}
          </p>
        </section>
        <FilterBar action={`/employers/${employer.slug}/`} filters={filters} facets={facets} lockEmployer />
        {result.total === 0 ? (
          <p className="listings-empty">No openings match that search.</p>
        ) : (
          <JobList jobs={result.jobs} />
        )}
        {member ? null : <UnlockCard total={result.total} shown={result.jobs.length} />}
      </article>
    </main>
  );
}
