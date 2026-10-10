import { JsonLd } from "@/components/JsonLd";
import { listEmployers } from "@/lib/jobs";
import { pageMetadata } from "@/lib/seo";
import { BRAND, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: `Employers | ${BRAND}`,
  description:
    "The full list of public employers in Toronto and the GTA whose current job openings PublicJobs.ca collects. You apply on each employer's own website.",
  path: "/employers/",
});

export default async function EmployersPage() {
  const employers = await listEmployers();
  const names = employers.map((employer) => employer.name);
  return (
    <main>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Employers we list jobs from",
          url: `${SITE_URL}/employers/`,
          numberOfItems: names.length,
          itemListElement: names.map((name, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: { "@type": "Organization", name },
          })),
        }}
      />
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>Employers we list jobs from</h1>
        <section className="description">
          <p>
            PublicJobs.ca collects current job openings from these public employers in Toronto and the GTA. You apply
            on each employer&apos;s own website. We are independent and not affiliated with any of them.
          </p>
          <p>
            <a href="/jobs/">Browse all current openings</a>
          </p>
          <ul className="employer-list">
            {employers.map((employer) => (
              <li key={employer.slug}>
                <a href={`/employers/${employer.slug}/`}>{employer.name}</a>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
