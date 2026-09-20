#!/usr/bin/env python3
"""Generate static, crawlable home + job pages from data/listings.json."""

from __future__ import annotations

import json
import re
from collections import Counter
from datetime import date
from html import escape, unescape
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "listings.json"
JOBS_DIR = ROOT / "jobs"
SITE_ORIGIN = "https://oc5582.github.io"
SITE_BASE = "/ontario-public-jobs"
SITE_URL = SITE_ORIGIN + SITE_BASE

PRODUCT_NAME = "Ontario Public Jobs"
WHO_ITS_FOR = (
    "Job seekers watching government-owned corporations and agencies hiring "
    "in Toronto, the GTA, or hybrid-Toronto"
)
PROMISE = (
    "Workday-source Crown and agency Toronto jobs — "
    "real apply links and full job descriptions on this site, "
    "not another generic board"
)
LISTINGS_HEADING = "Current Crown and agency openings"
LISTINGS_NOTE = "Workday-source Crown and agency Toronto jobs."
SITE_TAG = "Workday-source Crown and agency Toronto jobs"
SIGNUP_HEADING = "Get Toronto Crown and agency matches"
CASL = "I agree to receive job-match emails at this address. I can unsubscribe anytime."
SOFT_PAY = "If this saved you time each week, would you pay a small monthly fee for it?"
UNAVAILABLE = (
    "A job description is not available for this posting. "
    "Use the Apply button to view details on the employer site."
)

BLOCK_TAGS = {
    "p",
    "div",
    "section",
    "article",
    "header",
    "footer",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "tr",
    "ul",
    "ol",
    "table",
    "thead",
    "tbody",
    "blockquote",
    "pre",
}
SKIP_TAGS = {"script", "style", "noscript"}


class HtmlToText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        tag = tag.lower()
        if tag in SKIP_TAGS:
            self.skip += 1
            return
        if self.skip:
            return
        if tag == "br":
            self.parts.append("\n")
        elif tag == "li":
            self.parts.append("\n• ")
        elif tag in BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in SKIP_TAGS and self.skip:
            self.skip -= 1
            return
        if self.skip:
            return
        if tag in BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.skip and data:
            self.parts.append(data)


