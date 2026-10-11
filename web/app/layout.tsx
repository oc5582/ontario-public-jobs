import type { Metadata, Viewport } from "next";
import { AdNotice } from "@/components/AdNotice";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteScripts } from "@/components/SiteScripts";
import { BRAND, META_DESCRIPTION, PAGE_TITLE, SITE_URL } from "@/lib/site";

const OG_ALT = "PublicJobs.ca: government jobs in Toronto and the GTA";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { absolute: `${PAGE_TITLE} | ${BRAND}` },
  description: META_DESCRIPTION,
  applicationName: BRAND,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  verification: { google: "snN0wTgRbpJxtyxaevQl1EQhaPh61CSRjOeVh7IjMQY" },
  openGraph: {
    type: "website",
    siteName: BRAND,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: OG_ALT }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

function CloudflareAnalytics() {
  const token = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;
  if (!token) return null;
  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/ibm-plex-sans-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
          fetchPriority="high"
        />
        <link rel="stylesheet" href="/styles.css" />
        <CloudflareAnalytics />
      </head>
      <body>
        {children}
        <SiteFooter />
        <AdNotice pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID || ""} />
        <SiteScripts />
      </body>
    </html>
  );
}
