import { JsonLd } from "@/components/JsonLd";
import { faqEntities, readContent } from "@/lib/content";
import { listingFacts } from "@/lib/jobs";
import { pageMetadata } from "@/lib/seo";
import { BRAND, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";

const DESCRIPTION =
  "Answers about government jobs in Toronto: Crown corporations, Ontario provincial agencies, City of Toronto agencies, pensions, unions and who can apply.";

export const metadata: Metadata = pageMetadata({
  title: `Government and Crown corporation jobs in Toronto: FAQ | ${BRAND}`,
  description: DESCRIPTION,
  path: "/faq/",
});

export default async function FaqPage() {
  const facts = await listingFacts();
  const noun = facts.employerCount === 1 ? "public employer" : "public employers";
  const html = readContent("faq-body.html").replace("{{EMPLOYER_COUNT}}", `${facts.employerCount} ${noun}`);
  const entities = faqEntities(html);
  return (
    <main>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          name: "Frequently asked questions",
          url: `${SITE_URL}/faq/`,
          description: DESCRIPTION,
          mainEntity: entities.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>Frequently asked questions</h1>
        <section className="description" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </main>
  );
}
