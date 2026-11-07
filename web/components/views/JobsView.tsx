import { JsonLd } from "@/components/JsonLd";
import { OpeningsBrowser } from "@/components/OpeningsBrowser";
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
    <main>
      <JsonLd data={itemListJsonLd("All job openings", `${SITE_URL}/jobs/`, result.jobs)} />
      <article className="job-page content">
        <OpeningsBrowser
          filters={filters}
          facets={facets}
          jobs={result.jobs}
          total={result.total}
          member={member}
          applied={appliedSet}
          preview={preview}
          action="/jobs/"
          place="jobs"
          titleTag="h1"
          showCrumb
        />
      </article>
    </main>
  );
}
