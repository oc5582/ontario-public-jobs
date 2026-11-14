import { HomeSearchField, HomeSearchProvider, LiveOpenings } from "@/components/HomeSearch";
import { JsonLd } from "@/components/JsonLd";
import type { JobFilters } from "@/lib/filters";
import { itemListJsonLd } from "@/lib/jsonld";
import { getFacets, paywallPreview, searchJobs } from "@/lib/jobs";
import { SITE_URL } from "@/lib/site";

export async function JobsView({
  filters,
  member,
  applied,
}: {
  filters: JobFilters;
  member: boolean;
  applied?: Promise<ReadonlySet<string>>;
}) {
  const [result, facets, appliedSet] = await Promise.all([
    searchJobs(filters, member),
    getFacets(),
    applied ?? Promise.resolve(undefined),
  ]);
  const shown = result.jobs.length;
  const preview = member || shown >= result.total ? null : await paywallPreview(filters, shown);

  return (
    <HomeSearchProvider
      filters={filters}
      facets={facets}
      jobs={result.jobs}
      total={result.total}
      preview={preview}
      member={member}
      appliedKeys={appliedSet ? Array.from(appliedSet) : undefined}
    >
      <main>
        <JsonLd data={itemListJsonLd("All job openings", `${SITE_URL}/jobs/`, result.jobs)} />
        <article className="job-page content">
          <div className="listings-toolbar jobs-search">
            <HomeSearchField />
          </div>
          <LiveOpenings action="/jobs/" place="jobs" titleTag="h1" showCrumb />
        </article>
      </main>
    </HomeSearchProvider>
  );
}