def html_to_paragraphs(raw: str) -> list[str]:
    if not raw or not str(raw).strip():
        return []
    text = str(raw)
    if re.search(r"<[a-zA-Z][^>]*>", text):
        parser = HtmlToText()
        try:
            parser.feed(text)
            parser.close()
            text = "".join(parser.parts)
        except Exception:
            text = re.sub(r"<[^>]+>", "\n", text)
    text = unescape(text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    # Workday plaintext uses single newlines; HTML sources use blank lines.
    chunks = re.split(r"\n+", text) if "\n\n" not in text else re.split(r"\n{2,}", text)
    paragraphs: list[str] = []
    for chunk in chunks:
        line = re.sub(r"[ \t]{2,}", " ", chunk)
        line = re.sub(r"\n+", "\n", line).strip()
        if not line or line in {"•", "-", "*"}:
            continue
        line = re.sub(r"^•\s+", "• ", line)
        paragraphs.append(line)
    return paragraphs


def slugify(value: str) -> str:
    value = unescape(value or "")
    value = value.lower().replace("_", "-")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def job_slug(job: dict) -> str:
    source = slugify(job.get("source") or "job") or "job"
    title = slugify(job.get("title") or "untitled") or "untitled"
    slug = f"{source}-{title}"
    return slug[:90].rstrip("-")


def requisition_id(job: dict) -> str:
    url = text(job.get("apply_url"))
    last = url.rstrip("/").split("/")[-1]
    match = re.search(r"((?:JR|R)[-_]?\d+)$", last, re.I)
    if match:
        return slugify(match.group(1))
    return slugify(last)[-16:]


def assign_slugs(jobs: list[dict]) -> None:
    bases = [job_slug(job) for job in jobs]
    counts = Counter(bases)
    used: set[str] = set()
    for job, base in zip(jobs, bases):
        slug = base
        if counts[base] > 1:
            req = requisition_id(job)
            if req:
                slug = f"{base}-{req}"[:90].rstrip("-")
        n = 2
        original = slug
        while slug in used:
            slug = f"{original}-{n}"[:90].rstrip("-")
            n += 1
        used.add(slug)
        job["_slug"] = slug


def text(value) -> str:
    if value is None:
        return ""
    return unescape(str(value)).strip()


def format_date(value: str) -> str:
    raw = text(value)
    if not raw or not re.search(r"\d", raw):
        return ""
    try:
        y, m, d = raw[:10].split("-")
        return date(int(y), int(m), int(d)).strftime("%B %-d, %Y")
    except Exception:
        return raw


def first_sentence(paragraphs: list[str], limit: int = 160) -> str:
    blob = " ".join(paragraphs)
    blob = re.sub(r"\s+", " ", blob).strip()
    if not blob:
        return ""
    if len(blob) <= limit:
        return blob
    cut = blob[: limit - 1].rsplit(" ", 1)[0]
    return cut + "…"


def render_paragraphs(paragraphs: list[str]) -> str:
    if not paragraphs:
        return f'<p class="unavailable">{escape(UNAVAILABLE)}</p>'
    return "\n".join(f"<p>{escape(p)}</p>" for p in paragraphs)


def sort_jobs(jobs: list[dict]) -> list[dict]:
    def key(job: dict):
        closing = text(job.get("closing_date"))
        try:
            return (0, date.fromisoformat(closing[:10]), text(job.get("title")))
        except Exception:
            return (1, date.max, text(job.get("title")))

    return sorted(jobs, key=key)


def job_meta_rows(job: dict) -> list[tuple[str, str]]:
    rows = [
        ("Employer", text(job.get("employer"))),
        ("Location", text(job.get("location"))),
        ("Posted", format_date(text(job.get("posted_date")))),
        ("Closes", format_date(text(job.get("closing_date")))),
        ("Employment type", text(job.get("employment_type"))),
        ("Work mode", text(job.get("work_mode"))),
        ("Salary", text(job.get("salary"))),
        ("Department", text(job.get("department"))),
    ]
    return [(label, value) for label, value in rows if value]


def apply_button(url: str, extra_class: str = "") -> str:
    href = escape(url, quote=True)
    cls = "apply-btn" if not extra_class else f"apply-btn {extra_class}"
    return (
        f'<a class="{cls}" href="{href}" target="_blank" rel="noopener noreferrer">'
        "Apply on employer site</a>"
    )


def shared_head(title: str, description: str, canonical: str, css_href: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{escape(title)}</title>
    <meta name="description" content="{escape(description)}" />
    <link rel="canonical" href="{escape(canonical, quote=True)}" />
    <link rel="stylesheet" href="{escape(css_href, quote=True)}" />
  </head>"""


def render_job_page(job: dict, slug: str) -> str:
    title = text(job.get("title")) or "Untitled"
    employer = text(job.get("employer"))
    page_title = f"{title} — {employer} | {PRODUCT_NAME}" if employer else f"{title} | {PRODUCT_NAME}"
    paragraphs = html_to_paragraphs(text(job.get("description")))
    meta_desc = first_sentence(paragraphs) or (
        f"{title} at {employer}".strip(" at") + " — Toronto Crown and agency opening."
    )
    canonical = f"{SITE_URL}/jobs/{slug}.html"
    apply_url = text(job.get("apply_url"))
    dt_rows = "\n".join(
        f"          <div class=\"meta-row\"><dt>{escape(label)}</dt><dd>{escape(value)}</dd></div>"
        for label, value in job_meta_rows(job)
    )
    apply = apply_button(apply_url) if apply_url else ""
    return f"""{shared_head(page_title, meta_desc, canonical, "../styles.css")}
  <body>
    <header class="site-header">
      <a class="site-name" href="../">{escape(PRODUCT_NAME)}</a>
      <p class="site-tag">{escape(SITE_TAG)}</p>
    </header>
    <main class="job-page">
      <article>
        <p class="crumb"><a href="../">All openings</a></p>
        <h1>{escape(title)}</h1>
        {f'<p class="employer">{escape(employer)}</p>' if employer else ""}
        <dl class="job-meta">
{dt_rows}
        </dl>
        {apply}
        <section class="description" aria-labelledby="desc-heading">
          <h2 id="desc-heading">Job description</h2>
          {render_paragraphs(paragraphs)}
        </section>
        {apply}
      </article>
    </main>
  </body>
</html>
"""


def render_home_rows(jobs: list[dict]) -> str:
    rows = []
    for job in jobs:
        slug = job.get("_slug") or job_slug(job)
        title = text(job.get("title")) or "Untitled"
        employer = text(job.get("employer"))
        location = text(job.get("location"))
        closing = format_date(text(job.get("closing_date"))) or "—"
        emp_type = text(job.get("employment_type"))
        work_mode = text(job.get("work_mode"))
        extras = []
        if emp_type:
            extras.append(escape(emp_type))
        if work_mode:
            extras.append(escape(work_mode))
        extra_html = f'<div class="job-extra">{" · ".join(extras)}</div>' if extras else ""
        href = escape(f"jobs/{slug}.html", quote=True)
        rows.append(
            f"""          <tr>
            <td>
              <a href="{href}">{escape(title)}</a>
              {extra_html}
            </td>
            <td>{escape(employer)}</td>
            <td>{escape(location)}</td>
            <td>{escape(closing)}</td>
          </tr>"""
        )
    return "\n".join(rows)


def render_index(jobs: list[dict]) -> str:
    count = len(jobs)
    count_label = f"{count} opening{'s' if count != 1 else ''}"
    description = (
        "Workday-source Crown and agency Toronto jobs — "
        "full descriptions and apply links."
    )
    return f"""{shared_head(PRODUCT_NAME, description, SITE_URL + "/", "./styles.css")}
  <body>
    <main>
      <section class="hero" aria-labelledby="product-name">
        <h1 id="product-name">{escape(PRODUCT_NAME)}</h1>
        <p class="who" id="who-its-for">{escape(WHO_ITS_FOR)}</p>
        <p class="promise" id="promise">{escape(PROMISE)}</p>
      </section>

      <section class="listings" aria-labelledby="listings-heading">
        <h2 id="listings-heading">{escape(LISTINGS_HEADING)}</h2>
        <p class="listings-note">{escape(LISTINGS_NOTE)}</p>
        <p class="listings-meta" id="listings-meta">{escape(count_label)}</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Employer</th>
                <th scope="col">Location</th>
                <th scope="col">Closes</th>
              </tr>
            </thead>
            <tbody id="listings-body">
{render_home_rows(jobs)}
            </tbody>
          </table>
        </div>
      </section>

      <section class="signup" aria-labelledby="signup-heading">
        <div class="card">
          <h2 id="signup-heading">{escape(SIGNUP_HEADING)}</h2>
          <form id="signup-form" novalidate>
            <div class="field">
              <label id="email-label" for="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                autocomplete="email"
              />
            </div>

            <div class="field">
              <label id="region-label" for="region">Region</label>
              <select id="region" name="region" required></select>
            </div>

            <div class="field">
              <label id="employer-type-label" for="employer_type"
                >Employer type</label
              >
              <select id="employer_type" name="employer_type" required></select>
            </div>

            <div class="field">
              <label id="keyword-label" for="keyword">Keyword (optional)</label>
              <input type="text" id="keyword" name="keyword" />
            </div>

            <div class="field">
              <label class="checkbox" for="consent">
                <input type="checkbox" id="consent" name="consent" required />
                <span id="casl-label">{escape(CASL)}</span>
              </label>
            </div>

            <div class="pay-ask">
              <p id="soft-pay-ask">{escape(SOFT_PAY)}</p>
              <div class="pay-options" id="pay-options"></div>
            </div>

            <button type="submit" id="submit-btn">Get matches</button>
            <div id="signup-status" class="status" hidden></div>
          </form>
        </div>
      </section>
    </main>

    <script src="./copy.js"></script>
    <script src="./app.js"></script>
  </body>
</html>
"""


def write_sitemap(slugs: list[str]) -> None:
    urls = [f"{SITE_URL}/"] + [f"{SITE_URL}/jobs/{slug}.html" for slug in slugs]
    items = "\n".join(
        f"  <url><loc>{escape(url, quote=True)}</loc></url>" for url in urls
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{items}\n"
        "</urlset>\n"
    )
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")


def write_robots() -> None:
    (ROOT / "robots.txt").write_text(
        "User-agent: *\n"
        "Allow: /\n"
        f"Sitemap: {SITE_URL}/sitemap.xml\n",
        encoding="utf-8",
    )


def main() -> None:
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise SystemExit("listings.json must be a JSON array")
    jobs = sort_jobs(raw)
    assign_slugs(jobs)
    JOBS_DIR.mkdir(exist_ok=True)
    for stale in JOBS_DIR.glob("*.html"):
        stale.unlink()

    slugs: list[str] = []
    used: set[str] = set()
    for job in jobs:
        slug = job["_slug"]
        if slug in used:
            raise SystemExit(f"duplicate slug: {slug}")
        used.add(slug)
        slugs.append(slug)
        (JOBS_DIR / f"{slug}.html").write_text(render_job_page(job, slug), encoding="utf-8")

    (ROOT / "index.html").write_text(render_index(jobs), encoding="utf-8")
    write_sitemap(slugs)
    write_robots()
    (ROOT / ".nojekyll").write_text("", encoding="utf-8")
    print(f"Wrote {len(jobs)} job pages and index.html")


if __name__ == "__main__":
    main()
