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
from html import escape, unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from zoneinfo import ZoneInfo

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
PIXEL_ID = "4654096711502773"
# Empty omits the Cloudflare Web Analytics beacon from every page.
CF_ANALYTICS_TOKEN = "b81ee0dcc95347e882d5e0a43124f360"
# An empty value or the [OG_IMAGE_URL] placeholder omits og:image.
OG_IMAGE_URL = "https://publicjobs.ca/og-image.png"
OG_IMAGE_ALT = "PublicJobs.ca: government jobs in Toronto and the GTA"
H1 = "Independent job board for government jobs in Toronto and the GTA"
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


def html_to_paragraphs(raw: str, *, interpret_html: bool = True) -> list[str]:
    if not raw or not str(raw).strip():
        return []
    text_value = str(raw)
    if interpret_html and re.search(r"<[a-zA-Z][^>]*>", text_value):
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
                    combined = f"{base}-{req}"
                    if len(combined) <= 80:
                        slug = combined.rstrip("-")
                    else:
                        # Keep the requisition id when the title slug is already at the limit.
                        suffix = f"-{req}"
                        room = 80 - len(suffix)
                        head = base[:room].rstrip("-") if room > 0 else ""
                        slug = f"{head}{suffix}" if head else req[:80]
            original = slug
            n = 2
            while not slug or slug in used:
                # Keep the numeric suffix when the title slug is already 80 characters.
                suffix = f"-{n}"
                slug = (original[: max(1, 80 - len(suffix))] + suffix).rstrip("-")
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


def today_toronto() -> date:
    # Closing dates are calendar dates. Judge them against the build day in Toronto.
    return datetime.now(ZoneInfo("America/Toronto")).date()


def job_is_closed(job: dict, today: date) -> bool:
    closing = closing_date(job)
    if not closing:
        return False
    return date.fromisoformat(closing) < today


def job_lastmod(job: dict) -> str:
    # Posted date when we have one. Otherwise the day the listing was fetched.
    # Skip the tag when neither is a real date.
    posted = posting_date(job)
    if posted:
        return posted
    return iso_date(text(job.get("fetched_at")))


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


def analytics_snippet() -> str:
    token = (CF_ANALYTICS_TOKEN or "").strip()
    if not token:
        return ""
    payload = json.dumps({"token": token}).replace("'", "&#39;")
    return (
        "    <script defer "
        'src="https://static.cloudflareinsights.com/beacon.min.js" '
        f"data-cf-beacon='{payload}'></script>"
    )


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
    ]
    if url:
        lines.append(f'    <meta property="og:url" content="{escape(url, quote=True)}" />')
    lines.extend(
        [
            '    <meta property="og:type" content="website" />',
            f'    <meta property="og:site_name" content="{escape(BRAND)}" />',
        ]
    )
    image = configured_value(OG_IMAGE_URL, "[OG_IMAGE_URL]")
    if image:
        lines.append(
            f'    <meta property="og:image" content="{escape(image, quote=True)}" />'
        )
        lines.append('    <meta property="og:image:width" content="1200" />')
        lines.append('    <meta property="og:image:height" content="630" />')
        lines.append(
            f'    <meta property="og:image:alt" content="{escape(OG_IMAGE_ALT)}" />'
        )
    return "\n".join(lines)


