import { listingLastmod, sitemapEmployers, sitemapJobs } from "@/lib/jobs";
import { LEGAL } from "@/lib/legal-config";
import { SITE_URL } from "@/lib/site";

export const revalidate = 900;

function urlNode(loc: string, lastmod: string): string {
  const locXml = `  <url><loc>${escapeXml(loc)}</loc>`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) return `${locXml}<lastmod>${lastmod}</lastmod></url>`;
  return `${locXml}</url>`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const STATIC_PATHS = ["/", "/jobs/", "/employers/", "/match/", "/pricing/", "/about/", "/faq/", "/stats/", "/privacy/", "/terms/"];
const LISTING_PATHS = new Set(["/", "/jobs/", "/employers/", "/stats/"]);

export async function GET() {
  const [jobs, employers, listing] = await Promise.all([sitemapJobs(), sitemapEmployers(), listingLastmod()]);
  const lines = [
    ...STATIC_PATHS.map((path) => {
      const lastmod = LISTING_PATHS.has(path) ? listing : path === "/privacy/" || path === "/terms/" ? LEGAL.termsVersion : "";
      return urlNode(`${SITE_URL}${path}`, lastmod);
    }),
    ...employers.map((employer) => urlNode(`${SITE_URL}/employers/${employer.slug}/`, employer.lastmod)),
    ...jobs.map((job) => {
      const path = job.path.endsWith("/") ? job.path : `${job.path}/`;
      return urlNode(`${SITE_URL}/${path.replace(/^\//, "")}`, (job.lastmod || "").slice(0, 10));
    }),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400",
    },
  });
}
