import { EmployerView, employerMetadata } from "@/components/views/EmployerView";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 900;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return employerMetadata(slug);
}

export default async function EmployerPage({ params }: Props) {
  const { slug } = await params;
  return <EmployerView slug={slug} />;
}
