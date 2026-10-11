import { EmployerView } from "@/components/views/EmployerView";
import { emptyFilters } from "@/lib/filters";
import { employerBySlug, searchJobs } from "@/lib/jobs";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/site";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 900;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const employer = await employerBySlug(slug);
  if (!employer) return { title: "Page not found" };
  const result = await searchJobs({ ...emptyFilters(), employer: slug }, false);
  const noun = result.total === 1 ? "opening" : "openings";
  const description = result.total
    ? `${result.total} current ${employer.name} ${noun} listed on PublicJobs.ca. You apply on the employer's own website.`
    : `No current ${employer.name} openings on PublicJobs.ca. You apply on the employer's own website when a job is posted.`;
  return pageMetadata({
    title: `${employer.name} jobs | ${BRAND}`,
    description,
    path: `/employers/${slug}/`,
  });
}

export default async function EmployerPage({ params }: Props) {
  const { slug } = await params;
  return <EmployerView filters={{ ...emptyFilters(), employer: slug }} member={false} />;
}
