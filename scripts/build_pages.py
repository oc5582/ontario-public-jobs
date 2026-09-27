#!/usr/bin/env python3
"""Generate static, crawlable home + job pages from data/listings.json.

Job pages are written to /jobs/{employer-slug}/{job-slug}/ (index.html).
Previous /jobs/{slug}.html URLs, and any root-level copies of those pages,
are replaced with redirect stubs when they still match a published opening.
"""

from __future__ import annotations

import json
import re
import shutil
from collections import Counter
from datetime import date, datetime
from zoneinfo import ZoneInfo
from html import escape, unescape
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "listings.json"
JOBS_DIR = ROOT / "jobs"
# Apex custom domain. Pages are served from the domain root, not a project subpath.
SITE_ORIGIN = "https://publicjobs.ca"
SITE_BASE = ""
SITE_URL = SITE_ORIGIN + SITE_BASE

BRAND = "PublicJobs.ca"
# Leave [PIXEL_ID] in place until a real Meta Pixel id is set.
# An empty value or that placeholder omits the pixel from every page.
PIXEL_ID = "[PIXEL_ID]"
# Leave [OG_IMAGE_URL] in place until an image URL is set.
# An empty value or that placeholder omits og:image.
OG_IMAGE_URL = "[OG_IMAGE_URL]"
H1 = "Independent government job board for Toronto and the GTA"
SUBHEAD = (
    "TTC, Metrolinx, Toronto Hydro, OLG, Hydro One, CBC and more than 40 other "
    "public employers in Toronto and the GTA, each hiring on its own website. "
    "Their openings, collected in one place."
)
LISTINGS_HEADING = "Current openings"
FOOTER = "PublicJobs.ca is independent and not affiliated with any government."
PAGE_SIZE = 25

# Short names seekers type that do not already appear in the employer string.
# Parenthetical acronyms are already part of the employer name and need no entry.
SEARCH_ALIASES = {
    "Art Gallery of Ontario": "AGO",
    "Exhibition Place (Board of Governors) / Canadian National Exhibition Association": "CNE",
    "Farm Credit Canada": "FCC",
    "Law Society of Ontario": "LSO",
    "Metropolitan Toronto Convention Centre Corporation": "MTCC",
    "Ontario Centre of Innovation": "OCI",
    "Ontario Energy Board": "OEB",
    "Ontario Power Generation Inc.": "OPG",
    "Ontario Securities Commission": "OSC",
    "Public Health Ontario (Ontario Agency for Health Protection and Promotion)": "PHO",
    "Royal Ontario Museum": "ROM",
    "Toronto Atmospheric Fund": "TAF",
    "Toronto and Region Conservation Authority": "TRCA",
    "Toronto Community Housing Corporation": "TCHC",
    "Toronto Parking Authority": "TPA",
    "Toronto Transit Commission": "TTC",
    "Workplace Safety and Insurance Appeals Tribunal": "WSIAT",
    "Workplace Safety and Insurance Board": "WSIB",
}

SIGNUP_HEADING = "Get new Toronto Crown & agency openings by email — free."
SIGNUP_LEAD = "The job board stays public. This signs you up for email alerts only."
CASL = (
    "I agree to receive job alert emails from PublicJobs.ca at this address. "
    "I can unsubscribe anytime."
)
SOFT_PAY = (
    "Optional. If this saved you time each week, "
    "would you pay a small monthly fee for it?"
)
SUBMIT_LABEL = "Email me new openings"
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

