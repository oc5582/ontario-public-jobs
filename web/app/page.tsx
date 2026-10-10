import { JsonLd } from "@/components/JsonLd";
import { JobList } from "@/components/JobList";
import { MatchPromo } from "@/components/MatchPromo";
import { SearchField } from "@/components/SearchField";
import { SignupForm } from "@/components/SignupForm";
import { UnlockCard } from "@/components/UnlockCard";
import { getViewer } from "@/lib/auth";
import { emptyFilters, filtersFromSearch, hasFilters, hasPageParam, searchWithoutPage } from "@/lib/filters";
import { countNoun } from "@/lib/format";
import { homeJsonLd, itemListJsonLd } from "@/lib/jsonld";
import { searchJobs } from "@/lib/jobs";
import { pageMetadata } from "@/lib/seo";
import { BRAND, H1, META_DESCRIPTION, PAGE_TITLE, SITE_URL, SUBHEAD } from "@/lib/site";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const filters = filtersFromSearch(params);
  return pageMetadata({
    title: `${PAGE_TITLE} | ${BRAND}`,
    description: META_DESCRIPTION,
    path: "/",
    index: !hasFilters(filters),
  });
}

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  if (hasPageParam(params)) {
    const query = searchWithoutPage(params);
    redirect(query ? `/?${query}` : "/");
  }
  const filters = filtersFromSearch(params);
  const filtering = hasFilters(filters);
  const viewer = await getViewer();
  const result = await searchJobs(filters, viewer.isMember);
  const openTotal = filtering ? (await searchJobs(emptyFilters(), false)).total : result.total;
  const label = countNoun(result.total, filtering);
  const browseQuery = searchWithoutPage(params);
  const browseHref = browseQuery ? `/jobs/?${browseQuery}` : "/jobs/";

  return (
    <main>
      <JsonLd data={homeJsonLd()} />
      <JsonLd
        data={itemListJsonLd("Current openings", `${SITE_URL}/`, result.jobs)}
      />
      <div className="content">
        <section className="hero" aria-labelledby="page-heading">
          <h1 id="page-heading">{H1}</h1>
          <p className="subhead">{SUBHEAD}</p>
          <div className="listings-toolbar">
            <div className="count-block" aria-live="polite">
              <p className="count-number" id="listings-count">
                {result.total}
              </p>
              <p className="count-label" id="listings-count-label">
                {label}
              </p>
            </div>
            <SearchField initial={filters.q} />
          </div>
        </section>

        <MatchPromo count={openTotal} />
        <SignupForm />

        <section className="listings" aria-labelledby="listings-heading">
          <h2 id="listings-heading">Current openings</h2>
          <p className="listings-index">
            <a href={browseHref}>
              Browse all {result.total} {label}
            </a>
          </p>
          {result.total === 0 ? (
            <p id="listings-empty" className="listings-empty" aria-live="polite">
              No openings match that search.
            </p>
          ) : (
            <p id="listings-empty" className="listings-empty" aria-live="polite" hidden>
              No openings match that search.
            </p>
          )}
          <JobList jobs={result.jobs} id="job-list" />
          {viewer.isMember ? null : <UnlockCard total={result.total} shown={result.jobs.length} />}
        </section>
      </div>
    </main>
  );
}
