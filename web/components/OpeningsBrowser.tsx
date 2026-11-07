import { FilterBar } from "@/components/FilterBar";
import { JobList } from "@/components/JobList";
import { UnlockCard } from "@/components/UnlockCard";
import type { JobFilters } from "@/lib/filters";
import { paywallFiltering, paywallFocus, type PaywallPlace, type PaywallPreview } from "@/lib/paywall";
import type { Facets, ListJob } from "@/lib/types";

function listIntro(total: number, shown: number, member: boolean): string {
  return member
    ? `${total} current openings from public employers in Toronto and the GTA. You are signed in, so this is the full list.`
    : `${total} current openings from public employers in Toronto and the GTA. Showing the newest ${shown}.`;
}

/** Filterable openings list shared by the homepage and /jobs/. */
export function OpeningsBrowser({
  filters,
  facets,
  jobs,
  total,
  member,
  applied,
  preview,
  action,
  place,
  titleTag,
  showCrumb = false,
  listId,
}: {
  filters: JobFilters;
  facets: Facets;
  jobs: ListJob[];
  total: number;
  member: boolean;
  applied?: ReadonlySet<string>;
  preview: PaywallPreview | null;
  action: string;
  place: PaywallPlace;
  titleTag: "h1" | "h2";
  showCrumb?: boolean;
  listId?: string;
}) {
  const Title = titleTag;
  const shown = jobs.length;

  return (
    <>
      {showCrumb ? (
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
      ) : null}
      <Title id={titleTag === "h2" ? "listings-heading" : undefined}>All job openings</Title>
      <section className="description">
        <p>{listIntro(total, shown, member)}</p>
      </section>
      <FilterBar action={action} filters={filters} facets={facets} />
      {total === 0 ? (
        <p className="listings-empty">No openings match that search.</p>
      ) : (
        <JobList jobs={jobs} id={listId} applied={member ? applied : undefined} />
      )}
      {member ? null : (
        <UnlockCard
          total={total}
          shown={shown}
          place={place}
          filtering={paywallFiltering(filters)}
          focus={paywallFocus(filters)}
          preview={preview}
        />
      )}
    </>
  );
}
