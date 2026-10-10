import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { siteOrigin } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: "PublicJobs.ca",
  verification: { google: "snN0wTgRbpJxtyxaevQl1EQhaPh61CSRjOeVh7IjMQY" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/ibm-plex-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="/pages.css" />
        <link rel="stylesheet" href="/extras.css" />
      </head>
      <body>
        {children}
        <script src="/nav.js" defer />
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;
          function load(){if(load.done)return;load.done=!0;
          s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
          if(b.readyState==='complete')load();else f.addEventListener('load',load)
          }(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '4654096711502773');
          fbq('track', 'PageView');
        `}</Script>
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          strategy="afterInteractive"
          data-cf-beacon='{"token": "b81ee0dcc95347e882d5e0a43124f360"}'
        />
      </body>
    </html>
  );
}
