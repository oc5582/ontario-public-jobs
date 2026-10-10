import { FilterBar } from "@/components/FilterBar";
import { JobList } from "@/components/JobList";
import { JsonLd } from "@/components/JsonLd";
import { UnlockCard } from "@/components/UnlockCard";
import { getViewer } from "@/lib/auth";
import { filtersFromSearch, hasFilters, hasPageParam, searchWithoutPage, type JobFilters } from "@/lib/filters";
import { itemListJsonLd } from "@/lib/jsonld";
import { employerBySlug, getFacets, searchJobs } from "@/lib/jobs";
import { pageMetadata } from "@/lib/seo";
import { BRAND, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function employerFilters(params: Record<string, string | string[] | undefined>, slug: string): JobFilters {
  return { ...filtersFromSearch(params), employer: slug };
}

function extraFilters(filters: JobFilters): boolean {
  return hasFilters({ ...filters, employer: "" });
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const employer = await employerBySlug(slug);
  if (!employer) return { title: "Page not found" };
  const filters = employerFilters(query, slug);
  const filtering = extraFilters(filters);
  const result = await searchJobs({ ...filters, employer: slug }, false);
  const noun = result.total === 1 ? "opening" : "openings";
  const description = result.total
    ? `${result.total} current ${employer.name} ${noun} listed on PublicJobs.ca. You apply on the employer's own website.`
    : `No current ${employer.name} openings on PublicJobs.ca. You apply on the employer's own website when a job is posted.`;
  return pageMetadata({
    title: `${employer.name} jobs | ${BRAND}`,
    description,
    path: `/employers/${slug}/`,
    index: !filtering,
  });
}

export default async function EmployerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  if (hasPageParam(query)) {
    const rest = searchWithoutPage(query);
    redirect(rest ? `/employers/${slug}/?${rest}` : `/employers/${slug}/`);
  }
  const employer = await employerBySlug(slug);
  if (!employer) notFound();
  const filters = employerFilters(query, slug);
  const viewer = await getViewer();
  const [result, facets] = await Promise.all([searchJobs(filters, viewer.isMember), getFacets()]);
  const noun = result.total === 1 ? "opening" : "openings";
  const intro = result.total
    ? `${result.total} current ${noun} at ${employer.name}. PublicJobs.ca lists them in one place. You apply on the employer's own website. We are independent and not affiliated with ${employer.name}.`
    : `No current openings at ${employer.name}. Closed postings stay off this page. You apply on the employer's own website when a job is posted. We are independent and not affiliated with ${employer.name}.`;
  const memberNote = viewer.isMember ? " You are signed in, so this is the full list." : "";

  return (
    <main>
      <JsonLd
        data={itemListJsonLd(`${employer.name} jobs`, `${SITE_URL}/employers/${slug}/`, result.jobs)}
      />
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
        <FilterBar action={`/employers/${slug}/`} filters={filters} facets={facets} lockEmployer />
        {result.total === 0 ? (
          <p className="listings-empty">No openings match that search.</p>
        ) : (
          <JobList jobs={result.jobs} />
        )}
        {viewer.isMember ? null : <UnlockCard total={result.total} shown={result.jobs.length} />}
      </article>
    </main>
  );
}
