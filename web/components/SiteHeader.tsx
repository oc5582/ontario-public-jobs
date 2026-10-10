import { headers } from "next/headers";
import { getViewer } from "@/lib/auth";

function currentKey(pathname: string): string {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/match") return "match";
  if (path === "/employers" || path.startsWith("/employers/")) return "employers";
  if (path === "/about") return "about";
  if (path === "/faq") return "faq";
  if (path === "/privacy") return "privacy";
  if (path === "/terms") return "terms";
  if (path === "/pricing") return "pricing";
  if (path === "/account") return "account";
  if (path === "/login") return "login";
  return "";
}

export async function SiteHeader() {
  const h = await headers();
  const current = currentKey(h.get("x-pathname") || "/");
  const viewer = await getViewer();
  const accountHref = viewer.email ? "/account/" : "/login/";
  const accountLabel = viewer.email ? "Account" : "Sign in";

  function nav(label: string, href: string, key: string) {
    return (
      <a href={href} aria-current={current === key ? "page" : undefined}>
        {label}
      </a>
    );
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="site-name" href="/">
          PublicJobs.ca
        </a>
        <nav className="site-nav" aria-label="Site">
          {nav("Match your resume", "/match/", "match")}
          {nav("Employers", "/employers/", "employers")}
          <div className="nav-more">
            <button
              type="button"
              className="nav-more-btn"
              id="nav-more-btn"
              aria-expanded="false"
              aria-controls="nav-more-panel"
            >
              More
            </button>
            <ul className="nav-more-panel" id="nav-more-panel" hidden>
              <li>{nav("About", "/about/", "about")}</li>
              <li>{nav("FAQ", "/faq/", "faq")}</li>
              <li>{nav("Privacy", "/privacy/", "privacy")}</li>
              <li>{nav("Terms", "/terms/", "terms")}</li>
              <li>{nav("Pricing", "/pricing/", "pricing")}</li>
              <li>{nav(accountLabel, accountHref, viewer.email ? "account" : "login")}</li>
            </ul>
          </div>
        </nav>
      </div>
    </header>
  );
}