APPLY_RE = re.compile(r'class="apply-btn"[^>]*href="([^"]+)"')
LEGACY_APPLY_RE = re.compile(r'name="legacy-apply-url" content="([^"]+)"')
REFRESH_RE = re.compile(r'http-equiv="refresh" content="0; url=([^"]+)"')
FONT_LINKS = """    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&amp;display=swap" rel="stylesheet" />"""


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
    text_value = str(raw)
    if re.search(r"<[a-zA-Z][^>]*>", text_value):
        parser = HtmlToText()
        try:
            parser.feed(text_value)
            parser.close()
            text_value = "".join(parser.parts)
        except Exception:
            text_value = re.sub(r"<[^>]+>", "\n", text_value)
    text_value = unescape(text_value)
    text_value = text_value.replace("\r\n", "\n").replace("\r", "\n")
    text_value = text_value.replace("\xa0", " ")
    text_value = re.sub(r"[ \t]+\n", "\n", text_value)
    text_value = re.sub(r"\n[ \t]+", "\n", text_value)
    # Workday plaintext uses single newlines; HTML sources use blank lines.
    chunks = (
        re.split(r"\n+", text_value)
        if "\n\n" not in text_value
        else re.split(r"\n{2,}", text_value)
    )
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


def requisition_id(job: dict) -> str:
    url = text(job.get("apply_url"))
    last = url.rstrip("/").split("/")[-1]
    match = re.search(r"((?:JR|R)[-_]?\d+)$", last, re.I)
    if match:
        return slugify(match.group(1))
    return slugify(last)[-16:]


def employer_slug(job: dict) -> str:
    return slugify(text(job.get("employer"))) or "employer"


def title_slug(job: dict) -> str:
    return (slugify(text(job.get("title"))) or "untitled")[:80].rstrip("-")


def assign_paths(jobs: list[dict]) -> None:
    groups: dict[str, list[dict]] = {}
    for job in jobs:
        groups.setdefault(employer_slug(job), []).append(job)
    for emp_slug, group in groups.items():
        bases = [title_slug(job) for job in group]
        counts = Counter(bases)
        used: set[str] = set()
        for job, base in zip(group, bases):
            slug = base or "untitled"
            if counts[base] > 1:
                req = requisition_id(job)
                if req:
                    slug = f"{base}-{req}"[:80].rstrip("-")
            original = slug
            n = 2
            while not slug or slug in used:
                slug = f"{original}-{n}"[:80].rstrip("-")
                n += 1
            used.add(slug)
            job["_employer_slug"] = emp_slug
            job["_job_slug"] = slug
            job["_path"] = f"jobs/{emp_slug}/{slug}/"


def text(value) -> str:
    if value is None:
        return ""
    return unescape(str(value)).strip()


def iso_date(value: str) -> str:
    raw = text(value)[:10]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        return ""
    try:
        date.fromisoformat(raw)
    except Exception:
        return ""
    return raw


def format_date(value: str) -> str:
    raw = iso_date(value) or text(value)
    if not raw or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw[:10]):
        return ""
    try:
        y, m, d = raw[:10].split("-")
        return date(int(y), int(m), int(d)).strftime("%B %-d, %Y")
    except Exception:
        return ""


def pill_label(value: str) -> str:
    raw = text(value)
    if not raw:
        return ""
    return re.sub(r"\s+", " ", raw.replace("-", " ")).strip()


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


def toronto_today() -> date:
    return datetime.now(ZoneInfo("America/Toronto")).date()


def listing_is_visible(job: dict, today: date) -> bool:
    closing = iso_date(text(job.get("closing_date")))
    if not closing:
        return True
    return date.fromisoformat(closing) >= today


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


def configured_value(value: str, placeholder: str) -> str:
    raw = (value or "").strip()
    if not raw or raw == placeholder:
        return ""
    return raw


def js_quote(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\r", "")
        .replace("\n", "")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
    )


def pixel_snippet() -> str:
    pixel_id = configured_value(PIXEL_ID, "[PIXEL_ID]")
    if not pixel_id:
        return ""
    safe_js = js_quote(pixel_id)
    safe_url = escape(pixel_id, quote=True)
    return f"""    <!-- Meta Pixel Code -->
    <script>
    !function(f,b,e,v,n,t,s)
    {{if(f.fbq)return;n=f.fbq=function(){{n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)}};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '{safe_js}');
    fbq('track', 'PageView');
    </script>
    <noscript><img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id={safe_url}&amp;ev=PageView&amp;noscript=1"
    /></noscript>
    <!-- End Meta Pixel Code -->"""


