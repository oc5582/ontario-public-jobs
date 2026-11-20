import { JsonLd } from "@/components/JsonLd";
import { DATA_HUB_PATH, DATA_REPORTS, dataReportPath } from "@/lib/data-reports";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { BRAND, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: `Data | ${BRAND}`,
  description:
    "Downloadable snapshots of open public-sector jobs tracked by PublicJobs.ca, with counts, salaries, and CSV, JSON, and Excel files.",
  path: DATA_HUB_PATH,
});

export default function DataHubPage() {
  return (
    <main>
      <link rel="stylesheet" href="/pages.css" />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "All openings", url: `${SITE_URL}/` },
          { name: "Data", url: `${SITE_URL}${DATA_HUB_PATH}` },
        ])}
      />
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>Data</h1>
        <section className="description">
          <p>
            Snapshots of open public-sector jobs tracked by PublicJobs.ca. Each report is a page you can read,
            with the same tables as CSV, JSON, and Excel.
          </p>
          <ul className="employer-list">
            {DATA_REPORTS.map((report) => (
              <li key={report.slug}>
                <a href={dataReportPath(report.slug)}>{report.title}</a>
                <p>{report.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
