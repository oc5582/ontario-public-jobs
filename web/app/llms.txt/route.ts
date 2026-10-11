import { englishList } from "@/lib/format";
import { listingFacts } from "@/lib/jobs";
import { LEGAL } from "@/lib/legal-config";
import { SITE_URL } from "@/lib/site";

export const revalidate = 900;

export async function GET() {
  const facts = await listingFacts();
  const sources = englishList(facts.sources);
  const body = `# PublicJobs.ca

> Independent job board for government and public-sector openings in Toronto and the GTA. Run by Osama Chaudhary. Not affiliated with any government or listed employer.

PublicJobs.ca lists current openings collected from employers' public career sites. The listings file records the system each posting came from: ${sources}. The site does not take applications. Each job page links to the employer's posting, and you apply there. Job pages are free and need no account.

Lists on the homepage, /jobs/, and employer pages show the newest 10 openings to visitors who are not members, plus the total. The rest of a filtered list is a membership: CA$14.99 a month, CA$29.99 every 3 months (about CA$10 a month), or CA$59 a year (about CA$4.92 a month), plus applicable GST/HST. Memberships are sold in Canada only. A full refund is available within 5 days of the first purchase and of each renewal, once per account in any 12 months. Weekly email alerts stay free. Match your resume at /match/ compares a resume with current openings and shows suggestions, which can be wrong. The resume is not stored. Sign in to use it. One match is free and shows the top 5 jobs. A membership includes more matches, up to 20 a day. Matching does not require the weekly email.

A posting whose closing date has passed stays on its own page, marked no longer available, and is left off the homepage, /jobs/, and the employer pages. Closed jobs are not in the sitemap.

Listings are refreshed every weekday. ${facts.fetched} Contact: ${LEGAL.supportEmail}.

## Pages

- [Home](${SITE_URL}/): Newest openings, with search by job title and employer. Visitors see 10. Members see the filtered list.
- [All openings](${SITE_URL}/jobs/): Current openings. Visitors see the newest 10. Members see the full filtered list.
- [Employers](${SITE_URL}/employers/): Public employers, each with a page of its current openings.
- [Match your resume](${SITE_URL}/match/): Compare a resume with current openings. The resume is not stored. Sign in to use it. One match is free and shows the top 5 jobs. Members can match up to 20 times a day.
- [Membership](${SITE_URL}/pricing/): Prices plus applicable GST/HST, and the cancel and 5-day refund terms.
- [About](${SITE_URL}/about/): Who runs the site, what it covers, how listings are collected, and how often they are updated.
- [FAQ](${SITE_URL}/faq/): Answers to common questions about the site.
- [Sitemap](${SITE_URL}/sitemap.xml): Published URLs. Job pages that are still open, employer pages, and the static pages. Not filtered list URLs.

## Optional

- [Privacy](${SITE_URL}/privacy/): What personal information the site collects and how email alerts and accounts work.
- [Terms](${SITE_URL}/terms/): Terms of use.
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400",
    },
  });
}
