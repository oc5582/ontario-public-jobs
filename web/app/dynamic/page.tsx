import { HomeView } from "@/components/views/HomeView";
import { getViewer } from "@/lib/auth";
import { filtersFromSearch, hasFilters, hasPageParam, searchWithoutPage } from "@/lib/filters";
import { pageMetadata } from "@/lib/seo";
import { BRAND, META_DESCRIPTION, PAGE_TITLE } from "@/lib/site";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const filters = filtersFromSearch(params);
  return pageMetadata({
    title: `${PAGE_TITLE} | ${BRAND}`,
    description: META_DESCRIPTION,
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