def apply_click_script() -> str:
    if not configured_value(PIXEL_ID, "[PIXEL_ID]"):
        return ""
    return """    <script>
    document.addEventListener("click", function (event) {
      var el = event.target;
      var link = el && el.closest ? el.closest("a.apply-btn") : null;
      if (!link || typeof fbq !== "function") return;
      fbq("trackCustom", "ApplyClick");
    });
    </script>"""


def og_tags(title: str, description: str, url: str) -> str:
    lines = [
        f'    <meta property="og:title" content="{escape(title)}" />',
        f'    <meta property="og:description" content="{escape(description)}" />',
        f'    <meta property="og:url" content="{escape(url, quote=True)}" />',
        '    <meta property="og:type" content="website" />',
        f'    <meta property="og:site_name" content="{escape(BRAND)}" />',
    ]
    image = configured_value(OG_IMAGE_URL, "[OG_IMAGE_URL]")
    if image:
        lines.append(
            f'    <meta property="og:image" content="{escape(image, quote=True)}" />'
        )
    return "\n".join(lines)


def shared_head(
    title: str, description: str, canonical: str, css_href: str, extra_css: str = ""
) -> str:
    extra = ""
    if extra_css:
        extra = f'\n    <link rel="stylesheet" href="{escape(extra_css, quote=True)}" />'
    pixel = pixel_snippet()
    pixel_block = f"\n{pixel}" if pixel else ""
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{escape(title)}</title>
    <meta name="description" content="{escape(description)}" />
    <link rel="canonical" href="{escape(canonical, quote=True)}" />
{og_tags(title, description, canonical)}
{FONT_LINKS}
    <link rel="stylesheet" href="{escape(css_href, quote=True)}" />{extra}{pixel_block}
  </head>"""


def site_header(home_href: str) -> str:
    return f"""    <header class="site-header">
      <div class="header-inner">
        <a class="site-name" href="{escape(home_href, quote=True)}">PublicJobs.ca</a>
      </div>
    </header>"""


def site_footer() -> str:
    return f"""    <footer class="site-footer">
      <div class="content">
        <p>{escape(FOOTER)}</p>
      </div>
    </footer>"""


def render_job_page(job: dict) -> str:
    title = text(job.get("title")) or "Untitled"
    employer = text(job.get("employer"))
    page_title = f"{title} — {employer} | {BRAND}" if employer else f"{title} | {BRAND}"
    paragraphs = html_to_paragraphs(text(job.get("description")))
    meta_desc = first_sentence(paragraphs) or (
        f"{title} at {employer}".strip(" at") + " — public sector opening in Toronto and the GTA."
    )
    canonical = f"{SITE_URL}/{job['_path']}"
    apply_url = text(job.get("apply_url"))
    dt_rows = "\n".join(
        f'          <div class="meta-row"><dt>{escape(label)}</dt><dd>{escape(value)}</dd></div>'
        for label, value in job_meta_rows(job)
    )
    apply = apply_button(apply_url) if apply_url else ""
    script = apply_click_script()
    script_block = f"\n{script}" if script else ""
    return f"""{shared_head(page_title, meta_desc, canonical, "../../../styles.css")}
  <body>
{site_header("../../../")}
    <main>
      <article class="job-page content">
        <p class="crumb"><a href="../../../">All openings</a></p>
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
{site_footer()}{script_block}
  </body>
