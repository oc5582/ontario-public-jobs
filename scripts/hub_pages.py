#!/usr/bin/env python3
"""Static employer hubs and a paginated /jobs/ index.

These pages exist so every opening is reachable from the homepage through
plain <a href> links. JobPosting schema is intentionally not added here.
"""

from __future__ import annotations

import re
import shutil
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import build_pages as bp

PAGE_DIR_NAME = "page"


def rooted_record(record: dict) -> dict:
    """Job row links from nested pages must be root-relative."""
    out = dict(record)
    href = out.get("href") or ""
    if href.startswith("./"):
        href = href[2:]
    if href and not href.startswith(("/", "http://", "https://")):
        href = "/" + href
    out["href"] = href
    return out


def jobs_page_path(page: int) -> str:
    if page <= 1:
        return "jobs/"
    return f"jobs/{PAGE_DIR_NAME}/{page}/"


def opening_word(count: int) -> str:
    return "opening" if count == 1 else "openings"


def jobs_by_employer(jobs: list[dict]) -> list[tuple[str, str, list[dict]]]:
    groups: dict[str, list[dict]] = {}
    for job in jobs:
        groups.setdefault(job["_employer_slug"], []).append(job)
    named: list[tuple[str, str, list[dict]]] = []
    for slug, group in groups.items():
        name = bp.text(group[0].get("employer")) or slug
        named.append((name, slug, group))
    named.sort(key=lambda item: (item[0].casefold(), item[0]))
    return named


def employer_description(name: str, count: int) -> str:
    noun = opening_word(count)
    return (
        f"{count} current {name} {noun} listed on PublicJobs.ca. "
        "You apply on the employer's own website."
    )


def render_employer_page(name: str, slug: str, group: list[dict]) -> str:
    count = len(group)
    noun = opening_word(count)
    title = f"{name} jobs | {bp.BRAND}"
    canonical = f"{bp.SITE_URL}/employers/{slug}/"
    if count:
        description = employer_description(name, count)
        intro = (
            f"{count} current {noun} at {name}. "
            "PublicJobs.ca lists them in one place. "
            "You apply on the employer's own website. "
            f"We are independent and not affiliated with {name}."
        )
        rows = "\n".join(
            bp.render_row(rooted_record(bp.listing_record(job))) for job in group
        )
        job_list = f"""        <ul class="job-list">
{rows}
        </ul>"""
    else:
        description = (
            f"No current {name} openings on PublicJobs.ca. "
            "You apply on the employer's own website when a job is posted."
        )
        intro = (
            f"No current openings at {name}. "
            "Closed postings stay off this page. "
            "You apply on the employer's own website when a job is posted. "
            f"We are independent and not affiliated with {name}."
        )
        job_list = ""
    head = bp.shared_head(title, description, canonical, "../../styles.css")
    return f"""{head}
  <body>
{bp.site_header("../../", "employers")}
    <main>
      <article class="job-page content">
        <p class="crumb"><a href="../../">All openings</a> / <a href="../">Employers</a></p>
        <h1>{bp.escape(name)} jobs</h1>
        <section class="description">
          <p>{bp.escape(intro)}</p>
        </section>
{job_list}
      </article>
    </main>
{bp.site_footer("../../")}
  </body>
</html>
"""


def pager_nav(page: int, pages: int) -> str:
    if pages <= 1:
        return ""

    def edge(label: str, target: int | None) -> str:
        if target is None:
            return f'<span aria-disabled="true">{label}</span>'
        href = "/" + jobs_page_path(target)
        return f'<a href="{bp.escape(href, quote=True)}">{label}</a>'

    prev_target = page - 1 if page > 1 else None
    next_target = page + 1 if page < pages else None
    return f"""        <nav class="pager" aria-label="Pages of openings">
          {edge("Previous", prev_target)}
          <p>Page {page} of {pages}</p>
          {edge("Next", next_target)}
        </nav>"""


