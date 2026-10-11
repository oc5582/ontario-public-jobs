import { readContent } from "@/lib/content";
import { englishList } from "@/lib/format";
import { listingFacts } from "@/lib/jobs";
import { LEGAL, isPlaceholder } from "@/lib/legal-config";
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
  const contact = isPlaceholder(LEGAL.supportEmail)
    ? LEGAL.supportEmail
    : `<a href="mailto:${LEGAL.supportEmail}">${LEGAL.supportEmail}</a>`;
  const html =
    readContent("about-body.html")
      .replace("{{SOURCES}}", englishList(facts.sources))
      .replace("{{FETCHED}}", facts.fetched)
      .replace(/<a href="mailto:hello@publicjobs\.ca">hello@publicjobs\.ca<\/a>/g, contact) +
    `<h2>Contact</h2><p>PublicJobs.ca is operated by ${LEGAL.legalName}, a sole proprietor operating as ${LEGAL.businessName}, ${LEGAL.mailingAddress}. Phone <a href="${LEGAL.phoneTel}">${LEGAL.phone}</a>. Email ${contact}. GST/HST ${LEGAL.hstNumber}. The privacy officer is ${LEGAL.privacyOfficerName}.</p>` +
    `<h2>Accessibility</h2><p>If this site is hard to use, email ${contact}. Tell us the page and what got in the way.</p>`;
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
