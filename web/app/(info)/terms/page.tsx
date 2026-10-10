import { JsonLd } from "@/components/JsonLd";
import { LegalTodo } from "@/components/LegalTodo";
import { readContent } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { BRAND, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";

const DESCRIPTION =
  "Terms for using PublicJobs.ca, an independent job board. Listings come from employers' public career sites, and you apply on the employer's site.";

export const metadata: Metadata = pageMetadata({
  title: `Terms of use | ${BRAND}`,
  description: DESCRIPTION,
  path: "/terms/",
});

export default function TermsPage() {
  const html = readContent("terms-body.html");
  return (
    <main>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Terms of use",
          url: `${SITE_URL}/terms/`,
          description: DESCRIPTION,
        }}
      />
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>Terms of use</h1>
        <section className="description" dangerouslySetInnerHTML={{ __html: html }} />
        <LegalTodo page="terms" />
      </article>
    </main>
  );
}