def render_jobs_index_page(
    records: list[dict], page: int, pages: int, total: int
) -> str:
    depth = 1 if page == 1 else 3
    prefix = "../" * depth
    if page == 1:
        title = f"All job openings | {bp.BRAND}"
    else:
        title = f"All job openings, page {page} | {bp.BRAND}"
    description = (
        "Every current public-sector job opening in Toronto and the GTA "
        f"listed on PublicJobs.ca. {total} openings, page {page} of {pages}."
    )
    rel = jobs_page_path(page)
    canonical = f"{bp.SITE_URL}/{rel}"
    links: list[str] = []
    if page > 1:
        links.append(
            f'    <link rel="prev" href="{bp.SITE_URL}/{jobs_page_path(page - 1)}" />'
        )
    if page < pages:
        links.append(
            f'    <link rel="next" href="{bp.SITE_URL}/{jobs_page_path(page + 1)}" />'
        )
    head = bp.shared_head(title, description, canonical, f"{prefix}styles.css")
    if links:
        head = head.replace("\n  </head>", "\n" + "\n".join(links) + "\n  </head>", 1)
    rows = "\n".join(bp.render_row(rooted_record(rec)) for rec in records)
    start = (page - 1) * bp.PAGE_SIZE + 1
    end = start + len(records) - 1
    return f"""{head}
  <body>
{bp.site_header(prefix)}
    <main>
      <article class="job-page content">
        <p class="crumb"><a href="{prefix}">All openings</a></p>
        <h1>All job openings</h1>
        <section class="description">
          <p>{total} current openings from public employers in Toronto and the GTA. Showing {start} to {end}.</p>
        </section>
{pager_nav(page, pages)}
        <ul class="job-list">
{rows}
        </ul>
{pager_nav(page, pages)}
      </article>
    </main>
{bp.site_footer(prefix)}
  </body>
</html>
"""


def write_jobs_index(jobs: list[dict]) -> list[str]:
    index = bp.JOBS_DIR / "index.html"
    if index.exists():
        index.unlink()
    page_dir = bp.JOBS_DIR / PAGE_DIR_NAME
    if page_dir.exists():
        shutil.rmtree(page_dir)
    records = [bp.listing_record(job) for job in jobs]
    total = len(records)
    pages = max(1, (total + bp.PAGE_SIZE - 1) // bp.PAGE_SIZE)
    paths: list[str] = []
    for page in range(1, pages + 1):
        chunk = records[(page - 1) * bp.PAGE_SIZE : page * bp.PAGE_SIZE]
        rel = jobs_page_path(page)
        dest = bp.ROOT / rel / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(
            render_jobs_index_page(chunk, page, pages, total), encoding="utf-8"
        )
        paths.append(rel)
    return paths


def open_jobs_only(jobs: list[dict]) -> list[dict]:
    today = bp.today_toronto()
    return [job for job in jobs if not bp.job_is_closed(job, today)]


def write_employer_pages_from(jobs: list[dict], listed: list[dict]) -> list[str]:
    """One page per employer. Only openings that are still open are listed."""
    employers_root = bp.ROOT / "employers"
    for child in list(employers_root.iterdir()):
        if child.is_dir():
            shutil.rmtree(child)
    open_groups = {slug: group for _name, slug, group in jobs_by_employer(listed)}
    paths: list[str] = []
    for name, slug, _group in jobs_by_employer(jobs):
        if slug == PAGE_DIR_NAME:
            raise SystemExit("employer slug 'page' clashes with /jobs/page/")
        rel = f"employers/{slug}/"
        dest = employers_root / slug / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(
            render_employer_page(name, slug, open_groups.get(slug, [])),
            encoding="utf-8",
        )
        paths.append(rel)
    return paths


def write_hub_pages(jobs: list[dict]) -> list[str]:
    listed = open_jobs_only(jobs)
    return write_jobs_index(listed) + write_employer_pages_from(jobs, listed)


class AnchorExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.hrefs: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        tag = tag.lower()
        if tag in {"script", "style"}:
            self.skip += 1
            return
        if self.skip or tag != "a":
            return
        for key, value in attrs:
            if key == "href" and value:
                self.hrefs.append(value)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"script", "style"} and self.skip:
            self.skip -= 1


