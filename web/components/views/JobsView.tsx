import { FilterBar } from "@/components/FilterBar";
import { JobList } from "@/components/JobList";
import { JsonLd } from "@/components/JsonLd";
import { UnlockCard } from "@/components/UnlockCard";
import type { JobFilters } from "@/lib/filters";
import { itemListJsonLd } from "@/lib/jsonld";
import { getFacets, searchJobs } from "@/lib/jobs";
import { SITE_URL } from "@/lib/site";

export async function JobsView({ filters, member }: { filters: JobFilters; member: boolean }) {
  const [result, facets] = await Promise.all([searchJobs(filters, member), getFacets()]);
  const shown = result.jobs.length;
  const intro = member
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
        {member ? null : <UnlockCard total={result.total} shown={shown} />}
      </article>
    </main>
  );
}
