"use client";

import { OpeningsBrowser } from "@/components/OpeningsBrowser";
import { SearchField } from "@/components/SearchField";
import { queryFromFilters, type JobFilters } from "@/lib/filters";
import { countNoun } from "@/lib/format";
import type { PaywallPlace, PaywallPreview } from "@/lib/paywall";
import type { Facets, ListJob } from "@/lib/types";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Results = {
  jobs: ListJob[];
  total: number;
  preview: PaywallPreview | null;
  q: string;
};

type SearchResponse = {
  jobs?: ListJob[];
  total?: number;
  preview?: PaywallPreview | null;
};

type HomeSearchValue = {
  filters: JobFilters;
  facets: Facets;
  member: boolean;
  appliedKeys?: string[];
  results: Results;
  submitQuery: (query: string) => void;
};

const HomeSearchContext = createContext<HomeSearchValue | null>(null);

function useHomeSearch(): HomeSearchValue {
  const value = useContext(HomeSearchContext);
  if (!value) throw new Error("Home search is missing its provider");
  return value;
}

function activeFilters(filters: JobFilters, q: string): JobFilters {
  return { ...filters, q };
}

/** Keep the filter form's search box on the same query without resetting its other fields. */
function syncFilterQuery(query: string) {
  const field = document.getElementById("f-q");
  if (field instanceof HTMLInputElement && document.activeElement !== field) field.value = query;
}

/**
 * Update the address bar without a Next.js navigation.
 * Next.js wraps history.replaceState and, unless the state is marked as its own,
 * restores the router — which swaps the cached page for the dynamic one and
 * unmounts the search box. Marking __NA keeps the URL change local.
 */
function replaceQuery(url: string) {
  const current = window.history.state;
  const state =
    current && typeof current === "object" ? { ...current, __NA: true } : { __NA: true };
  window.history.replaceState(state, "", url);
}

export function HomeSearchProvider({
  filters,
  facets,
  jobs,
  total,
  preview,
  member,
  appliedKeys,
  children,
}: {
  filters: JobFilters;
  facets: Facets;
  jobs: ListJob[];
  total: number;
  preview: PaywallPreview | null;
  member: boolean;
  appliedKeys?: string[];
  children: ReactNode;
}) {
  const [results, setResults] = useState<Results>({ jobs, total, preview, q: filters.q });
  const request = useRef(0);

  const submitQuery = useCallback((query: string) => {
    const params = new URLSearchParams(window.location.search);
    if (query) params.set("q", query);
    else params.delete("q");
    params.delete("page");
    const qs = params.toString();
    const path = window.location.pathname || "/";
    replaceQuery(qs ? `${path}?${qs}` : path);
    syncFilterQuery(query);

    const id = ++request.current;
    const url = qs ? `/api/jobs/?${qs}` : "/api/jobs/";
    fetch(url, { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as SearchResponse;
      })
      .then((data) => {
        if (!data || id !== request.current) return;
        setResults({
          jobs: Array.isArray(data.jobs) ? data.jobs : [],
          total: typeof data.total === "number" ? data.total : 0,
          preview: data.preview ?? null,
          q: query,
        });
      })
      .catch(() => {
        // The field already shows what was typed. A refresh loads it from the URL.
      });
  }, []);

  const value: HomeSearchValue = {
    filters,
    facets,
    member,
    appliedKeys,
    results,
    submitQuery,
  };

  return <HomeSearchContext.Provider value={value}>{children}</HomeSearchContext.Provider>;
}

export function ListingsCount() {
  const { filters, results } = useHomeSearch();
  const filtering = Boolean(queryFromFilters(activeFilters(filters, results.q)));
  return (
    <div className="count-block" aria-live="polite">
      <p className="count-number" id="listings-count">
        {results.total}
      </p>
      <p className="count-label" id="listings-count-label">
        {countNoun(results.total, filtering)}
      </p>
    </div>
  );
}

export function HomeSearchField() {
  const { filters, submitQuery } = useHomeSearch();
  return <SearchField initial={filters.q} onSearch={submitQuery} />;
}

export function LiveOpenings({
  action,
  place,
  titleTag,
  showCrumb = false,
  listId,
}: {
  action: string;
  place: PaywallPlace;
  titleTag: "h1" | "h2";
  showCrumb?: boolean;
  listId?: string;
}) {
  const { filters, facets, results, member, appliedKeys } = useHomeSearch();
  const current = activeFilters(filters, results.q);

  useEffect(() => {
    syncFilterQuery(results.q);
  }, [results.q]);

  return (
    <OpeningsBrowser
      filters={current}
      facets={facets}
      jobs={results.jobs}
      total={results.total}
      member={member}
      applied={appliedKeys ? new Set(appliedKeys) : undefined}
      preview={results.preview}
      action={action}
      place={place}
      titleTag={titleTag}
      showCrumb={showCrumb}
      listId={listId}
    />
  );
}
