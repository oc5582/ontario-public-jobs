import { JsonLd } from "@/components/JsonLd";
import { MatchPromo } from "@/components/MatchPromo";
import { OpeningsBrowser } from "@/components/OpeningsBrowser";
import { SearchField } from "@/components/SearchField";
import { SignupForm } from "@/components/SignupForm";
import { emptyFilters, queryFromFilters, type JobFilters } from "@/lib/filters";
import { countNoun } from "@/lib/format";
import { alertConsentLabel, alertConsentSender } from "@/lib/legal-copy";
import { homeJsonLd, itemListJsonLd } from "@/lib/jsonld";
import { getFacets, paywallPreview, searchJobs } from "@/lib/jobs";
import { H1, SITE_URL, SUBHEAD } from "@/lib/site";

export async function HomeView({
  filters,
  member,
  applied,
}: {
  filters: JobFilters;
  member: boolean;
  applied?: Promise<ReadonlySet<string>>;
}) {
  const filtering = Boolean(queryFromFilters(filters));
  const [result, facets, appliedSet, unfiltered] = await Promise.all([
    searchJobs(filters, member),
    getFacets(),
    applied ?? Promise.resolve(undefined),
    filtering ? searchJobs(emptyFilters(), false) : Promise.resolve(null),
  ]);
  const preview =
    member || result.jobs.length >= result.total
      ? null
      : await paywallPreview(filters, result.jobs.length);
  const openTotal = unfiltered ? unfiltered.total : result.total;
  const label = countNoun(result.total, filtering);

  return (
    <main>
      <JsonLd data={homeJsonLd()} />
      <JsonLd data={itemListJsonLd("All job openings", `${SITE_URL}/`, result.jobs)} />
      <div className="content">
        <section className="hero" aria-labelledby="page-heading">
          <h1 id="page-heading">{H1}</h1>
          <p className="hero-note">Independent job board. Not affiliated with any government or employer.</p>
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
        <SignupForm consent={alertConsentLabel()} sender={alertConsentSender()} />

        <section className="job-page home-openings" aria-labelledby="listings-heading">
          <OpeningsBrowser
            filters={filters}
            facets={facets}
            jobs={result.jobs}
            total={result.total}
            member={member}
            applied={appliedSet}
            preview={preview}
            action="/"
            place="home"
            titleTag="h2"
            listId="job-list"
          />
        </section>
      </div>
    </main>
  );
}
