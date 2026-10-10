import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteScripts } from "@/components/SiteScripts";
import { BRAND, META_DESCRIPTION, PAGE_TITLE, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

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

function Tracking() {
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;
  if (!pixel && !token) return null;
  return (
    <>
      {pixel ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
function load(){if(load.done)return;load.done=!0;
s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
if(b.readyState==='complete')load();else f.addEventListener('load',load)
}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(pixel)});
fbq('track', 'PageView');`,
          }}
        />
      ) : null}
      {token ? (
        <script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={JSON.stringify({ token })}
        />
      ) : null}
    </>
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
        <Tracking />
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <SiteScripts />
      </body>
    </html>
  );
}
