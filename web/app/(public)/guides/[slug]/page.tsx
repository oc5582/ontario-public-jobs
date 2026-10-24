import { JsonLd } from "@/components/JsonLd";
import { SignupForm } from "@/components/SignupForm";
import { GUIDES, formatGuideDate, guideBody, guideBySlug, guideImage, guideJsonLd, guidePath } from "@/lib/guides";
import { LEGAL } from "@/lib/legal-config";
import { alertConsentLabel, alertConsentSender } from "@/lib/legal-copy";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/site";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) return { title: "Page not found" };
  return pageMetadata({
    title: guide.seoTitle,
    description: guide.description,
    path: guidePath(guide.slug),
    type: "article",
    image: { url: guideImage(guide.slug), alt: `${guide.title}. A guide from ${BRAND}.` },
  });
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = guideBySlug(slug);
  if (!guide) notFound();
  const updated =
    guide.updated !== guide.published ? ` Updated ${formatGuideDate(guide.updated)}.` : "";
  return (
    <main>
      <link rel="stylesheet" href="/pages.css" />
      <JsonLd data={guideJsonLd(guide)} />
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
          {" / "}
          <a href="/guides/">Guides</a>
        </p>
        <h1>{guide.title}</h1>
        <p className="employer">
          By <a href="/about/">{LEGAL.legalName}</a>. Published {formatGuideDate(guide.published)}.{updated}
        </p>
        <section className="description guide-body" dangerouslySetInnerHTML={{ __html: guideBody(guide.slug) }} />
        <SignupForm consent={alertConsentLabel()} sender={alertConsentSender()} />
      </article>
    </main>
  );
}