def shared_head(
    title: str,
    description: str,
    canonical: str,
    css_href: str,
    extra_css: str = "",
    robots: str = "",
    asset_origin: str = "",
    extra_head: str = "",
) -> str:
    def rooted(path: str) -> str:
        return f"{asset_origin}{path}" if asset_origin else path

    extra = ""
    if extra_css:
        extra = f'\n    <link rel="stylesheet" href="{escape(extra_css, quote=True)}" />'
    pixel = pixel_snippet()
    pixel_block = f"\n{pixel}" if pixel else ""
    analytics = analytics_snippet()
    analytics_block = f"\n{analytics}" if analytics else ""
    extra_head_block = f"\n{extra_head}" if extra_head else ""
    robots_tag = (
        f'\n    <meta name="robots" content="{escape(robots, quote=True)}" />' if robots else ""
    )
    canonical_tag = (
        f'\n    <link rel="canonical" href="{escape(canonical, quote=True)}" />'
        if canonical
        else ""
    )
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="google-site-verification" content="snN0wTgRbpJxtyxaevQl1EQhaPh61CSRjOeVh7IjMQY" />
    <link rel="icon" href="{rooted("/favicon.ico")}" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="{rooted("/favicon-32x32.png")}">
    <link rel="apple-touch-icon" href="{rooted("/apple-touch-icon.png")}">
    <title>{escape(title)}</title>
    <meta name="description" content="{escape(description)}" />{robots_tag}{canonical_tag}
{og_tags(title, description, canonical)}
{FONT_LINKS}
    <link rel="stylesheet" href="{escape(css_href, quote=True)}" />{extra}{pixel_block}{analytics_block}{extra_head_block}
  </head>"""


def site_header(home_href: str, current: str = "", link_base: str = "") -> str:
    def nav_link(label: str, href: str, key: str) -> str:
        current_attr = ' aria-current="page"' if current == key else ""
        full = f"{link_base}{href}" if link_base else href
        return f'<a href="{escape(full, quote=True)}"{current_attr}>{escape(label)}</a>'

    return f"""    <header class="site-header">
      <div class="header-inner">
        <a class="site-name" href="{escape(home_href, quote=True)}">PublicJobs.ca</a>
        <nav class="site-nav" aria-label="Site">
          {nav_link("Match your resume", "/match/", "match")}
          {nav_link("Employers", "/employers/", "employers")}
          {nav_link("About", "/about/", "about")}
          {nav_link("FAQ", "/faq/", "faq")}
          {nav_link("Privacy", "/privacy/", "privacy")}
          {nav_link("Terms", "/terms/", "terms")}
        </nav>
      </div>
    </header>"""


def site_footer() -> str:
    return f"""    <footer class="site-footer">
      <div class="content">
        <p>{escape(FOOTER)}</p>
        <nav class="footer-nav" aria-label="Footer">
          <a href="/faq/">Frequently asked questions</a>
        </nav>
      </div>
    </footer>"""


# Place names that show up in listings. Region and country complete a
# PostalAddress when the location string names the place and leaves the
# province out. A Toronto/GTA place keeps its own city; it is not rewritten
# to Toronto.
PLACE_ADDRESS = {
    "toronto": ("Toronto", "ON", "CA"),
    "toront": ("Toronto", "ON", "CA"),
    "downtown toronto": ("Toronto", "ON", "CA"),
    "toronto west": ("Toronto", "ON", "CA"),
    "north york": ("North York", "ON", "CA"),
    "scarborough": ("Scarborough", "ON", "CA"),
    "etobicoke": ("Etobicoke", "ON", "CA"),
    "rexdale": ("Rexdale", "ON", "CA"),
    "mississauga": ("Mississauga", "ON", "CA"),
    "vaughan": ("Vaughan", "ON", "CA"),
    "markham": ("Markham", "ON", "CA"),
    "richmond hill": ("Richmond Hill", "ON", "CA"),
    "oakville": ("Oakville", "ON", "CA"),
    "burlington": ("Burlington", "ON", "CA"),
    "milton": ("Milton", "ON", "CA"),
    "pickering": ("Pickering", "ON", "CA"),
    "ajax": ("Ajax", "ON", "CA"),
    "whitby": ("Whitby", "ON", "CA"),
    "oshawa": ("Oshawa", "ON", "CA"),
    "newmarket": ("Newmarket", "ON", "CA"),
    "whitchurch-stouffville": ("Whitchurch-Stouffville", "ON", "CA"),
    "georgetown": ("Georgetown", "ON", "CA"),
    "halton": ("Halton", "ON", "CA"),
    "durham": ("Durham", "ON", "CA"),
    "peel region": ("Peel Region", "ON", "CA"),
    "hamilton": ("Hamilton", "ON", "CA"),
    "kitchener": ("Kitchener", "ON", "CA"),
    "ottawa": ("Ottawa", "ON", "CA"),
    "sault ste. marie": ("Sault Ste. Marie", "ON", "CA"),
    "grand sudbury": ("Grand Sudbury", "ON", "CA"),
    "montreal": ("Montreal", "QC", "CA"),
    "montréal": ("Montréal", "QC", "CA"),
    "regina": ("Regina", "SK", "CA"),
    "calgary": ("Calgary", "AB", "CA"),
    "new york": ("New York", "NY", "US"),
}
PLACE_RE = re.compile(
    r"\b(?:"
    + "|".join(re.escape(name) for name in sorted(PLACE_ADDRESS, key=len, reverse=True))
    + r")\b",
    re.I,
)
REGION_BY_TOKEN = {
    "ontario": "ON",
    "on": "ON",
    "quebec": "QC",
    "québec": "QC",
    "qc": "QC",
    "saskatchewan": "SK",
    "sk": "SK",
    "alberta": "AB",
    "ab": "AB",
    "british columbia": "BC",
    "bc": "BC",
    "manitoba": "MB",
    "mb": "MB",
    "new brunswick": "NB",
    "nb": "NB",
    "nova scotia": "NS",
    "ns": "NS",
    "prince edward island": "PE",
    "pe": "PE",
    "newfoundland and labrador": "NL",
    "nl": "NL",
    "ny": "NY",
}
REGION_RE = re.compile(
    r"\b(?:"
    + "|".join(re.escape(name) for name in sorted(REGION_BY_TOKEN, key=len, reverse=True))
    + r")\b",
    re.I,
)
COUNTRY_BY_TOKEN = {
    "canada": "CA",
    "ca": "CA",
    "united states": "US",
    "usa": "US",
    "us": "US",
}
COUNTRY_RE = re.compile(
    r"\b(?:"
    + "|".join(re.escape(name) for name in sorted(COUNTRY_BY_TOKEN, key=len, reverse=True))
    + r")\b",
    re.I,
)
COUNTRY_BY_REGION = {
    "ON": "CA",
    "QC": "CA",
    "SK": "CA",
    "AB": "CA",
    "BC": "CA",
    "MB": "CA",
    "NB": "CA",
    "NS": "CA",
    "PE": "CA",
    "NL": "CA",
    "NY": "US",
}
POSTAL_RE = re.compile(
    r"\b([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])\s?(\d[ABCEGHJ-NPRSTV-Z]\d)\b",
    re.I,
)
STREET_RE = re.compile(
    r"\b\d{1,6}\s+(?:[A-Za-zÀ-ÿ0-9.'’\-]+\s+){0,5}"
    r"(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|"
    r"Court|Crt|Place|Pl|Crescent|Cres|Terrace|Terr|Parkway|Pkwy|Square|Sq)"
    r"\.?(?:\s+(?:West|East|North|South|[WENS]))?\b",
    re.I,
)
FRENCH_STREET_RE = re.compile(
    r"\b\d{1,6}\s+(?:rue|chemin)\s+[A-Za-zÀ-ÿ0-9.'’\-]+",
    re.I,
)
NUMBERED_SITE_RE = re.compile(
    r"(?:^|[–—-])\s*(\d{1,6}\s+[A-Za-z][A-Za-z0-9.'’\-]{1,40})\s*$"
)
UNNUMBERED_STREET_RE = re.compile(
    r"^(?:[A-Za-zÀ-ÿ0-9.'’\-]+\s+){1,4}"
    r"(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|"
    r"Court|Crt|Place|Pl|Crescent|Cres|Terrace|Terr|Parkway|Pkwy|Square|Sq)\.?$",
    re.I,
)
GTA_ONLY_RE = re.compile(
    r"^(?:gta|greater toronto(?:\s+area)?|greater toronto and hamilton area|gtha)$",
    re.I,
)
SALARY_CURRENCIES = {"CAD", "USD", "EUR", "GBP"}
SALARY_UNITS = {
    "HOUR": "HOUR",
    "HOURLY": "HOUR",
    "HR": "HOUR",
    "DAY": "DAY",
    "DAILY": "DAY",
    "WEEK": "WEEK",
    "WEEKLY": "WEEK",
    "MONTH": "MONTH",
    "MONTHLY": "MONTH",
    "YEAR": "YEAR",
    "YEARLY": "YEAR",
    "ANNUAL": "YEAR",
    "ANNUALLY": "YEAR",
}
EXPLICIT_SALARY_RE = (
    re.compile(
        r"^(?P<cur>CAD|USD|EUR|GBP)\s+(?P<min>\d+(?:\.\d+)?)\s*[-–—]\s*"
        r"(?P<max>\d+(?:\.\d+)?)\s*\((?P<unit>year|hour|month|week|day)\)$",
        re.I,
    ),
    re.compile(
        r"^\$?(?P<min>\d+(?:,\d{3})*(?:\.\d+)?)\s*/\s*"
        r"(?P<unit>hour|hr|year|month|week|day)\s*\((?P<cur>CAD|USD|EUR|GBP)\)$",
        re.I,
    ),
    re.compile(
        r"^\$?(?P<min>\d+(?:,\d{3})*(?:\.\d+)?)\s*[-–—]\s*\$?(?P<max>\d+(?:,\d{3})*(?:\.\d+)?)\s*/\s*"
        r"(?P<unit>hour|hr|year|month|week|day)\s*\((?P<cur>CAD|USD|EUR|GBP)\)$",
        re.I,
    ),
)


def first_iso_date(job: dict, keys: tuple[str, ...]) -> str:
    for key in keys:
        found = iso_date(text(job.get(key)))
        if found:
            return found
    return ""


def posting_date(job: dict) -> str:
    # fetched_at is the scrape time, not the date the employer posted the job.
    return first_iso_date(
        job,
        (
            "posted_date",
            "posted",
            "date_posted",
            "datePosted",
            "first_seen",
            "first_seen_date",
            "firstSeen",
            "first_seen_at",
        ),
    )


def closing_date(job: dict) -> str:
    return first_iso_date(
        job,
        (
            "closing_date",
            "closes",
            "valid_through",
            "validThrough",
            "application_deadline",
        ),
    )


def job_description_html(job: dict) -> str:
    for key in ("description_html", "descriptionHtml"):
        raw = job.get(key)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    # Plain text is escaped and wrapped in paragraphs. Do not run it through the
    # HTML parser: a literal "</script>" in the posting must survive as text.
    paragraphs = html_to_paragraphs(text(job.get("description")), interpret_html=False)
    if not paragraphs:
        return ""
    return "".join(f"<p>{escape(paragraph, quote=False)}</p>" for paragraph in paragraphs)


def employer_same_as(job: dict) -> str:
    for key in (
        "employer_url",
        "employer_website",
        "employer_site",
        "organization_url",
        "website",
        "same_as",
        "sameAs",
    ):
        raw = text(job.get(key))
        if raw.startswith("http://") or raw.startswith("https://"):
            return raw
    return ""


def employment_types(raw: str) -> list[str]:
    value = text(raw).lower()
    if not value:
        return []
    found: list[str] = []

    def add(token: str) -> None:
        if token not in found:
            found.append(token)

    if re.search(r"\bfull[\s-]?time\b", value):
        add("FULL_TIME")
    if re.search(r"\bpart[\s-]?time\b", value):
        add("PART_TIME")
    if re.search(r"\bcontracts?\b|\bcontractor\b", value):
        add("CONTRACTOR")
    if re.search(r"\btemporary\b|\bfixed[\s-]?term\b", value):
        add("TEMPORARY")
    if re.search(r"\bintern(?:ship)?\b|\bco-?ops?\b", value):
        add("INTERN")
    if re.search(r"\bvolunteer\b", value):
        add("VOLUNTEER")
    if re.search(r"\bper[\s-]?diem\b", value):
        add("PER_DIEM")
    return found


def fully_remote(job: dict) -> bool:
    mode = re.sub(r"[\s_-]+", " ", text(job.get("work_mode")).lower()).strip()
    return mode in {"remote", "fully remote", "work from home", "telecommute"}


def as_number(item):
    if isinstance(item, bool) or item is None:
        return None
    if isinstance(item, int):
        return item
    if isinstance(item, float):
        if item != item or item in {float("inf"), float("-inf")}:
            return None
        return item
    if isinstance(item, str) and item.strip():
        cleaned = item.strip().replace(",", "").replace(" ", "")
        if not re.fullmatch(r"\d+(?:\.\d+)?", cleaned):
            return None
        if "." in cleaned:
            return float(cleaned)
        return int(cleaned)
    return None


def salary_unit(raw: str) -> str:
    token = re.sub(r"[\s_-]+", "", text(raw).upper())
    return SALARY_UNITS.get(token, "")


def monetary_amount(currency: str, unit: str, numbers: dict) -> dict | None:
    code = text(currency).upper()
    unit_text = salary_unit(unit)
    if code not in SALARY_CURRENCIES or not unit_text or not numbers:
        return None
    if (
        "minValue" in numbers
        and "maxValue" in numbers
        and numbers["minValue"] > numbers["maxValue"]
    ):
        return None
    quantitative = {"@type": "QuantitativeValue", "unitText": unit_text}
    for key in ("minValue", "maxValue", "value"):
        if key in numbers:
            quantitative[key] = numbers[key]
    return {"@type": "MonetaryAmount", "currency": code, "value": quantitative}


def salary_from_mapping(raw: dict) -> dict | None:
    value = raw.get("value")
    min_value = raw.get("minValue", raw.get("min"))
    max_value = raw.get("maxValue", raw.get("max"))
    unit = text(raw.get("unitText") or raw.get("unit") or "")
    if isinstance(value, dict):
        unit = unit or text(value.get("unitText") or value.get("unit") or "")
        min_value = value.get("minValue", min_value)
        max_value = value.get("maxValue", max_value)
        value = value.get("value")
    numbers = {}
    for key, item in (("minValue", min_value), ("maxValue", max_value), ("value", value)):
        number = as_number(item)
        if number is not None:
            numbers[key] = number
    if "value" in numbers and ("minValue" in numbers or "maxValue" in numbers):
        numbers.pop("value")
    return monetary_amount(text(raw.get("currency") or raw.get("currencyCode")), unit, numbers)


def salary_from_text(raw: str) -> dict | None:
    cleaned = re.sub(r"\s+", " ", text(raw))
    if not cleaned:
        return None
    for pattern in EXPLICIT_SALARY_RE:
        match = pattern.fullmatch(cleaned)
        if not match:
            continue
        numbers = {}
        minimum = as_number(match.group("min"))
        if minimum is None:
            return None
        maximum = as_number(match.groupdict().get("max"))
        if maximum is None:
            numbers["value"] = minimum
        else:
            numbers["minValue"] = minimum
            numbers["maxValue"] = maximum
        return monetary_amount(match.group("cur"), match.group("unit"), numbers)
    return None


def base_salary(job: dict) -> dict | None:
    for key in ("base_salary", "baseSalary", "salary_structured", "structured_salary"):
        raw = job.get(key)
        if isinstance(raw, dict):
            parsed = salary_from_mapping(raw)
            if parsed:
                return parsed
        elif isinstance(raw, str):
            parsed = salary_from_text(raw)
            if parsed:
                return parsed
    raw_salary = job.get("salary")
    if isinstance(raw_salary, dict):
        return salary_from_mapping(raw_salary)
    if isinstance(raw_salary, str):
        return salary_from_text(raw_salary)
    return None


def explicit_job_id(job: dict) -> str:
    for key in ("id", "job_id", "requisition_id", "req_id", "posting_id"):
        raw = job.get(key)
        if isinstance(raw, bool) or raw is None:
            continue
        if isinstance(raw, (int, float)):
            if isinstance(raw, float) and not raw.is_integer():
                continue
            return str(int(raw))
        value = text(raw)
        if value:
            return value
    return ""


def apply_job_id(url: str) -> str:
    raw = text(url)
    if not raw:
        return ""
    parsed = urlparse(raw)
    query = parse_qs(parsed.query)
    for key in ("career_job_req_id", "gh_jid", "jobId", "opportunityId"):
        values = query.get(key) or []
        if values and text(values[0]):
            return text(values[0])
    path = unquote(parsed.path).rstrip("/")
    segment = path.split("/")[-1] if path else ""
    match = re.search(r"_((?:JR|R)[-_]?\d[\w-]*)$", segment, re.I)
    if match:
        return match.group(1)
    if re.fullmatch(r"\d+", segment):
        return segment
    if re.fullmatch(
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
        segment,
    ):
        return segment.lower()
    match = re.search(r"/view/([A-Za-z0-9]{8,})(?:/|$)", path)
    if match:
        return match.group(1)
    match = re.search(r"/apply/([A-Za-z0-9]{6,})(?:/|$)", path)
    if match:
        return match.group(1)
    if "myworkdayjobs.com" not in parsed.netloc.lower():
        match = re.search(r"/job/([A-Za-z0-9]{6,})$", path)
        if match:
            return match.group(1)
    return ""


def clean_location_segment(part: str) -> str:
    cleaned = re.sub(r"\s+", " ", part).strip(" .")
    cleaned = re.sub(r"\s*\([^)]*\)\s*", " ", cleaned)
    cleaned = re.sub(
        r"^(?:hybrid|remote|on[\s-]?site)\s*[·•|\-–—:/]+\s*",
        "",
        cleaned,
        flags=re.I,
    )
    cleaned = re.sub(
        r"\s*[·•|\-–—]\s*(?:hybrid(?:\s*/\s*on[\s-]?site)?|on[\s-]?site|remote)\s*$",
        "",
        cleaned,
        flags=re.I,
    )
    return re.sub(r"\s+", " ", cleaned).strip(" ,.-")


def cut_match(source: str, match: re.Match) -> str:
    return re.sub(r"\s+", " ", (source[: match.start()] + " " + source[match.end():])).strip(" ,.-/")


def postal_address(street: str, locality: str, region: str, postal: str, country: str) -> dict:
    address = {"@type": "PostalAddress"}
    if street:
        address["streetAddress"] = street
    if locality:
        address["addressLocality"] = locality
    if region:
        address["addressRegion"] = region
    if postal:
        address["postalCode"] = postal
    if country:
        address["addressCountry"] = country
    return {"@type": "Place", "address": address}


def parse_location_segment(part: str) -> list[dict]:
    segment = clean_location_segment(part)
    if not segment:
        return []
    postal = ""
    postal_match = POSTAL_RE.search(segment)
    if postal_match:
        postal = f"{postal_match.group(1)} {postal_match.group(2)}".upper()
        segment = cut_match(segment, postal_match)
    street = ""
    street_match = STREET_RE.search(segment) or FRENCH_STREET_RE.search(segment)
    if not street_match:
        for piece in segment.split(","):
            candidate = piece.strip()
            if UNNUMBERED_STREET_RE.fullmatch(candidate):
                street_match = re.search(re.escape(candidate), segment)
                break
    if street_match:
        street = re.sub(r"\s+", " ", street_match.group(0)).strip()
        segment = cut_match(segment, street_match)
    elif segment:
        numbered = NUMBERED_SITE_RE.search(segment)
        if numbered and not re.search(r"\b(?:month|months|year|years|hour|hours)\b", numbered.group(1), re.I):
            street = re.sub(r"\s+", " ", numbered.group(1)).strip()
            segment = cut_match(segment, numbered)
    places = []
    seen_localities = set()
    for match in PLACE_RE.finditer(segment):
        locality, region, country = PLACE_ADDRESS[match.group(0).lower()]
        if locality in seen_localities:
            continue
        seen_localities.add(locality)
        places.append((locality, region, country))
    regions = []
    for match in REGION_RE.finditer(segment):
        code = REGION_BY_TOKEN[match.group(0).lower()]
        if code not in regions:
            regions.append(code)
    countries = []
    for match in COUNTRY_RE.finditer(segment):
        code = COUNTRY_BY_TOKEN[match.group(0).lower()]
        if code not in countries:
            countries.append(code)
    region_override = regions[0] if len(regions) == 1 else ""
    country_override = countries[0] if len(countries) == 1 else ""
    if not places and region_override:
        country = country_override or COUNTRY_BY_REGION.get(region_override, "")
        if country:
            return [postal_address("", "", region_override, postal if not places else "", country)]
    if not places and GTA_ONLY_RE.fullmatch(segment):
        return [postal_address("", "Toronto", "ON", "", "CA")]
    if not places:
        return []
    located = []
    attach_detail = len(places) == 1
    for locality, region, country in places:
        use_region = region_override or region
        use_country = country_override or COUNTRY_BY_REGION.get(use_region, "") or country
        # A province named in the text wins over the place table when they disagree.
        if region_override and COUNTRY_BY_REGION.get(region_override) and not country_override:
            use_country = COUNTRY_BY_REGION[region_override]
        located.append(
            postal_address(
                street if attach_detail else "",
                locality,
                use_region,
                postal if attach_detail else "",
                use_country,
            )
        )
    return [place for place in located if place["address"].get("addressCountry")]


def job_locations(raw: str) -> list[dict]:
    cleaned = re.sub(r"\s+", " ", text(raw)).strip()
    if not cleaned:
        return []
    places: list[dict] = []
    seen = set()
    for part in re.split(r"\s*;\s*", cleaned):
        for place in parse_location_segment(part):
            key = tuple(sorted(place["address"].items()))
            if key in seen:
                continue
            seen.add(key)
            places.append(place)
    if places:
        return places
    if re.search(r"\b(?:toronto|gta|greater toronto)\b", cleaned, re.I) or GTA_ONLY_RE.fullmatch(cleaned):
        return [postal_address("", "Toronto", "ON", "", "CA")]
    return []


def job_posting_data(job: dict) -> dict | None:
    title = text(job.get("title"))
    employer = text(job.get("employer"))
    description = job_description_html(job)
    if not title or not employer or not description:
        return None
    data = {
        "@context": "https://schema.org/",
        "@type": "JobPosting",
        "title": title,
        "description": description,
    }
    job_id = explicit_job_id(job) or apply_job_id(text(job.get("apply_url")))
    if job_id:
        data["identifier"] = {
            "@type": "PropertyValue",
            "name": employer,
            "value": job_id,
        }
    posted = posting_date(job)
    if posted:
        data["datePosted"] = posted
    closes = closing_date(job)
    if closes:
        data["validThrough"] = closes
    types = employment_types(text(job.get("employment_type")))
    if len(types) == 1:
        data["employmentType"] = types[0]
    elif types:
        data["employmentType"] = types
    organization = {"@type": "Organization", "name": employer}
    same_as = employer_same_as(job)
    if same_as:
        organization["sameAs"] = same_as
    data["hiringOrganization"] = organization
    places = job_locations(text(job.get("location")))
    if len(places) == 1:
        data["jobLocation"] = places[0]
    elif places:
        data["jobLocation"] = places
    if fully_remote(job):
        data["jobLocationType"] = "TELECOMMUTE"
    salary = base_salary(job)
    if salary:
        data["baseSalary"] = salary
    return data


def job_posting_json_ld(job: dict) -> str:
    data = job_posting_data(job)
    if not data:
        return ""
    payload = json_for_script([data])[1:-1]
    return f'    <script type="application/ld+json">{payload}</script>'


def render_job_page(job: dict, closed: bool = False) -> str:
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
    closed_block = ""
    if closed:
        closed_block = '        <p class="closed-banner" role="status">This job has closed</p>\n'
    robots = "noindex" if closed else ""
    return f"""{shared_head(page_title, meta_desc, canonical, "../../../styles.css", robots=robots, extra_head=job_posting_json_ld(job))}
  <body>
{site_header("../../../")}
    <main>
      <article class="job-page content">
        <p class="crumb"><a href="../../../">All openings</a></p>
{closed_block}        <h1>{escape(title)}</h1>
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
                <p class="privacy-link"><a href="/privacy/">Privacy policy</a> <a href="/terms/">Terms of use</a></p>
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


