import type { Metadata } from "next";
import { SignupForm } from "@/components/signup-form";
import { FilterBar, HeroSearch, JobList, JsonLd, SiteFooter, SiteHeader, UnlockCard } from "@/components/ui";
import { filtersActive, readFilters, type SearchParams } from "@/lib/filters";
import { memberState } from "@/lib/member";
import { pageMeta } from "@/lib/seo";
import { filterChoices, searchJobs } from "@/lib/store";
import { websiteJsonLd } from "@/lib/jsonld";
import { siteOrigin } from "@/lib/seo";

const TITLE = "Independent job board for government jobs in Toronto and the GTA | PublicJobs.ca";
const DESCRIPTION =
  "City of Toronto, TTC, Metrolinx, Toronto Hydro, OLG and more than 60 other public employers in Toronto and the GTA, each hiring on its own website. Their openings, collected in one place.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  return pageMeta({ title: TITLE, description: DESCRIPTION, path: "/", noindex: filtersActive(sp) });
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = readFilters(sp);
  const member = await memberState();
  const [{ total, jobs }, choices] = await Promise.all([
    searchJobs(filters, member.member),
    filterChoices(),
  ]);
  const label = total === 1 ? "opening" : "openings";
  return (
    <>
      <JsonLd data={websiteJsonLd(siteOrigin())} />
      <SiteHeader />
      <main>
        <div className="content">
          <section className="hero" aria-labelledby="page-heading">
            <h1 id="page-heading">Independent job board for government jobs in Toronto and the GTA</h1>
            <p className="subhead">
              City of Toronto, TTC, Metrolinx, Toronto Hydro, OLG and more than 60 other public employers in Toronto and the GTA.
            </p>
            <div className="listings-toolbar">
              <div className="count-block" aria-live="polite">
                <p className="count-number" id="listings-count">
                  {total}
                </p>
                <p className="count-label" id="listings-count-label">
                  {label}
                </p>
              </div>
              <HeroSearch sp={sp} filters={filters} />
            </div>
          </section>
          <MatchPromo count={total} />
          <SignupForm />
          <section className="listings" aria-labelledby="listings-heading">
            <h2 id="listings-heading">Current openings</h2>
            <p className="listings-index">
              <a href="/jobs/">
                Browse all {total} {label}
              </a>
            </p>
            <FilterBar action="/" filters={filters} choices={choices} sp={sp} />
            {jobs.length === 0 ? <p className="listings-empty">No openings match that search.</p> : <JobList jobs={jobs} />}
            {member.member ? (
              <p className="member-note">Showing all {total} {label}.</p>
            ) : (
              <UnlockCard total={total} shown={jobs.length} />
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function MatchPromo({ count }: { count: number }) {
  const noun = count === 1 ? "opening" : "openings";
  const lead = `Upload your resume and we'll check it against all ${count} ${noun}. You get your best matches, each with a reason why it fits.`;
  const steps = ["Upload your resume", "We check every opening", "See your matches"];
  return (
    <section className="match-promo" aria-labelledby="match-promo-heading">
      <div className="match-promo-panel">
        <div className="match-promo-copy">
          <p className="match-promo-kicker">New on PublicJobs.ca</p>
          <h2 id="match-promo-heading">See which jobs fit your resume</h2>
          <p className="match-promo-lead b2-desktop">{lead}</p>
          <p className="match-promo-lead b2-phone">Get your best matches from every opening, with a reason for each.</p>
          <a className="match-promo-btn" href="/match/">
            Match my resume
          </a>
          <p className="match-promo-fine b2-desktop">Free, up to 3 matches. Needs your email for job alerts. Your resume is not stored.</p>
          <p className="match-promo-fine b2-phone">Free, up to 3 matches.</p>
        </div>
        <ol className="match-promo-steps">
          {steps.map((step, index) => (
            <li key={step}>
              <span className="match-promo-num" aria-hidden="true">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
