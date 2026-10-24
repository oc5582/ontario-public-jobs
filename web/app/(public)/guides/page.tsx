import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { GUIDES, GUIDES_NAME, formatGuideDate, guidePath } from "@/lib/guides";
import { pageMetadata } from "@/lib/seo";
import { BRAND, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: `${GUIDES_NAME} | ${BRAND}`,
  description:
    "Plain guides to applying for public-sector jobs in Toronto and the GTA: hiring steps, requirements, and where to apply.",
  path: "/guides/",
});

export default function GuidesPage() {
  return (
    <main>
      <link rel="stylesheet" href="/pages.css" />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "All openings", url: `${SITE_URL}/` },
          { name: "Guides", url: `${SITE_URL}/guides/` },
        ])}
      />
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>{GUIDES_NAME}</h1>
        <section className="description">
          <p>
            How public employers in Toronto and the GTA hire, what they ask for, and where you apply. Each guide
            links to its sources and says when the facts were last checked.
          </p>
          <ul className="employer-list guide-list">
            {GUIDES.map((guide) => (
              <li key={guide.slug}>
                <a href={guidePath(guide.slug)}>{guide.title}</a>
                <p>
                  {guide.description} {formatGuideDate(guide.published)}.
                </p>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