def render_info_page(
    title: str,
    heading: str,
    description: str,
    path: str,
    body: str,
    extra_head: str = "",
) -> str:
    canonical = f"{SITE_URL}/{path}"
    if path.startswith("employers"):
        current = "employers"
    elif path.startswith("about"):
        current = "about"
    elif path.startswith("faq"):
        current = "faq"
    elif path.startswith("privacy"):
        current = "privacy"
    elif path.startswith("terms"):
        current = "terms"
    else:
        current = ""
    head = shared_head(title, description, canonical, "../styles.css", extra_css="../pages.css")
    if extra_head:
        head = head.replace("\n  </head>", f"\n{extra_head}\n  </head>", 1)
    return f"""{head}
  <body>
{site_header("../", current)}
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
    body = """          <p>Last updated: October 4, 2026</p>
          <p>PublicJobs.ca is an independent job board. It is not affiliated with any government or with any employer listed on the site. This page explains what personal information we collect, why, and how you can control it.</p>
          <h2>Who we are</h2>
          <p>PublicJobs.ca is operated by Osama Chaudhary, 65 Thorncliffe Park Drive, Apartment 603, Toronto, Ontario M4H 1L2, Canada. Contact: <a href="mailto:hello@publicjobs.ca">hello@publicjobs.ca</a>.</p>
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
          <h2>Resume match</h2>
          <p>If you use the resume match tool, your resume is read to find matches and is not stored. We keep only a one-way code made from your email address to count your free uses.</p>
          <h2>Advertising and measurement</h2>
          <p>We use the Meta Pixel, a tool from Meta Platforms, Inc., to measure how well our ads on Facebook and Instagram work. When you visit PublicJobs.ca, the Meta Pixel may use cookies and similar technology to collect information such as the pages you view, whether you signed up for alerts, whether you clicked through to an employer's site, and technical details about your browser and device. Meta may use this information as described in its own privacy policy (<a href="https://facebook.com/privacy/policy">facebook.com/privacy/policy</a>). We do not send your email address to Meta. You can control ad personalization in your Facebook and Instagram ad settings, and you can block or delete cookies in your browser settings.</p>
          <h2>Site analytics and fonts</h2>
          <p>We use Cloudflare Web Analytics to count visits. It uses no cookies and does not track you across sites. It records things like the page you visited, the referring site, your browser, and your country.</p>
          <p>This site loads fonts from Google Fonts. Loading those fonts sends your IP address to Google.</p>
          <h2>Service providers</h2>
          <p>We use trusted service providers to run this site and our emails: Cloudflare (runs the signup form), Resend (stores the mailing list and sends the emails), and Meta (ad measurement, described above). These providers may store information outside Canada, including in the United States, where it may be subject to local laws.</p>
          <h2>Unsubscribing</h2>
          <p>Every alert email includes a one-click unsubscribe link. You can also email <a href="mailto:hello@publicjobs.ca">hello@publicjobs.ca</a> and we will remove you.</p>
          <h2>How long we keep it</h2>
          <p>We keep your email address while you are subscribed. If you unsubscribe, we stop sending emails and delete or suppress your address within a reasonable time, keeping only what we need to make sure you are not emailed again.</p>
          <h2>Your rights</h2>
          <p>You can ask to see the personal information we hold about you, ask us to correct it, or withdraw your consent at any time by emailing <a href="mailto:hello@publicjobs.ca">hello@publicjobs.ca</a>. If you are not satisfied with our response, you can contact the Office of the Privacy Commissioner of Canada at <a href="https://priv.gc.ca">priv.gc.ca</a>.</p>
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
          <p>Questions or corrections: <a href="mailto:hello@publicjobs.ca">hello@publicjobs.ca</a>. See our privacy policy at <a href="/privacy/">/privacy/</a>. See our terms of use at <a href="/terms/">/terms/</a>.</p>"""
    return render_info_page(
        f"About | {BRAND}",
        "About PublicJobs.ca",
        ABOUT_DESCRIPTION,
        "about/",
        body,
    )


TERMS_DESCRIPTION = (
    "Terms for using PublicJobs.ca, an independent job board. Listings come "
    "from employers' public career sites, and you apply on the employer's site."
)


def terms_json_ld() -> str:
    data = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "Terms of use",
        "url": f"{SITE_URL}/terms/",
        "description": TERMS_DESCRIPTION,
    }
    payload = json_for_script([data])[1:-1]
    return f'    <script type="application/ld+json">{payload}</script>'


def render_terms_page() -> str:
    body = """          <p>Last updated September 28, 2026</p>
          <h2>Who runs the site</h2>
          <p>PublicJobs.ca is operated by Osama Chaudhary, 65 Thorncliffe Park Drive, Apartment 603, Toronto, Ontario M4H 1L2, Canada. Contact <a href="mailto:hello@publicjobs.ca">hello@publicjobs.ca</a>.</p>
          <h2>An independent site</h2>
          <p>PublicJobs.ca is independent. It is not affiliated with or endorsed by any government or any employer listed on the site.</p>
          <h2>Listings</h2>
          <p>Listings are collected from employers' public career sites. They may be out of date, closed, or changed. Always confirm the details on the employer's site. We do not guarantee that the listings are accurate or complete.</p>
          <h2>Applying</h2>
          <p>We never charge job seekers, and we do not take applications. Applying happens on the employer's site.</p>
          <h2>External links</h2>
          <p>Links to other websites are not ours. We are not responsible for those sites.</p>
          <h2>Email alerts</h2>
          <p>Email alerts are optional. We send them only with your consent. Every email has an unsubscribe link. See our <a href="/privacy/">privacy policy</a>.</p>
          <h2>Acceptable use</h2>
          <p>Do not scrape the site in a way that overloads it. Do not misuse the signup form, for example by signing up other people.</p>
          <h2>No warranties</h2>
          <p>The site is provided as is, with no warranties. To the extent permitted by law, we are not liable for losses from using the site or the listings.</p>
          <h2>Changes to these terms</h2>
          <p>We may update these terms. When we do, the date at the top of this page changes.</p>
          <h2>Governing law</h2>
          <p>These terms are governed by the laws of Ontario and the federal laws of Canada that apply there.</p>"""
    return render_info_page(
        f"Terms of use | {BRAND}",
        "Terms of use",
        TERMS_DESCRIPTION,
        "terms/",
        body,
        extra_head=terms_json_ld(),
    )


def write_terms_page() -> None:
    path = ROOT / "terms" / "index.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_terms_page(), encoding="utf-8")


MATCH_DESCRIPTION = (
    "Upload your resume and see which current public sector jobs in Toronto "
    "and the GTA fit your experience. Free. Your resume is not stored."
)

MATCH_MAIN = """      <h1>Match your resume</h1>
      <p class="lede">Add your resume and we will check it against every current opening on PublicJobs.ca. We show any job you might qualify for, so you do not miss one. Free, up to 3 times.</p>

      <form id="match-form" novalidate>
        <fieldset>
          <legend>1. Your email</legend>
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required autocomplete="email" inputmode="email" maxlength="254" placeholder="you@example.com" />
          <label class="checkbox" for="consent">
            <input type="checkbox" id="consent" name="casl_consent" value="yes" required />
            <span>I agree to receive job alert emails from PublicJobs.ca at this address. I can unsubscribe anytime.</span>
          </label>
          <p class="hint">You need to agree to see your matches. We send new jobs once a week.</p>
        </fieldset>

        <fieldset>
          <legend>2. Your resume</legend>
          <label for="resume-file">Upload a PDF or Word file</label>
          <input type="file" id="resume-file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
          <p class="hint" id="file-status" aria-live="polite">Your file stays on your device. Only the text is read.</p>
          <p class="or">Or paste your resume text</p>
          <label for="resume-text">Resume text</label>
          <textarea id="resume-text" maxlength="15000" placeholder="Paste your work experience, education and skills"></textarea>
        </fieldset>

        <div class="hp" aria-hidden="true">
          <label for="gotcha">Leave this field blank</label>
          <input type="text" id="gotcha" name="_gotcha" tabindex="-1" autocomplete="off" />
        </div>

        <button type="submit" id="submit-btn">Find my jobs</button>
        <p class="hint">Your resume is read to find matches and is not stored. <a href="/privacy/">Privacy policy</a></p>
        <div id="status" class="status" role="status" aria-live="polite" hidden></div>
      </form>

      <section id="results" hidden aria-labelledby="results-title">
        <h2 id="results-title" tabindex="-1">Your matches</h2>
        <p id="results-summary"></p>
        <div id="strong-wrap" hidden>
          <h2>Strong matches</h2>
          <ol class="results" id="strong-list"></ol>
        </div>
        <div id="maybe-wrap" hidden>
          <h2>Worth a look</h2>
          <p class="hint">These are related to your experience or could be a step up. Read the posting to decide.</p>
          <ol class="results" id="maybe-list"></ol>
        </div>
        <p><a href="/">See all openings</a></p>
      </section>"""

MATCH_SCRIPT = """    <script>
      (function () {
        var ENDPOINT = "https://publicjobs-resume-match.publicjobs.workers.dev/match";
        var MAX = 15000;
        var form = document.getElementById("match-form");
        var fileInput = document.getElementById("resume-file");
        var fileStatus = document.getElementById("file-status");
        var textArea = document.getElementById("resume-text");
        var statusEl = document.getElementById("status");
        var btn = document.getElementById("submit-btn");
        var fileText = "";

        function setStatus(msg, isError) {
          statusEl.textContent = msg;
          statusEl.className = "status" + (isError ? " error" : "");
          statusEl.hidden = !msg;
        }
        function loadScript(src) {
          return new Promise(function (resolve, reject) {
            var s = document.createElement("script");
            s.src = src; s.onload = resolve; s.onerror = reject;
            s.integrity = "sha384-/cXAMbzovUIKbBERjPmR3SnPTh8siWr5lsvFYj1Uq4XP0yaJUZJmsh0YXyGv5P0y";
            s.crossOrigin = "anonymous";
            document.head.appendChild(s);
          });
        }
        async function pdfText(buf) {
          var pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
          pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
          var doc = await pdfjs.getDocument({ data: buf }).promise;
          var out = [];
          for (var i = 1; i <= Math.min(doc.numPages, 10); i++) {
            var page = await doc.getPage(i);
            var c = await page.getTextContent();
            out.push(c.items.map(function (it) { return it.str + (it.hasEOL ? "\\n" : " "); }).join(""));
          }
          return out.join("\\n");
        }
        async function docxText(buf) {
          if (!window.mammoth) await loadScript("https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js");
          var r = await window.mammoth.extractRawText({ arrayBuffer: buf });
          return r.value;
        }
        fileInput.addEventListener("change", async function () {
          fileText = "";
          var f = fileInput.files && fileInput.files[0];
          if (!f) return;
          if (f.size > 10 * 1024 * 1024) { fileStatus.textContent = "That file is too large. Use a file under 10 MB, or paste the text."; return; }
          fileStatus.textContent = "Reading your file...";
          try {
            var buf = await f.arrayBuffer();
            var name = f.name.toLowerCase();
            if (name.endsWith(".pdf")) fileText = await pdfText(buf);
            else if (name.endsWith(".docx")) fileText = await docxText(buf);
            else { fileStatus.textContent = "Use a PDF or Word (.docx) file, or paste the text."; return; }
            fileText = fileText.replace(/[ \\t]+/g, " ").replace(/\\n{3,}/g, "\\n\\n").trim();
            if (fileText.length < 80) { fileStatus.textContent = "We could not read text from this file. It may be a scanned image. Please paste the text instead."; fileText = ""; return; }
            fileStatus.textContent = "Read your file (" + Math.min(fileText.length, MAX).toLocaleString() + " characters). Your file stays on your device.";
          } catch (e) {
            fileText = "";
            fileStatus.textContent = "We could not read this file. Please paste the text instead.";
          }
        });
        function render(listId, wrapId, items) {
          var list = document.getElementById(listId);
          list.innerHTML = "";
          items.forEach(function (j) {
            var li = document.createElement("li");
            var a = document.createElement("a"); a.href = j.url; a.textContent = j.title;
            var meta = document.createElement("p"); meta.className = "meta";
            meta.textContent = [j.employer, j.location, j.closing_date ? "Closes " + j.closing_date : ""].filter(Boolean).join(" · ");
            var why = document.createElement("p"); why.className = "why"; why.textContent = j.reason;
            li.appendChild(a); li.appendChild(meta); li.appendChild(why);
            list.appendChild(li);
          });
          document.getElementById(wrapId).hidden = items.length === 0;
        }
        form.addEventListener("submit", async function (e) {
          e.preventDefault();
          var email = document.getElementById("email").value.trim();
          var consent = document.getElementById("consent").checked;
          var resume = (textArea.value.trim() || fileText).slice(0, MAX);
          if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !consent) { setStatus("Enter your email and check the box to agree to job alert emails.", true); return; }
          if (resume.length < 80) { setStatus("Add your resume. Upload a PDF or Word file, or paste the text.", true); return; }
          btn.disabled = true; btn.textContent = "Checking jobs...";
          setStatus("Checking your resume against every current opening. This takes about 30 to 60 seconds. Please keep this page open.", false);
          try {
            var res = await fetch(ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ email: email, casl_consent: "yes", resume_text: resume, _gotcha: document.getElementById("gotcha").value })
            });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || !data.ok) { setStatus(data.error || "Something went wrong. Please try again.", true); return; }
            setStatus("", false);
            var n = data.strong.length + data.maybe.length;
            document.getElementById("results-summary").textContent = n
              ? "We found " + n + " jobs out of " + data.jobs_checked + " that could fit you. You have " + data.remaining + " free " + (data.remaining === 1 ? "match" : "matches") + " left. New jobs will come to your inbox every week."
              : "We did not find a close fit right now. New jobs will come to your inbox every week, and you can browse all openings below.";
            render("strong-list", "strong-wrap", data.strong);
            render("maybe-list", "maybe-wrap", data.maybe);
            document.getElementById("results").hidden = false;
            document.getElementById("results-title").focus();
          } catch (err) {
            setStatus("Something went wrong. Please check your connection and try again.", true);
          } finally {
            btn.disabled = false; btn.textContent = "Find my jobs";
          }
        });
      })();
    </script>"""


def render_match_page() -> str:
    head = shared_head(
        f"Match your resume to public-sector jobs | {BRAND}",
        MATCH_DESCRIPTION,
        f"{SITE_URL}/match/",
        "../styles.css",
    )
    return f"""{head}
  <body>
{site_header("../", "match")}
    <main class="match">
{MATCH_MAIN}
    </main>
{site_footer()}
{MATCH_SCRIPT}
  </body>
