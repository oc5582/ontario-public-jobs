"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  if (path === "/account" || path.startsWith("/account/")) return "account";
  if (path === "/login") return "login";
  return "";
}

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname() || "/";
  const current = currentKey(pathname);
  const accountHref = signedIn ? "/account/" : "/login/";
  const accountLabel = signedIn ? "Account" : "Sign in";
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || !open) return;
      event.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
    }
    function onPointer(event: MouseEvent) {
      if (!open) return;
      const wrap = wrapRef.current;
      if (!wrap || wrap.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onPointer);
    };
  }, [open]);

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
          <div
            className="nav-more"
            ref={wrapRef}
            onBlur={(event) => {
              if (!open) return;
              const next = event.relatedTarget;
              if (next instanceof Node && wrapRef.current?.contains(next)) return;
              if (!next) return;
              setOpen(false);
            }}
          >
            <button
              type="button"
              className="nav-more-btn"
              id="nav-more-btn"
              aria-expanded={open ? "true" : "false"}
              aria-controls="nav-more-panel"
              ref={btnRef}
              onClick={() => setOpen((value) => !value)}
            >
              More
            </button>
            <ul className="nav-more-panel" id="nav-more-panel" hidden={!open}>
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
