"use client";

import { usePathname } from "next/navigation";

function currentKey(pathname: string): string {
  const raw = pathname.replace(/\/$/, "") || "/";
  const path = raw.startsWith("/dynamic") ? raw.slice("/dynamic".length) || "/" : raw;
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

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() || "/";
  const current = currentKey(pathname);
  const accountHref = signedIn ? "/account/" : "/login/";
  const accountLabel = signedIn ? "Account" : "Sign in";

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
              <li>{nav(accountLabel, accountHref, signedIn ? "account" : "login")}</li>
            </ul>
          </div>
        </nav>
      </div>
    </header>
  );
}
