import { DataReportView } from "@/components/DataReportView";
import { JsonLd } from "@/components/JsonLd";
import {
  DATA_HUB_PATH,
  DATA_REPORTS,
  brokenGuideLinks,
  dataReportBySlug,
  dataReportPath,
  readDatasetJsonLd,
  readFaqJsonLd,
  readReportMarkdown,
  reportFaq,
} from "@/lib/data-reports";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { parseReportMarkdown } from "@/lib/report-markdown";
import { pageMetadata } from "@/lib/seo";
import { BRAND, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return DATA_REPORTS.map((report) => ({ slug: report.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const report = dataReportBySlug(slug);
  if (!report) return { title: "Page not found" };
  return pageMetadata({
    title: `${report.title} | ${BRAND}`,
    description: report.description,
    path: dataReportPath(report.slug),
    type: "article",
  });
}

export default async function DataReportPage({ params }: Props) {
  const { slug } = await params;
  const report = dataReportBySlug(slug);
  if (!report) notFound();
  const faq = reportFaq(report);
  const broken = brokenGuideLinks(faq);
  if (broken.length) {
    throw new Error(`FAQ answers link to guides that are not on the site: ${broken.join(", ")}`);
  }
  const blocks = parseReportMarkdown(readReportMarkdown(report), { hasFaq: faq.length > 0 });
  const faqLd = faq.length ? readFaqJsonLd(report) : null;
  if (faq.length && !faqLd) {
    throw new Error(`Missing FAQPage JSON-LD for ${report.slug}`);
  }
  return (
    <main>
      <link rel="stylesheet" href="/pages.css" />
      <JsonLd data={readDatasetJsonLd(report)} />
      {faqLd ? <JsonLd data={faqLd} /> : null}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "All openings", url: `${SITE_URL}/` },
          { name: "Data", url: `${SITE_URL}${DATA_HUB_PATH}` },
          { name: report.title, url: `${SITE_URL}${dataReportPath(report.slug)}` },
        ])}
      />
      <DataReportView report={report} blocks={blocks} faq={faq} />
    </main>
  );
}
