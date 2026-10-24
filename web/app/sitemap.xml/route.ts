import { sitemapEmployers, sitemapJobs } from "@/lib/jobs";
import { SITE_URL } from "@/lib/site";
import { GUIDES, guidePath } from "@/lib/guides";

export const revalidate = 900;

function urlNode(loc: string, lastmod: string): string {
  const locXml = `  <url><loc>${escapeXml(loc)}</loc>`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) return `${locXml}<lastmod>${lastmod}</lastmod></url>`;
  return `${locXml}</url>`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET() {
  const [jobs, employers] = await Promise.all([sitemapJobs(), sitemapEmployers()]);
  const staticPaths = ["/", "/jobs/", "/employers/", "/match/", "/pricing/", "/about/", "/faq/", "/stats/", "/privacy/", "/terms/"];
  const lines = [
    ...staticPaths.map((path) => urlNode(`${SITE_URL}${path}`, "")),
    ...employers.map((slug) => urlNode(`${SITE_URL}/employers/${slug}/`, "")),
    ...jobs.map((job) => {
      const path = job.path.endsWith("/") ? job.path : `${job.path}/`;
      return urlNode(`${SITE_URL}/${path.replace(/^\//, "")}`, (job.lastmod || "").slice(0, 10));
    }),
    urlNode(`${SITE_URL}/guides/`, GUIDES[0]?.published || ""),
    ...GUIDES.map((guide) => urlNode(`${SITE_URL}${guidePath(guide.slug)}`, guide.updated)),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400",
    },
  });
}
