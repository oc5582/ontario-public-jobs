import { headers } from "next/headers";
import { FOOTER } from "@/lib/site";

export async function SiteFooter() {
  const h = await headers();
  const path = (h.get("x-pathname") || "/").replace(/\/$/, "") || "/";
  function link(label: string, href: string, key: string) {
    const current = path === key ? "page" : undefined;
    return (
      <a href={href} aria-current={current}>
        {label}
      </a>
    );
  }
  return (
    <footer className="site-footer">
      <div className="content">
        <p>{FOOTER}</p>
        <nav className="footer-nav" aria-label="Footer">
          {link("About", "/about/", "/about")}
          {link("Frequently asked questions", "/faq/", "/faq")}
          {link("Privacy", "/privacy/", "/privacy")}
          {link("Terms", "/terms/", "/terms")}
        </nav>
      </div>
    </footer>
  );
}
