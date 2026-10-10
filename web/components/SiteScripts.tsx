import { headers } from "next/headers";

export async function SiteScripts() {
  const h = await headers();
  const path = (h.get("x-pathname") || "/").replace(/\/$/, "") || "/";
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  return (
    <>
      <script src="/nav.js" />
      {path === "/" ? (
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
