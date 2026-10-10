import { torontoTodayIso } from "@/lib/format";
import { sitemapEmployers, sitemapJobs } from "@/lib/jobs";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

function urlNode(loc: string, lastmod: string): string {
  const locXml = `  <url><loc>${escapeXml(loc)}</loc>`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) return `${locXml}<lastmod>${lastmod}</lastmod></url>`;
  return `${locXml}</url>`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET() {
  const today = torontoTodayIso();
  const [jobs, employers] = await Promise.all([sitemapJobs(), sitemapEmployers()]);
  const staticPaths = ["/", "/jobs/", "/employers/", "/match/", "/pricing/", "/about/", "/faq/", "/privacy/", "/terms/"];
  const lines = [
    ...staticPaths.map((path) => urlNode(`${SITE_URL}${path}`, today)),
    ...employers.map((slug) => urlNode(`${SITE_URL}/employers/${slug}/`, today)),
    ...jobs.map((job) => {
      const path = job.path.endsWith("/") ? job.path : `${job.path}/`;
      return urlNode(`${SITE_URL}/${path.replace(/^\//, "")}`, (job.lastmod || "").slice(0, 10));
    }),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