</html>
"""


def write_match_page() -> None:
    path = ROOT / "match" / "index.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_match_page(), encoding="utf-8")
FAQ_TITLE = f"Government and Crown corporation jobs in Toronto: FAQ | {BRAND}"
FAQ_HEADING = "Frequently asked questions"
FAQ_DESCRIPTION = (
    "Answers about government jobs in Toronto: Crown corporations, Ontario "
    "provincial agencies, City of Toronto agencies, pensions, unions and who can apply."
)
CANADA_WORK_URL = (
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada.html"
)
FAQ_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def parts_from_markdown(answer: str) -> list:
    parts: list = []
    cursor = 0
    for match in FAQ_LINK_RE.finditer(answer):
        if match.start() > cursor:
            parts.append(answer[cursor:match.start()])
        parts.append({"text": match.group(1), "href": match.group(2)})
        cursor = match.end()
    if cursor < len(answer):
        parts.append(answer[cursor:])
    return parts


def faq_item(question: str, answer: str) -> dict:
    return {"question": question, "parts": parts_from_markdown(answer)}


def faq_anchor(question: str) -> str:
    value = question.casefold().replace("'", "").replace("’", "")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def faq_sections(employer_count: int) -> list[dict]:
    """Visible FAQ copy. JSON-LD uses the same words, with link labels kept."""
    employers = "employer" if employer_count == 1 else "employers"
    about = [
        faq_item(
            "What is PublicJobs.ca?",
            "PublicJobs.ca is an independent job board. "
            "It collects current job openings from public employers in Toronto and the GTA and lists them in one place.",
        ),
        faq_item(
            "What kinds of employers does PublicJobs.ca list?",
            "PublicJobs.ca lists Crown corporations, provincial and federal agencies, City of Toronto agencies, and some public-interest regulators.",
        ),
        faq_item(
            "Which employers are listed?",
            f"PublicJobs.ca lists current openings from {employer_count} public {employers} in Toronto and the GTA. "
            "The full list is on the [employers page](/employers/).",
        ),
        faq_item(
            "Is browsing PublicJobs.ca free?",
            "Yes. Browsing and searching the job board is free and does not need an account.",
        ),
        faq_item(
            "Are email alerts free?",
            "Yes. Email alerts are free. PublicJobs.ca never charges job seekers.",
        ),
        faq_item(
            "How do I apply for a job?",
            'On the job page, choose "Apply on employer site". '
            "That link leaves PublicJobs.ca and goes to the employer's own posting, where you apply. "
            "PublicJobs.ca does not take applications and does not receive them.",
        ),
        faq_item(
            "How often are jobs updated?",
            "The list of openings is refreshed each weekday. "
            "A posting can still change or close on the employer's site before the next refresh. "
            "Check the employer's posting for the latest details, including closing dates.",
        ),
        faq_item(
            "How do I get new jobs by email?",
            "Use the [signup form on the homepage](/#signup-heading). "
            "Enter your email and agree to receive free job alert emails from PublicJobs.ca.",
        ),
        faq_item(
            "How do I unsubscribe from email alerts?",
            "You can unsubscribe anytime. "
            "Every alert email includes a one-click unsubscribe link, and you can also email [hello@publicjobs.ca](mailto:hello@publicjobs.ca).",
        ),
        faq_item(
            "Can newcomers to Canada apply?",
            "Work requirements vary by employer. Check each posting to see who may apply.",
        ),
        faq_item(
            "Does PublicJobs.ca give advice on work eligibility?",
            "PublicJobs.ca does not give advice on work eligibility or immigration. "
            "For general information about working in Canada, see the "
            f"[Government of Canada page on working in Canada]({CANADA_WORK_URL}).",
        ),
        faq_item(
            "Is PublicJobs.ca run by the government?",
            "No. PublicJobs.ca is independent, is not a government website, and is not affiliated with, endorsed by, or acting for any government or any employer listed on the site.",
        ),
        faq_item(
            "Who runs PublicJobs.ca?",
            "PublicJobs.ca is operated by Osama Chaudhary. "
            "Contact [hello@publicjobs.ca](mailto:hello@publicjobs.ca).",
        ),
    ]
    levels = [
        faq_item(
            "What are the three levels of government in Canada?",
            "Canada has three levels of government: federal, provincial or territorial, and municipal. "
            "Each level runs its own services and has its own public-sector employers.",
        ),
        faq_item(
            "What does the federal government do?",
            "The federal government, based in Ottawa, handles national matters such as mail, money and banking, national defence, immigration and employment insurance.",
        ),
        faq_item(
            "What does the Ontario government do?",
            "The Ontario government runs province-wide services such as health care, education and road rules.",
        ),
        faq_item(
            "What does the City of Toronto do?",
            "The City of Toronto runs local services such as public transit, parks, parking, libraries and local police. "
            "Many of these services are run by City agencies, like the TTC and the Toronto Zoo.",
        ),
        faq_item(
            "Which levels of government do PublicJobs.ca employers belong to?",
            "We list jobs from all three levels: federal Crown corporations, Ontario provincial agencies, and City of Toronto agencies and corporations. "
            "We also list a few public-interest regulators that are not part of any government. "
            "See the full list on our [employers page](/employers/).",
        ),
    ]
    crowns = [
        faq_item(
            "What is a Crown corporation in Canada?",
            "A Crown corporation is a company owned by a government that runs much like a business but also serves public goals. "
            "Federal Crown corporations are owned directly by the Government of Canada.",
        ),
        faq_item(
            "What is the difference between a Crown corporation and a government ministry?",
            "A ministry (called a department in the federal government) is part of the core government and is led by an elected minister. "
            "A Crown corporation is a separate organization owned by the government, with its own board, that runs more like a business.",
        ),
        faq_item(
            "Is a Crown corporation job a government job?",
            "It is a public-sector job, because the employer is owned by a government. "
            "But you work for the Crown corporation itself, not for a government ministry.",
        ),
        faq_item(
            "Which federal Crown corporations are on PublicJobs.ca?",
            "We list Toronto-area jobs from federal Crown corporations including CBC/Radio-Canada, Canada Post, BDC, CMHC, Export Development Canada, Farm Credit Canada, CPP Investments, Canada Infrastructure Bank, CDEV and Telefilm Canada. "
            "Browse their current openings on the [homepage](/).",
        ),
        faq_item(
            "Is Canada Post a Crown corporation?",
            "Yes. Canada Post Corporation is on the Government of Canada's official list of federal Crown corporations.",
        ),
        faq_item(
            "Is the CBC a Crown corporation?",
            "Yes. The Canadian Broadcasting Corporation (CBC/Radio-Canada) is a federal Crown corporation.",
        ),
        faq_item(
            "Are federal Crown corporation employees part of the federal public service?",
            "Generally, no. The federal public service covers government departments and certain agencies, while each Crown corporation is its own employer and hires through its own careers site.",
        ),
        faq_item(
            "What is a provincial agency in Ontario?",
            "A provincial agency is an organization set up by the Ontario government to deliver a service or oversee an area. "
            "Ontario says all provincial agencies are part of government, must follow government rules, and are led by people the government appoints.",
        ),
        faq_item(
            "Does Ontario have Crown corporations?",
            "Yes, though Ontario's official lists usually call them provincial agencies. "
            "For example, the LCBO and OLG are provincial agencies that run business operations.",
        ),
        faq_item(
            "Which Ontario provincial agencies are on PublicJobs.ca?",
            "We list provincial agency jobs from employers such as Metrolinx, LCBO, OLG, the Ontario Securities Commission, FSRA, AGCO, the Ontario Energy Board, Infrastructure Ontario, iGaming Ontario, Ontario Health, Public Health Ontario, WSIB, TVO, TFO and the Royal Ontario Museum. "
            "See them all on our [employers page](/employers/).",
        ),
        faq_item(
            "Is Metrolinx a government job?",
            "Yes, Metrolinx jobs are provincial public-sector jobs. "
            "Metrolinx is an Ontario provincial agency and a Crown agency, and it hires its own staff through its own careers site.",
        ),
        faq_item(
            "Is Ontario Power Generation (OPG) a Crown corporation?",
            "OPG is a company wholly owned by the Province of Ontario, which is its only shareholder. "
            "That makes it a provincially owned employer, though it is not on Ontario's list of provincial agencies.",
        ),
        faq_item(
            "Is Hydro One a Crown corporation?",
            "Not fully. Hydro One is a publicly traded company, and the Province of Ontario is its largest shareholder, owning about 47% of its shares as of March 2026.",
        ),
        faq_item(
            "What is a regulatory agency?",
            "A regulatory agency oversees an industry and enforces the rules for it. "
            "Ontario regulatory agencies on our site include the Ontario Securities Commission, FSRA, AGCO and the Ontario Energy Board.",
        ),
        faq_item(
            "Are TTC employees government employees?",
            "The TTC is an agency of the City of Toronto, so TTC jobs are municipal public-sector jobs. "
            "The TTC has its own board and hires its own staff, separately from City of Toronto jobs.",
        ),
        faq_item(
            "What are City of Toronto agencies?",
            "City agencies deliver City services such as transit, parking and the zoo, and each is governed by a board that gets its powers from City Council. "
            "City of Toronto agencies on our site include the TTC, Toronto Parking Authority, Toronto Zoo, Exhibition Place, CreateTO and the Toronto Atmospheric Fund.",
        ),
        faq_item(
            "What is a City of Toronto corporation?",
            "A City corporation is a company wholly owned by the City of Toronto that operates independently and approves its own budget. "
            "Toronto Hydro and Toronto Community Housing are two examples on our site.",
        ),
        faq_item(
            "What is a delegated administrative authority?",
            "A delegated administrative authority is a not-for-profit corporation that runs certain Ontario laws for the government. "
            "By law, it is not part of the government or a government agency.",
        ),
        faq_item(
            "Is TSSA part of the Ontario government?",
            "No. The Technical Standards and Safety Authority (TSSA) is a not-for-profit delegated administrative authority that enforces Ontario safety laws for things like elevators, boilers and fuels.",
        ),
        faq_item(
            "Is HCRA part of the Ontario government?",
            "No. The Home Construction Regulatory Authority (HCRA) is a delegated administrative authority that licenses and regulates new home builders and sellers in Ontario.",
        ),
        faq_item(
            "Are CPA Ontario and the Law Society of Ontario government agencies?",
            "No. They are professional regulators set up under Ontario laws to oversee accountants (CPA Ontario) and lawyers and paralegals (Law Society of Ontario). "
            "We list them because their work serves the public interest.",
        ),
    ]
    working = [
        faq_item(
            "What is the Ontario Public Service (OPS)?",
            "The Ontario Public Service is the staff who work in the Government of Ontario's ministries. "
            "Its rules come from the Public Service of Ontario Act, 2006, and its jobs are posted on Ontario Public Service Careers (gojobs.gov.on.ca).",
        ),
        faq_item(
            "Is working for a provincial agency the same as working for the OPS?",
            "Not always. Many agencies, such as Metrolinx and the LCBO, hire their own staff through their own careers sites, while some smaller agencies hire through Ontario Public Service Careers.",
        ),
        faq_item(
            "Does PublicJobs.ca list Ontario ministry jobs?",
            "Not right now. Our list focuses on Crown corporations, provincial agencies and City of Toronto organizations; you can find ministry jobs on Ontario Public Service Careers.",
        ),
        faq_item(
            "Who can work for a Crown corporation or agency?",
            "To work anywhere in Canada, you must be a Canadian citizen, a permanent resident, or authorized in writing to work in Canada. "
            "Each employer may have extra requirements, so read the job posting.",
        ),
        faq_item(
            "Do I need to be a Canadian citizen to work in the Ontario Public Service?",
            "No. Ontario says citizens, permanent residents and people authorized in writing to work in Canada can work in the Ontario Public Service.",
        ),
        faq_item(
            "Do federal government jobs give preference to Canadian citizens?",
            "In external hiring for the federal public service, eligible veterans come first, then Canadian citizens and permanent residents, ahead of other applicants. "
            "This rule is for the federal public service, not Crown corporations, which set their own hiring rules.",
        ),
        faq_item(
            "Do public-sector jobs need a security check?",
            "Some do. For example, some Ontario Public Service jobs need an employment security check, which can include a police record check; the job posting says if one is required.",
        ),
        faq_item(
            "Do I need to speak French for a federal Crown corporation job?",
            "Some jobs need English and French, and others do not. "
            "Federal Crown corporations covered by the Official Languages Act must serve the public in both languages, so check the language requirement in each posting.",
        ),
        faq_item(
            "Do I need French for an Ontario Public Service job?",
            "Only for designated bilingual positions, which are tested in French. "
            "All candidates are assessed in English, and each job ad shows the language of the position.",
        ),
        faq_item(
            "Are Crown corporation jobs unionized?",
            "Many public-sector jobs are unionized, but it depends on the employer and the role. "
            "Check the job posting or ask the employer.",
        ),
        faq_item(
            "Do Crown corporations offer pensions?",
            "Many public employers offer a workplace pension plan, but the plan and who can join it differ by employer and job type. "
            "Check the job posting or the employer's careers site for details.",
        ),
        faq_item(
            "What is OMERS?",
            "OMERS is a pension plan whose members are mainly employees of Ontario municipalities, local boards and public utilities. "
            "Whether a job includes OMERS depends on the employer.",
        ),
        faq_item(
            "What pension plans cover Ontario Public Service employees?",
            "Permanent Ontario Public Service employees usually join the Public Service Pension Plan (PSPP). "
            "Employees in positions eligible for the OPSEU Pension Plan, run by OPTrust, join that plan instead.",
        ),
        faq_item(
            "Are public-sector jobs more stable?",
            "Many people look for public-sector jobs in Toronto for stability, set pay scales and benefits. "
            "But pay, benefits and job security differ by employer, union status and contract type, and no job is guaranteed.",
        ),
    ]
    return [
        {"id": "about-publicjobs-ca", "heading": "About PublicJobs.ca", "items": about},
        {"id": "levels-of-government-in-canada", "heading": "Levels of government in Canada", "items": levels},
        {"id": "crown-corporations-and-agencies", "heading": "Crown corporations and agencies", "items": crowns},
        {"id": "working-in-the-public-sector", "heading": "Working in the public sector", "items": working},
    ]


def faq_answer_text(parts: list) -> str:
    chunks: list[str] = []
    for part in parts:
        if isinstance(part, str):
            chunks.append(part)
        else:
            chunks.append(part["text"])
    return "".join(chunks)


def faq_answer_html(parts: list) -> str:
    chunks: list[str] = []
    for part in parts:
        if isinstance(part, str):
            chunks.append(escape(part))
            continue
        href = escape(part["href"], quote=True)
        label = escape(part["text"])
        chunks.append(f'<a href="{href}">{label}</a>')
    return "".join(chunks)


def faq_items(sections: list[dict]) -> list[dict]:
    return [item for section in sections for item in section["items"]]


def faq_json_ld(sections: list[dict]) -> str:
    data = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "name": FAQ_HEADING,
        "url": f"{SITE_URL}/faq/",
        "description": FAQ_DESCRIPTION,
        "mainEntity": [
            {
                "@type": "Question",
                "name": item["question"],
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": faq_answer_text(item["parts"]),
                },
            }
            for item in faq_items(sections)
        ],
    }
    payload = json_for_script([data])[1:-1]
    return f'    <script type="application/ld+json">{payload}</script>'


def render_faq_body(sections: list[dict]) -> str:
    toc = "\n".join(
        f'            <li><a href="#{escape(section["id"], quote=True)}">{escape(section["heading"])}</a></li>'
        for section in sections
    )
    seen: set[str] = set()
    groups: list[str] = []
    for section in sections:
        questions: list[str] = []
        for item in section["items"]:
            anchor = faq_anchor(item["question"])
            if anchor in seen:
                raise SystemExit(f"duplicate faq anchor: {anchor}")
            seen.add(anchor)
            questions.append(
                f"""            <section class="faq-item">
              <h3 id="{escape(anchor, quote=True)}">{escape(item["question"])}</h3>
              <p>{faq_answer_html(item["parts"])}</p>
            </section>"""
            )
        groups.append(
            f"""          <section class="faq-section" id="{escape(section["id"], quote=True)}">
            <h2>{escape(section["heading"])}</h2>
{chr(10).join(questions)}
          </section>"""
        )
    return f"""          <nav class="faq-toc" aria-label="On this page">
            <ol>
{toc}
            </ol>
          </nav>
{chr(10).join(groups)}"""


def render_faq_page(jobs: list[dict]) -> str:
    if len(FAQ_DESCRIPTION) > 160:
        raise SystemExit(f"FAQ meta description is {len(FAQ_DESCRIPTION)} characters")
    sections = faq_sections(len(employer_names(jobs)))
    return render_info_page(
        FAQ_TITLE,
        FAQ_HEADING,
        FAQ_DESCRIPTION,
        "faq/",
        render_faq_body(sections),
        extra_head=faq_json_ld(sections),
    )


def write_faq_page(jobs: list[dict]) -> None:
    path = ROOT / "faq" / "index.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_faq_page(jobs), encoding="utf-8")


def render_not_found() -> str:
    origin = SITE_URL
    head = shared_head(
        f"Page not found | {BRAND}",
        "This page may have moved, or the job may have closed.",
        "",
        f"{origin}/styles.css",
        robots="noindex",
        asset_origin=origin,
    )
    return f"""{head}
  <body>
{site_header(origin + "/", link_base=origin)}
    <main>
      <div class="content not-found">
        <h1>Page not found</h1>
        <p>This page may have moved, or the job may have closed.</p>
        <form class="search-field" role="search" action="{origin}/" method="get">
          <label for="job-search">Search titles and employers</label>
          <input id="job-search" name="q" type="search" autocomplete="off" spellcheck="false" />
          <button type="submit">Search</button>
        </form>
        <p><a href="{origin}/">See all current jobs</a></p>
        <p><a href="{origin}/employers/">Employers</a></p>
      </div>
    </main>
{site_footer()}
  </body>
