import { EmployerView } from "@/components/views/EmployerView";
import { getViewer } from "@/lib/auth";
import { filtersFromSearch, hasFilters, hasPageParam, searchWithoutPage } from "@/lib/filters";
import { employerBySlug, searchJobs } from "@/lib/jobs";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/site";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const employer = await employerBySlug(slug);
  if (!employer) return { title: "Page not found" };
  const filters = { ...filtersFromSearch(query), employer: slug };
  const filtering = hasFilters({ ...filters, employer: "" });
  const result = await searchJobs(filters, false);
  const noun = result.total === 1 ? "opening" : "openings";
  const description = result.total
    ? `${result.total} current ${employer.name} ${noun} listed on PublicJobs.ca. You apply on the employer's own website.`
    : `No current ${employer.name} openings on PublicJobs.ca. You apply on the employer's own website when a job is posted.`;
  return pageMetadata({
    title: `${employer.name} jobs | ${BRAND}`,
    description,
    path: `/employers/${slug}/`,
    index: !filtering,
  });
}

export default async function LiveEmployerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  if (hasPageParam(query)) {
    const rest = searchWithoutPage(query);
    redirect(rest ? `/employers/${slug}/?${rest}` : `/employers/${slug}/`);
  }
  const employer = await employerBySlug(slug);
  if (!employer) notFound();
  const viewer = await getViewer();
  return <EmployerView filters={{ ...filtersFromSearch(query), employer: slug }} member={viewer.isMember} />;
}
