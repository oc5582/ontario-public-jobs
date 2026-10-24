import { EmployerView, employerMetadata } from "@/components/views/EmployerView";
import { LIST_FILTER_KEYS } from "@/lib/cache-paths";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return employerMetadata(slug);
}

export default async function LiveEmployerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  if (LIST_FILTER_KEYS.some((key) => Object.prototype.hasOwnProperty.call(query, key))) {
    redirect(`/employers/${slug}/`);
  }
  return <EmployerView slug={slug} />;
}
