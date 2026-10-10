import type { Metadata } from "next";
import { FilterBar, JobList, SiteFooter, SiteHeader, UnlockCard } from "@/components/ui";
import { filtersActive, readFilters, type SearchParams } from "@/lib/filters";
import { memberState } from "@/lib/member";
import { pageMeta } from "@/lib/seo";
import { filterChoices, searchJobs } from "@/lib/store";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = filtersActive(sp);
  return pageMeta({
    title: "All job openings | PublicJobs.ca",
    description: "Every current public-sector job opening in Toronto and the GTA listed on PublicJobs.ca.",
    path: "/jobs/",
    noindex: filtered,
  });
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = readFilters(sp);
  const member = await memberState();
  const [{ total, jobs }, choices] = await Promise.all([searchJobs(filters, member.member), filterChoices()]);
  const noun = total === 1 ? "opening" : "openings";
  return (
    <>
      <SiteHeader />
      <main>
        <article className="job-page content">
          <p className="crumb">
            <a href="/">All openings</a>
          </p>
          <h1>All job openings</h1>
          <section className="description">
            <p>
              {total} current {noun} from public employers in Toronto and the GTA.
              {member.member ? ` Showing all ${total}.` : jobs.length ? ` Showing the ${jobs.length} newest.` : ""}
            </p>
          </section>
          <FilterBar action="/jobs/" filters={filters} choices={choices} sp={sp} includeSearch />
          {jobs.length === 0 ? <p className="listings-empty">No openings match that search.</p> : <JobList jobs={jobs} />}
          {member.member ? null : <UnlockCard total={total} shown={jobs.length} />}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
