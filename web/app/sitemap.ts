import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/seo";
import { listEmployers, sitemapJobs } from "@/lib/store";
import { torontoToday } from "@/lib/text";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const today = torontoToday();
  const [jobs, employers] = await Promise.all([sitemapJobs(today), listEmployers(today)]);
  const staticPaths = ["/", "/privacy/", "/about/", "/faq/", "/employers/", "/terms/", "/match/", "/jobs/", "/pricing/"];
  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${origin}${path}`,
    lastModified: today,
  }));
  for (const employer of employers) {
    entries.push({ url: `${origin}/employers/${employer.slug}/`, lastModified: today });
  }
  for (const job of jobs) {
    const path = job.path.endsWith("/") ? job.path : `${job.path}/`;
    entries.push({ url: `${origin}/${path.replace(/^\//, "")}`, lastModified: job.lastmod });
  }
  return entries;
}
