import { JobsView } from "@/components/views/JobsView";
import { getViewer } from "@/lib/auth";
import { filtersFromSearch, hasFilters, hasPageParam, searchWithoutPage } from "@/lib/filters";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/site";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const filters = filtersFromSearch(params);
  const filtering = hasFilters(filters);
  return pageMetadata({
    title: `All job openings | ${BRAND}`,
    description: filtering
      ? "Filtered public-sector job openings in Toronto and the GTA listed on PublicJobs.ca."
      : "Every current public-sector job opening in Toronto and the GTA listed on PublicJobs.ca.",
    path: "/jobs/",
    index: !filtering,
  });
}

export default async function LiveJobsPage({ searchParams }: Props) {
  const params = await searchParams;
  if (hasPageParam(params)) {
    const query = searchWithoutPage(params);
    redirect(query ? `/jobs/?${query}` : "/jobs/");
  }
  const filters = filtersFromSearch(params);
  const viewer = await getViewer();
  return <JobsView filters={filters} member={viewer.isMember} />;
}