</html>
"""


def listing_record(job: dict) -> dict:
    employer = text(job.get("employer"))
    record = {
        "title": text(job.get("title")) or "Untitled",
        "employer": employer,
        "location": text(job.get("location")),
        "closing": iso_date(text(job.get("closing_date"))),
        "type": pill_label(text(job.get("employment_type"))),
        "href": job["_path"],
    }
    alias = SEARCH_ALIASES.get(employer, "")
    if alias:
        record["alias"] = alias
    return record


def render_row(rec: dict) -> str:
    title = escape(rec["title"])
    href = escape(rec["href"], quote=True)
    employer_html = (
        f'<span class="job-employer">{escape(rec["employer"])}</span>' if rec["employer"] else ""
    )
    pill_html = f'<span class="pill">{escape(rec["type"])}</span>' if rec["type"] else ""
    sub = f"<span class=\"job-sub\">{employer_html}{pill_html}</span>" if employer_html or pill_html else ""
    side_bits: list[str] = []
    if rec["location"]:
        side_bits.append(f'<span class="job-location">{escape(rec["location"])}</span>')
    if rec["closing"]:
        side_bits.append(
            f'<time class="job-closing" datetime="{escape(rec["closing"], quote=True)}">'
            f"{escape(format_date(rec['closing']))}</time>"
        )
    side = f'<span class="job-side">{"".join(side_bits)}</span>' if side_bits else ""
    return f"""          <li>
            <a class="job-row" href="{href}">
              <span class="job-main"><span class="job-title">{title}</span>{sub}</span>
              {side}
            </a>
          </li>"""


def json_for_script(records: list[dict]) -> str:
    payload = json.dumps(records, ensure_ascii=False, separators=(",", ":"))
    return (
        payload.replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def render_index(jobs: list[dict]) -> str:
    records = [listing_record(job) for job in jobs]
    count = len(records)
    pages = max(1, (count + PAGE_SIZE - 1) // PAGE_SIZE)
    label = "opening" if count == 1 else "openings"
    first_rows = "\n".join(render_row(rec) for rec in records[:PAGE_SIZE])
    description = SUBHEAD
    title = f"{H1} | {BRAND}"
    next_disabled = "" if pages > 1 else " disabled"
    return f"""{shared_head(title, description, SITE_URL + "/", "./styles.css")}
  <body>
{site_header("./")}
    <main>
      <div class="content">
        <section class="hero" aria-labelledby="page-heading">
          <h1 id="page-heading">{escape(H1)}</h1>
          <p class="subhead">{escape(SUBHEAD)}</p>
          <div class="listings-toolbar">
            <div class="count-block" aria-live="polite">
              <p class="count-number" id="listings-count">{count}</p>
              <p class="count-label" id="listings-count-label">{label}</p>
            </div>
            <div class="search-field" role="search">
              <label for="job-search">Search titles and employers</label>
              <input
                id="job-search"
                type="search"
                autocomplete="off"
                spellcheck="false"
                aria-controls="job-list"
              />
            </div>
          </div>
        </section>

        <section class="signup" aria-labelledby="signup-heading">
          <div class="signup-panel">
            <div class="signup-copy">
              <h2 id="signup-heading">{escape(SIGNUP_HEADING)}</h2>
              <p class="signup-lead" id="signup-lead">{escape(SIGNUP_LEAD)}</p>
            </div>
            <form id="signup-form" method="post" novalidate>
              <div class="signup-fields">
                <div class="field">
                  <label id="email-label" for="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    autocomplete="email"
                    inputmode="email"
                    maxlength="254"
                    placeholder="you@example.com"
                  />
                </div>
                <button type="submit" id="submit-btn">{escape(SUBMIT_LABEL)}</button>
              </div>

              <div class="field consent-field">
                <label class="checkbox" for="consent">
                  <input type="checkbox" id="consent" name="casl_consent" value="yes" required />
                  <span id="casl-label">{escape(CASL)}</span>
                </label>
                <p class="privacy-link"><a href="/privacy/">Privacy policy</a></p>
              </div>

              <div class="hp" aria-hidden="true">
                <label for="gotcha">Leave this field blank</label>
                <input type="text" id="gotcha" name="_gotcha" tabindex="-1" autocomplete="off" />
              </div>

              <div class="pay-ask">
                <p id="soft-pay-ask">{escape(SOFT_PAY)}</p>
                <div class="pay-options" id="pay-options"></div>
              </div>

              <div id="signup-status" class="status" role="status" aria-live="polite" hidden></div>
            </form>
          </div>
        </section>

        <section class="listings" aria-labelledby="listings-heading">
          <h2 id="listings-heading">{escape(LISTINGS_HEADING)}</h2>
          <p id="listings-empty" class="listings-empty" aria-live="polite" hidden>No openings match that search.</p>
          <ul class="job-list" id="job-list" tabindex="-1">
{first_rows}
          </ul>
          <nav class="pager" id="pager" aria-label="Pages of openings">
            <button type="button" id="page-prev" disabled>Previous</button>
            <p id="page-status">Page 1 of {pages}</p>
            <button type="button" id="page-next"{next_disabled}>Next</button>
          </nav>
          <noscript>
            <p class="listings-note">Showing the first {PAGE_SIZE} openings. Turn on JavaScript to search and move through the full list.</p>
          </noscript>
        </section>
      </div>
    </main>
{site_footer()}

    <script id="listings-data" type="application/json">{json_for_script(records)}</script>
    <script src="./listings.js"></script>
    <script src="./signup.config.js"></script>
    <script src="./copy.js"></script>
    <script src="./app.js"></script>
  </body>
