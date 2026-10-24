import type { Metadata } from "next";
import { BRAND, SITE_URL } from "./site";

const OG_ALT = "PublicJobs.ca: government jobs in Toronto and the GTA";

export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  /** Share card for this page; defaults to the site og-image. */
  image?: { url: string; alt: string };
  type?: "website" | "article";
}): Metadata {
  const url = `${SITE_URL}${input.path}`;
  const index = input.index !== false;
  return {
    title: { absolute: input.title },
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      type: input.type || "website",
      siteName: BRAND,
      images: [
        input.image
          ? { url: `${SITE_URL}${input.image.url}`, width: 1200, height: 630, alt: input.image.alt }
          : { url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: OG_ALT },
      ],
    },
    ...(index ? {} : { robots: { index: false, follow: true } }),
  };
}
