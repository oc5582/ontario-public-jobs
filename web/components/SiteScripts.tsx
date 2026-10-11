"use client";

import { usePathname } from "next/navigation";

export function SiteScripts() {
  const raw = (usePathname() || "/").replace(/\/$/, "") || "/";
  const path = raw.startsWith("/dynamic") ? raw.slice("/dynamic".length) || "/" : raw;
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const onHome = path === "/";
  return (
    <>
      <script src="/nav.js" />
      {onHome ? (
        <>
          <script src="/signup.config.js" />
          <script src="/copy.js" />
          <script src="/app.js" />
        </>
      ) : null}
      {path === "/match" ? <script src="/match.js" /> : null}
      {pixel ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `document.addEventListener("click",function(event){var el=event.target;var link=el&&el.closest?el.closest("a.apply-btn"):null;if(!link||typeof fbq!=="function")return;fbq("trackCustom","ApplyClick");});`,
          }}
        />
      ) : null}
    </>
  );
}
