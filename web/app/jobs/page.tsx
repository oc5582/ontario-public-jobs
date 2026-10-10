import { FilterBar } from "@/components/FilterBar";
import { JobList } from "@/components/JobList";
import { JsonLd } from "@/components/JsonLd";
import { UnlockCard } from "@/components/UnlockCard";
import { getViewer } from "@/lib/auth";
import { filtersFromSearch, hasFilters, hasPageParam, searchWithoutPage } from "@/lib/filters";
import { itemListJsonLd } from "@/lib/jsonld";
import { getFacets, searchJobs } from "@/lib/jobs";
import { pageMetadata } from "@/lib/seo";
import { BRAND, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const filters = filtersFromSearch(params);
  const filtering = hasFilters(filters);
  return pageMetadata({
    title: `All job openings | ${BRAND}`,
    description: filtering
      ? "Filtered public-sector job openings in Toronto and the GTA listed on PublicJobs.ca."
      : "Every current public-sector job opening in Toronto and the GTA listed on PublicJobs.ca.",
    path: "/jobs/",
    index: !filtering,
  });
}

export default async function JobsPage({ searchParams }: Props) {
  const params = await searchParams;
  if (hasPageParam(params)) {
    const query = searchWithoutPage(params);
    redirect(query ? `/jobs/?${query}` : "/jobs/");
  }
  const filters = filtersFromSearch(params);
  const viewer = await getViewer();
  const [result, facets] = await Promise.all([searchJobs(filters, viewer.isMember), getFacets()]);
  const shown = result.jobs.length;
  const intro = viewer.isMember
    ? `${result.total} current openings from public employers in Toronto and the GTA. You are signed in, so this is the full list.`
    : `${result.total} current openings from public employers in Toronto and the GTA. Showing the newest ${shown}.`;

  return (
    <main>
      <JsonLd data={itemListJsonLd("All job openings", `${SITE_URL}/jobs/`, result.jobs)} />
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>All job openings</h1>
        <section className="description">
          <p>{intro}</p>
        </section>
        <FilterBar action="/jobs/" filters={filters} facets={facets} />
        {result.total === 0 ? (
          <p className="listings-empty">No openings match that search.</p>
        ) : (
          <JobList jobs={result.jobs} />
        )}
        {viewer.isMember ? null : <UnlockCard total={result.total} shown={shown} />}
      </article>
    </main>
  );
}
