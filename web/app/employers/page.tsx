import type { Metadata } from "next";
import { InfoArticle, JsonLd } from "@/components/ui";
import { pageMeta, siteOrigin } from "@/lib/seo";
import { listEmployers } from "@/lib/store";

export const metadata: Metadata = pageMeta({
  title: "Employers | PublicJobs.ca",
  description:
    "The full list of public employers in Toronto and the GTA whose current job openings PublicJobs.ca collects. You apply on each employer's own website.",
  path: "/employers/",
});

export default async function EmployersPage() {
  const employers = await listEmployers();
  const items = employers
    .map(
      (employer) =>
        `            <li><a href="/employers/${employer.slug}/">${escapeHtml(employer.name)}</a></li>`,
    )
    .join("\n");
  const html = `          <p>PublicJobs.ca collects current job openings from these public employers in Toronto and the GTA. You apply on each employer's own website. We are independent and not affiliated with any of them.</p>
          <p><a href="/jobs/">Browse all current openings</a></p>
          <ul class="employer-list">
${items}
          </ul>`;
  const origin = siteOrigin();
  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Employers we list jobs from",
    url: `${origin}/employers/`,
    numberOfItems: employers.length,
    itemListElement: employers.map((employer, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Organization",
        name: employer.name,
        url: `${origin}/employers/${employer.slug}/`,
      },
    })),
  };
  return (
    <>
      <JsonLd data={ld} />
      <InfoArticle heading="Employers we list jobs from" html={html} current="employers" />
    </>
  );
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
