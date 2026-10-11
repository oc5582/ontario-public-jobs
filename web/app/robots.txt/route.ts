import { SITE_URL } from "@/lib/site";

export const revalidate = 900;

export function GET() {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /account",
    "Disallow: /login",
    "Disallow: /auth",
    "Disallow: /api",
    "Disallow: /checkout",
    "Disallow: /dynamic",
    "",
    "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400",
    },
  });
}