</html>
"""


def write_not_found() -> None:
    (ROOT / "404.html").write_text(render_not_found(), encoding="utf-8")


EMPLOYERS_DESCRIPTION = (
    "The full list of public employers in Toronto and the GTA whose current "
    "job openings PublicJobs.ca collects. You apply on each employer's own website."
)


def employer_names(jobs: list[dict]) -> list[str]:
    names = {text(job.get("employer")) for job in jobs}
    names.discard("")
    return sorted(names, key=lambda name: (name.casefold(), name))


def employers_json_ld(employers: list[str]) -> str:
    data = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Employers we list jobs from",
        "url": f"{SITE_URL}/employers/",
        "numberOfItems": len(employers),
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": index,
                "item": {"@type": "Organization", "name": name},
            }
            for index, name in enumerate(employers, start=1)
        ],
    }
    payload = json_for_script([data])[1:-1]
    return f'    <script type="application/ld+json">{payload}</script>'


def render_employers_page(jobs: list[dict]) -> str:
    employers = employer_names(jobs)
    items = "\n".join(f"            <li>{escape(name)}</li>" for name in employers)
    body = f"""          <p>PublicJobs.ca collects current job openings from these public employers in Toronto and the GTA. You apply on each employer's own website. We are independent and not affiliated with any of them.</p>
          <ul class="employer-list">
{items}
          </ul>"""
    return render_info_page(
        f"Employers | {BRAND}",
        "Employers we list jobs from",
        EMPLOYERS_DESCRIPTION,
        "employers/",
        body,
        extra_head=employers_json_ld(employers),
    )


def write_employers_page(jobs: list[dict]) -> None:
    path = ROOT / "employers" / "index.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_employers_page(jobs), encoding="utf-8")


def write_info_pages() -> None:
    privacy = ROOT / "privacy" / "index.html"
    about = ROOT / "about" / "index.html"
    privacy.parent.mkdir(parents=True, exist_ok=True)
    about.parent.mkdir(parents=True, exist_ok=True)
    privacy.write_text(render_privacy_page(), encoding="utf-8")
    about.write_text(render_about_page(), encoding="utf-8")


def sitemap_url(loc: str, lastmod: str) -> str:
    loc_xml = f"  <url><loc>{escape(loc, quote=True)}</loc>"
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", lastmod or ""):
        return f"{loc_xml}<lastmod>{lastmod}</lastmod></url>"
    return f"{loc_xml}</url>"


def write_sitemap(paths: list[str], lastmods: list[str] | None = None) -> None:
    if lastmods is None:
        lastmods = [""] * len(paths)
    if len(lastmods) != len(paths):
        raise SystemExit("sitemap lastmod count does not match paths")
    build_day = today_toronto().isoformat()
    static = [
        f"{SITE_URL}/",
        f"{SITE_URL}/privacy/",
        f"{SITE_URL}/about/",
        f"{SITE_URL}/faq/",
        f"{SITE_URL}/employers/",
        f"{SITE_URL}/terms/",
        f"{SITE_URL}/match/",
    ]
    lines = [sitemap_url(url, build_day) for url in static]
    lines.extend(
        sitemap_url(f"{SITE_URL}/{path}", lastmod) for path, lastmod in zip(paths, lastmods)
    )
    items = "\n".join(lines)
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
        if path.name in {"index.html", "404.html"}:
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
    today = today_toronto()
    jobs = sort_jobs(raw)
    assign_paths(jobs)
    open_jobs = [job for job in jobs if not job_is_closed(job, today)]

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
        if path.name in {"index.html", "404.html"}:
            continue
        html = read_html(path)
        if 'class="job-page"' in html or 'class="apply-btn"' in html:
            path.unlink()

    slugs: list[str] = []
    lastmods: list[str] = []
    used: set[str] = set()
    closed_count = 0
    for job in jobs:
        rel = job["_path"]
        if rel in used:
            raise SystemExit(f"duplicate path: {rel}")
        used.add(rel)
        closed = job_is_closed(job, today)
        if closed:
            closed_count += 1
        else:
            slugs.append(rel)
            lastmods.append(job_lastmod(job))
        page_path = JOBS_DIR / job["_employer_slug"] / job["_job_slug"] / "index.html"
        page_path.parent.mkdir(parents=True, exist_ok=True)
        page_path.write_text(render_job_page(job, closed=closed), encoding="utf-8")

    written_redirects = 0
    for path, target, apply_url in redirects:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(render_redirect(target, apply_url), encoding="utf-8")
        written_redirects += 1

    (ROOT / "index.html").write_text(render_index(open_jobs), encoding="utf-8")
    write_info_pages()
    write_match_page()
    write_employers_page(jobs)
    write_terms_page()
    write_faq_page(jobs)
    write_not_found()
    write_sitemap(slugs, lastmods)
    write_robots()
    (ROOT / ".nojekyll").write_text("", encoding="utf-8")
    print(
        f"Wrote {len(jobs)} job pages ({closed_count} closed, kept off the homepage "
        f"and sitemap), index.html, employers page, FAQ page, "
        f"and {written_redirects} redirects "
        f"({removed} unpublished legacy pages dropped)"
    )


if __name__ == "__main__":
    main()
