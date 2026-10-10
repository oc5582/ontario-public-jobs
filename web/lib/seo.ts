import type { Metadata } from "next";

export const BRAND = "PublicJobs.ca";
export const OG_ALT = "PublicJobs.ca: government jobs in Toronto and the GTA";

export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://publicjobs.ca").replace(/\/$/, "");
}

export function pageMeta(input: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  const origin = siteOrigin();
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const url = path === "/" ? `${origin}/` : `${origin}${path.endsWith("/") ? path : `${path}/`}`;
  return {
    title: input.title,
    description: input.description,
    robots: input.noindex ? { index: false, follow: true } : { index: true, follow: true },
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: BRAND,
      type: "website",
      images: [{ url: `${origin}/og-image.png`, width: 1200, height: 630, alt: OG_ALT }],
    },
  };
}