def page_file(url_path: str) -> Path | None:
    if url_path.endswith(".html"):
        return bp.ROOT / url_path.lstrip("/")
    rel = url_path.strip("/")
    if not rel:
        return bp.ROOT / "index.html"
    leaf = rel.split("/")[-1]
    if "." in leaf:
        return None
    return bp.ROOT / rel / "index.html"


def normalize_path(url_path: str) -> str:
    path = url_path.split("?", 1)[0].split("#", 1)[0]
    if not path.startswith("/"):
        path = "/" + path
    if path != "/" and not path.endswith("/") and not path.endswith(".html"):
        path += "/"
    return path


def verify_internal_links(jobs: list[dict], hub_paths: list[str]) -> None:
    """Every job URL must be reachable from the homepage by <a href> alone."""
    origin = bp.SITE_URL
    expected = {normalize_path("/" + job["_path"]) for job in jobs}
    reached: set[str] = set()
    broken: list[str] = []
    queue = ["/"]
    seen: set[str] = set()

    while queue:
        current = queue.pop()
        if current in seen:
            continue
        seen.add(current)
        file_path = page_file(current)
        if file_path is None or not file_path.is_file():
            broken.append(current)
            continue
        parser = AnchorExtractor()
        try:
            parser.feed(file_path.read_text(encoding="utf-8"))
            parser.close()
        except Exception as exc:
            raise SystemExit(f"could not read links in {file_path}: {exc}") from exc
        base = origin + (current if current.endswith("/") else current.rsplit("/", 1)[0] + "/")
        if current.endswith(".html"):
            base = origin + current.rsplit("/", 1)[0] + "/"
        for href in parser.hrefs:
            raw = href.strip()
            if not raw or raw.startswith(("#", "mailto:", "tel:", "javascript:")):
                continue
            absolute = urljoin(base, raw)
            parsed = urlparse(absolute)
            if parsed.scheme not in {"http", "https"}:
                continue
            if parsed.netloc and parsed.netloc != urlparse(origin).netloc:
                continue
            path = normalize_path(parsed.path or "/")
            if path in expected:
                reached.add(path)
            if path in seen or path in queue:
                continue
            target = page_file(path)
            if target is None:
                continue
            if target.is_file():
                queue.append(path)
            elif path.startswith(("/jobs/", "/employers/")):
                broken.append(path)

    missing = sorted(expected - reached)
    if missing or broken:
        sample = ", ".join(missing[:8])
        broken_sample = ", ".join(broken[:8])
        raise SystemExit(
            f"{len(missing)} job pages are not linked by <a href> "
            f"({sample}); broken internal links: {broken_sample}"
        )

    employer_href = re.compile(r'<p class="employer"><a href="([^"]+)">')
    for job in jobs:
        page = bp.ROOT / job["_path"] / "index.html"
        html = page.read_text(encoding="utf-8")
        match = employer_href.search(html)
        want = f"/employers/{job['_employer_slug']}/"
        if not match or match.group(1) != want:
            raise SystemExit(f"employer name on {job['_path']} does not link to {want}")

    sitemap = (bp.ROOT / "sitemap.xml").read_text(encoding="utf-8")
    locs = set(re.findall(r"<loc>([^<]+)</loc>", sitemap))
    for rel in hub_paths:
        url = f"{origin}/{rel}"
        if url not in locs:
            raise SystemExit(f"sitemap is missing {url}")
    for path in expected:
        url = f"{origin}{path}"
        if url not in locs:
            raise SystemExit(f"sitemap is missing {url}")

    print(
        f"Checked {len(expected)} job pages. Each one is reachable from the "
        "homepage by plain links, and each employer name links to its hub."
    )
