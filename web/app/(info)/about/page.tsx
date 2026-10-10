import { readContent } from "@/lib/content";
import { englishList } from "@/lib/format";
import { listingFacts } from "@/lib/jobs";
import { pageMetadata } from "@/lib/seo";
import { BRAND } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  title: `About | ${BRAND}`,
  description:
    "PublicJobs.ca is an independent job board run by Osama Chaudhary. It lists current openings from public employers in Toronto and the GTA.",
  path: "/about/",
});

export default async function AboutPage() {
  const facts = await listingFacts();
  const html = readContent("about-body.html")
    .replace("{{SOURCES}}", englishList(facts.sources))
    .replace("{{FETCHED}}", facts.fetched);
  return (
    <main>
      <article className="job-page content">
        <p className="crumb">
          <a href="/">All openings</a>
        </p>
        <h1>About PublicJobs.ca</h1>
        <section className="description" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </main>
  );
}
