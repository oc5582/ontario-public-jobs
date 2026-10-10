import type { Metadata } from "next";
import { BRAND, SITE_URL } from "./site";

const OG_ALT = "PublicJobs.ca: government jobs in Toronto and the GTA";

export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
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
      type: "website",
      siteName: BRAND,
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: OG_ALT }],
    },
    ...(index ? {} : { robots: { index: false, follow: true } }),
  };
}
