import { HomeView } from "@/components/views/HomeView";
import { getViewer } from "@/lib/auth";
import { filtersFromSearch, hasFilters, hasPageParam, searchWithoutPage } from "@/lib/filters";
import { listingFacts } from "@/lib/jobs";
import { pageMetadata } from "@/lib/seo";
import { HOME_TITLE, homeCopy } from "@/lib/site";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const filters = filtersFromSearch(params);
  const facts = await listingFacts();
  const copy = homeCopy(facts.employerCount, facts.employerNames);
  return pageMetadata({
    title: HOME_TITLE,
    description: copy.description,
    path: "/",
    index: !hasFilters(filters),
  });
}

export default async function LiveHomePage({ searchParams }: Props) {
  const params = await searchParams;
  if (hasPageParam(params)) {
    const query = searchWithoutPage(params);
    redirect(query ? `/?${query}` : "/");
  }
  const filters = filtersFromSearch(params);
  const viewer = await getViewer();
  return <HomeView filters={filters} member={viewer.isMember} />;
}
