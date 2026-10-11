import { JobView, jobMetadata } from "@/components/views/JobView";
import type { Metadata } from "next";

type Props = { params: Promise<{ employer: string; slug: string }> };

export const revalidate = 900;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { employer, slug } = await params;
  return jobMetadata(employer, slug);
}

export default async function JobPage({ params }: Props) {
  const { employer, slug } = await params;
  return <JobView employer={employer} slug={slug} />;
}
