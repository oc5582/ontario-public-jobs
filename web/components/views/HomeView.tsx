import { JsonLd } from "@/components/JsonLd";
import { JobList } from "@/components/JobList";
import { MatchPromo } from "@/components/MatchPromo";
import { SearchField } from "@/components/SearchField";
import { SignupForm } from "@/components/SignupForm";
import { UnlockCard } from "@/components/UnlockCard";
import { emptyFilters, queryFromFilters, type JobFilters } from "@/lib/filters";
import { countNoun } from "@/lib/format";
import { homeJsonLd, itemListJsonLd } from "@/lib/jsonld";
import { searchJobs } from "@/lib/jobs";
import { H1, SITE_URL, SUBHEAD } from "@/lib/site";

export async function HomeView({ filters, member }: { filters: JobFilters; member: boolean }) {
  const filtering = Boolean(queryFromFilters(filters));
  const result = await searchJobs(filters, member);
  const openTotal = filtering ? (await searchJobs(emptyFilters(), false)).total : result.total;
  const label = countNoun(result.total, filtering);
  const browseQuery = queryFromFilters(filters);
  const browseHref = browseQuery ? `/jobs/?${browseQuery}` : "/jobs/";

  return (
    <main>
      <JsonLd data={homeJsonLd()} />
      <JsonLd data={itemListJsonLd("Current openings", `${SITE_URL}/`, result.jobs)} />
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
          {member ? null : <UnlockCard total={result.total} shown={result.jobs.length} />}
        </section>
      </div>
    </main>
  );
}