</html>
"""


PRIVACY_DESCRIPTION = (
    "PublicJobs.ca is an independent job board. This page explains what "
    "personal information we collect, why, and how you can control it."
)
ABOUT_DESCRIPTION = (
    "PublicJobs.ca collects current job openings from public employers in "
    "Toronto and the GTA and lists them in one place."
)


def render_info_page(title: str, heading: str, description: str, path: str, body: str) -> str:
    canonical = f"{SITE_URL}/{path}"
    return f"""{shared_head(title, description, canonical, "../styles.css", extra_css="../pages.css")}
  <body>
{site_header("../")}
    <main>
      <article class="job-page content">
        <p class="crumb"><a href="../">All openings</a></p>
        <h1>{escape(heading)}</h1>
        <section class="description">
{body}
        </section>
      </article>
    </main>
{site_footer()}
  </body>
</html>
"""


def render_privacy_page() -> str:
    body = """          <p>Last updated: [DATE OF PUBLISHING]</p>
          <p>PublicJobs.ca is an independent job board. It is not affiliated with any government or with any employer listed on the site. This page explains what personal information we collect, why, and how you can control it.</p>
          <h2>Who we are</h2>
          <p>PublicJobs.ca is operated by [OPERATOR NAME], [MAILING ADDRESS], Ontario, Canada. Contact: [CONTACT EMAIL].</p>
          <h2>Browsing the site</h2>
          <p>You can browse and search job listings without an account. When you click "Apply on employer site", you leave PublicJobs.ca and go to the employer's own website. That employer's privacy policy applies there. We do not receive your application.</p>
          <h2>Email alerts</h2>
          <p>If you sign up for email alerts, we collect:</p>
          <ul>
            <li>your email address</li>
            <li>a record that you ticked the consent box, including the consent wording you agreed to</li>
            <li>the web page address where you signed up</li>
            <li>your answer to the optional question about paying for alerts, if you choose to answer</li>
          </ul>
          <p>We use this only to send you job alert emails from PublicJobs.ca and to understand interest in the service. We do not sell or rent your information, and we do not share it with employers.</p>
          <h2>Advertising and measurement</h2>
          <p>We use the Meta Pixel, a tool from Meta Platforms, Inc., to measure how well our ads on Facebook and Instagram work. When you visit PublicJobs.ca, the Meta Pixel may use cookies and similar technology to collect information such as the pages you view, whether you signed up for alerts, whether you clicked through to an employer's site, and technical details about your browser and device. Meta may use this information as described in its own privacy policy (<a href="https://facebook.com/privacy/policy">facebook.com/privacy/policy</a>). We do not send your email address to Meta. You can control ad personalization in your Facebook and Instagram ad settings, and you can block or delete cookies in your browser settings.</p>
          <h2>Service providers</h2>
          <p>We use trusted service providers to run this site and our emails: Cloudflare (runs the signup form), Resend (stores the mailing list and sends the emails), and Meta (ad measurement, described above). These providers may store information outside Canada, including in the United States, where it may be subject to local laws.</p>
          <h2>Unsubscribing</h2>
          <p>Every alert email includes a one-click unsubscribe link. You can also email [CONTACT EMAIL] and we will remove you.</p>
          <h2>How long we keep it</h2>
          <p>We keep your email address while you are subscribed. If you unsubscribe, we stop sending emails and delete or suppress your address within a reasonable time, keeping only what we need to make sure you are not emailed again.</p>
          <h2>Your rights</h2>
          <p>You can ask to see the personal information we hold about you, ask us to correct it, or withdraw your consent at any time by emailing [CONTACT EMAIL]. If you are not satisfied with our response, you can contact the Office of the Privacy Commissioner of Canada at <a href="https://priv.gc.ca">priv.gc.ca</a>.</p>
          <h2>Changes to this policy</h2>
          <p>If we change this policy, we will update the date at the top of this page.</p>"""
    return render_info_page(
        f"Privacy policy | {BRAND}",
        "Privacy policy",
        PRIVACY_DESCRIPTION,
        "privacy/",
        body,
    )


def render_about_page() -> str:
    body = """          <p>PublicJobs.ca collects current job openings from public employers in Toronto and the GTA, such as Crown corporations, provincial and federal agencies, City of Toronto agencies, and some public-interest regulators, and lists them in one place.</p>
          <p>We are independent. PublicJobs.ca is not a government website and is not affiliated with, endorsed by, or acting for any government or any employer listed on the site.</p>
          <p>We do not hire and we do not take applications. Every job page links to the employer's own posting, and you apply there.</p>
          <p>Job details come from employers' public careers pages. Always check the employer's posting for the latest information, including closing dates and pay.</p>
          <p>Browsing is free and needs no account. Email alerts are optional.</p>
          <p>Questions or corrections: [CONTACT EMAIL]. See our privacy policy at <a href="/privacy/">/privacy/</a>.</p>"""
    return render_info_page(
        f"About | {BRAND}",
        "About PublicJobs.ca",
        ABOUT_DESCRIPTION,
        "about/",
        body,
    )


def write_info_pages() -> None:
    privacy = ROOT / "privacy" / "index.html"
    about = ROOT / "about" / "index.html"
    privacy.parent.mkdir(parents=True, exist_ok=True)
    about.parent.mkdir(parents=True, exist_ok=True)
    privacy.write_text(render_privacy_page(), encoding="utf-8")
    about.write_text(render_about_page(), encoding="utf-8")


def write_sitemap(paths: list[str]) -> None:
    urls = [f"{SITE_URL}/"] + [f"{SITE_URL}/{path}" for path in paths]
    items = "\n".join(f"  <url><loc>{escape(url, quote=True)}</loc></url>" for url in urls)
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


def read_html(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


def legacy_apply_url(html: str) -> str:
    match = LEGACY_APPLY_RE.search(html) or APPLY_RE.search(html)
    if not match:
        return ""
    return unescape(match.group(1)).strip()


def legacy_refresh_target(html: str) -> str:
    match = REFRESH_RE.search(html)
    if not match:
        return ""
    return unescape(match.group(1)).strip()


def collect_legacy(paths: list[Path]) -> list[tuple[Path, str, str]]:
    found: list[tuple[Path, str, str]] = []
    for path in paths:
        html = read_html(path)
        if not html:
            continue
        apply_url = legacy_apply_url(html)
        target = legacy_refresh_target(html)
        if apply_url or target or 'class="job-page"' in html or 'class="apply-btn"' in html:
            found.append((path, apply_url, target))
    return found


def render_redirect(target: str, apply_url: str) -> str:
    canonical = SITE_ORIGIN + target
    apply_meta = (
        f'    <meta name="legacy-apply-url" content="{escape(apply_url, quote=True)}" />\n'
        if apply_url
        else ""
    )
    href = escape(target, quote=True)
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>This opening has moved | {escape(BRAND)}</title>
    <link rel="canonical" href="{escape(canonical, quote=True)}" />
    <meta name="robots" content="noindex" />
{apply_meta}    <meta http-equiv="refresh" content="0; url={href}" />
    <script>location.replace("{href}");</script>
  </head>
  <body>
    <p>This page has moved. <a href="{href}">Continue to the opening</a>.</p>
  </body>
</html>
"""


