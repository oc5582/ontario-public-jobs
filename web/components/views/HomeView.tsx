import { HomeSearchField, HomeSearchProvider, ListingsCount, LiveOpenings } from "@/components/HomeSearch";
import { JsonLd } from "@/components/JsonLd";
import { MatchPromo } from "@/components/MatchPromo";
import { SignupForm } from "@/components/SignupForm";
import { emptyFilters, queryFromFilters, type JobFilters } from "@/lib/filters";
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
        <JsonLd data={homeJsonLd()} />
        <JsonLd data={itemListJsonLd("All job openings", `${SITE_URL}/`, result.jobs)} />
        <div className="content">
          <section className="hero" aria-labelledby="page-heading">
            <h1 id="page-heading">{H1}</h1>
            <p className="hero-note">Independent job board. Not affiliated with any government or employer.</p>
            <p className="subhead">{SUBHEAD}</p>
            <div className="listings-toolbar">
              <ListingsCount />
              <HomeSearchField />
            </div>
          </section>

          <MatchPromo count={openTotal} />
          <SignupForm consent={alertConsentLabel()} sender={alertConsentSender()} />

          <section className="job-page home-openings" aria-labelledby="listings-heading">
            <LiveOpenings action="/" place="home" titleTag="h2" listId="job-list" />
          </section>
        </div>
      </main>
    </HomeSearchProvider>
  );
}
