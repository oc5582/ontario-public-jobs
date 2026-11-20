import { DATA_HUB_PATH, DATA_REPORTS, dataHubLastmod, dataReportPath } from "@/lib/data-reports";
import { torontoTodayIso } from "@/lib/format";
import { listingLastmod, sitemapEmployers, sitemapJobs } from "@/lib/jobs";
import { LEGIT_PATH, LEGIT_PUBLISHED } from "@/lib/legit";
import { SITE_URL } from "@/lib/site";
import { sitemapLastmod, STATIC_LASTMOD } from "@/lib/sitemap-dates";
import { GUIDES, guidePath } from "@/lib/guides";

export const revalidate = 900;

function urlNode(loc: string, lastmod: string, today: string): string {
  const locXml = `  <url><loc>${escapeXml(loc)}</loc>`;
  const date = sitemapLastmod(lastmod, today);
  if (date) return `${locXml}<lastmod>${date}</lastmod></url>`;
  return `${locXml}</url>`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// /start/ is an ad landing quiz. It is noindex and intentionally absent here.
const STATIC_PATHS = ["/", "/jobs/", "/employers/", "/match/", "/pricing/", "/about/", "/faq/", "/stats/", "/privacy/", "/terms/"];
const LISTING_PATHS = new Set(["/", "/jobs/", "/employers/", "/stats/"]);

export async function GET() {
  const today = torontoTodayIso();
  const [jobs, employers, listing] = await Promise.all([sitemapJobs(), sitemapEmployers(), listingLastmod()]);
  const guidesUpdated = GUIDES.reduce((latest, guide) => (guide.updated > latest ? guide.updated : latest), "");
  const lines = [
    ...STATIC_PATHS.map((path) => {
      const lastmod = LISTING_PATHS.has(path) ? listing : STATIC_LASTMOD[path] || "";
      return urlNode(`${SITE_URL}${path}`, lastmod, today);
    }),
    urlNode(`${SITE_URL}${LEGIT_PATH}`, LEGIT_PUBLISHED, today),
    ...employers.map((employer) => urlNode(`${SITE_URL}/employers/${employer.slug}/`, employer.lastmod, today)),
    ...jobs.map((job) => {
      const path = job.path.endsWith("/") ? job.path : `${job.path}/`;
      return urlNode(`${SITE_URL}/${path.replace(/^\//, "")}`, (job.lastmod || "").slice(0, 10), today);
    }),
    urlNode(`${SITE_URL}/guides/`, guidesUpdated, today),
    ...GUIDES.map((guide) => urlNode(`${SITE_URL}${guidePath(guide.slug)}`, guide.updated, today)),
    urlNode(`${SITE_URL}${DATA_HUB_PATH}`, dataHubLastmod(), today),
    ...DATA_REPORTS.map((report) => urlNode(`${SITE_URL}${dataReportPath(report.slug)}`, report.published, today)),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400",
    },
  });
}