def legacy_candidates() -> list[Path]:
    paths: list[Path] = []
    if JOBS_DIR.exists():
        paths.extend(sorted(JOBS_DIR.glob("*.html")))
    for path in sorted(ROOT.glob("*.html")):
        if path.name == "index.html":
            continue
        paths.append(path)
    return paths


def reset_jobs_dir() -> None:
    if JOBS_DIR.exists():
        shutil.rmtree(JOBS_DIR)
    JOBS_DIR.mkdir()


def main() -> None:
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise SystemExit("listings.json must be a JSON array")
    jobs = sort_jobs(raw)
    assign_paths(jobs)
    visible = [job for job in jobs if listing_is_visible(job, toronto_today())]

    apply_to_path: dict[str, str] = {}
    published_targets: set[str] = set()
    for job in jobs:
        target = "/" + job["_path"]
        published_targets.add(target)
        apply_url = text(job.get("apply_url"))
        if apply_url:
            apply_to_path[apply_url] = target

    legacy = collect_legacy(legacy_candidates())
    redirects: list[tuple[Path, str, str]] = []
    removed = 0
    for path, apply_url, existing in legacy:
        target = apply_to_path.get(apply_url, "")
        if not target and existing in published_targets:
            target = existing
        if target:
            redirects.append((path, target, apply_url))
        elif path.name != "index.html":
            removed += 1

    reset_jobs_dir()
    for path, _target, _apply in redirects:
        if path.parent == ROOT and path.exists():
            path.unlink()
    for path in ROOT.glob("*.html"):
        if path.name == "index.html":
            continue
        html = read_html(path)
        if 'class="job-page"' in html or 'class="apply-btn"' in html:
            path.unlink()

    slugs: list[str] = []
    used: set[str] = set()
    for job in jobs:
        rel = job["_path"]
        if rel in used:
            raise SystemExit(f"duplicate path: {rel}")
        used.add(rel)
        slugs.append(rel)
        page_path = JOBS_DIR / job["_employer_slug"] / job["_job_slug"] / "index.html"
        page_path.parent.mkdir(parents=True, exist_ok=True)
        page_path.write_text(render_job_page(job), encoding="utf-8")

    written_redirects = 0
    for path, target, apply_url in redirects:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(render_redirect(target, apply_url), encoding="utf-8")
        written_redirects += 1

    (ROOT / "index.html").write_text(render_index(visible), encoding="utf-8")
    write_info_pages()
    write_sitemap(slugs)
    write_robots()
    (ROOT / ".nojekyll").write_text("", encoding="utf-8")
    print(
        f"Wrote {len(jobs)} job pages, index.html, "
        f"and {written_redirects} redirects "
        f"({removed} unpublished legacy pages dropped)"
    )


if __name__ == "__main__":
    main()
