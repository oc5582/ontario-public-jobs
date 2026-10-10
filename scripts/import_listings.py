#!/usr/bin/env python3
"""Upsert data/listings.json into Postgres (local or Supabase).

Uses scripts/build_pages.py for slugs, salary, locations and page titles so
job URLs stay the same as the GitHub Pages site. Does not rewrite listings.json
and does not run the static page build.

  DATABASE_URL=postgres://publicjobs:publicjobs_local@127.0.0.1:5432/publicjobs \\
    python3 scripts/import_listings.py

On localhost the script also upserts the fake member test@example.com.
Pass --no-seed-member to skip that. Pass --seed-member to force it.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import psycopg2
from psycopg2.extras import Json

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_pages as bp  # noqa: E402

REDIRECTS_PATH = ROOT / "web" / "legacy-redirects.json"
REFRESH_RE = re.compile(r'http-equiv="refresh" content="0; url=([^"]+)"')
TYPE_MAP = {
    "FULL_TIME": "full-time",
    "PART_TIME": "part-time",
    "CONTRACTOR": "contract",
    "TEMPORARY": "temporary",
    "INTERN": "student",
    "VOLUNTEER": "volunteer",
    "PER_DIEM": "casual",
}
CATEGORY_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("student", re.compile(r"\b(student|intern(ship)?|co-?ops?|new grad)\b", re.I)),
    (
        "information-technology",
        re.compile(
            r"\b(software|developer|programmer|cyber|devops|data (engineer|analyst|scientist)|"
            r"database|network|information technology|\bit\b|systems analyst|cloud|"
            r"maximo|servicenow)\b",
            re.I,
        ),
    ),
    (
        "finance",
        re.compile(r"\b(account|financ|payroll|auditor|procurement|treasury|budget|controller)\b", re.I),
    ),
    (
        "engineering-trades",
        re.compile(
            r"\b(engineer|technician|mechanic|electrician|carpenter|hvac|inspector|"
            r"foreperson|apprentice|trades|welder|plumber)\b",
            re.I,
        ),
    ),
    (
        "health-and-social",
        re.compile(r"\b(nurse|nursing|health|social work|paramedic|physician|clinic|public health)\b", re.I),
    ),
    ("communications", re.compile(r"\b(communicat|marketing|journalist|editor|graphic|media)\b", re.I)),
    ("planning-and-policy", re.compile(r"\b(planner|planning|policy|zoning|urban design)\b", re.I)),
    (
        "administration",
        re.compile(r"\b(admin|coordinator|clerk|assistant|receptionist|executive assistant)\b", re.I),
    ),
    (
        "operations",
        re.compile(r"\b(operator|custodian|driver|attendant|guard|cleaner|warehouse|labour|labor)\b", re.I),
    ),
)
ANNUAL_FACTOR = {"HOUR": 1950, "DAY": 260, "WEEK": 52, "MONTH": 12, "YEAR": 1}
TEST_MEMBER_ID = "00000000-0000-4000-8000-000000000001"


def category_for(job: dict) -> str:
    blob = " ".join(
        bp.text(job.get(key)) for key in ("title", "department", "employment_type")
    )
    for name, pattern in CATEGORY_RULES:
        if pattern.search(blob):
            return name
    return "other"


def job_types_for(job: dict) -> list[str]:
    found: list[str] = []
    for token in bp.employment_types(bp.text(job.get("employment_type"))):
        label = TYPE_MAP.get(token)
        if label and label not in found:
            found.append(label)
    blob = bp.text(job.get("title")) + " " + bp.text(job.get("employment_type"))
    if re.search(r"\b(student|intern|co-?op)\b", blob, re.I) and "student" not in found:
        found.append("student")
    return found or ["unspecified"]


def annual_bounds(salary: dict | None) -> tuple[float | None, float | None, str, str]:
    if not salary:
        return None, None, "", ""
    value = salary.get("value") or {}
    unit = bp.text(value.get("unitText"))
    factor = ANNUAL_FACTOR.get(unit)
    currency = bp.text(salary.get("currency"))
    if not factor:
        return None, None, currency, unit
    low = value.get("minValue", value.get("value"))
    high = value.get("maxValue", value.get("value", low))
    if low is None or high is None:
        return None, None, currency, unit
    return float(low) * factor, float(high) * factor, currency, unit


def parse_fetched(value: str) -> datetime | None:
    raw = bp.text(value)
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def load_jobs() -> list[dict]:
    raw = json.loads((ROOT / "data" / "listings.json").read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise SystemExit("data/listings.json must be a JSON array")
    kept = [job for job in raw if not bp.is_excluded_job(job)]
    jobs = bp.sort_jobs(kept)
    bp.assign_paths(jobs)
    bp.assign_page_seo(jobs)
    return jobs


def check_paths(jobs: list[dict]) -> None:
    existing = set()
    jobs_dir = ROOT / "jobs"
    if not jobs_dir.exists():
        return
    for page in jobs_dir.glob("*/*/index.html"):
        # /jobs/page/N/ is the old paginated index, not a job page.
        if page.parent.parent.name == "page":
            continue
        existing.add(page.parent.relative_to(ROOT).as_posix() + "/")
    computed = {job["_path"] for job in jobs}
    missing = sorted(computed - existing)
    extra = sorted(existing - computed)
    if missing or extra:
        raise SystemExit(
            f"slug mismatch vs built pages: {len(missing)} computed paths missing "
            f"on disk, {len(extra)} disk paths not in the feed. "
            f"sample missing={missing[:3]} extra={extra[:3]}"
        )


def legacy_redirects(jobs: list[dict]) -> list[dict[str, str]]:
    published = {"/" + job["_path"] for job in jobs}
    found: list[dict[str, str]] = []
    seen: set[str] = set()
    candidates = list((ROOT / "jobs").glob("*.html")) + [
        path
        for path in ROOT.glob("*.html")
        if path.name not in {"index.html", "404.html"}
    ]
    for path in candidates:
        html = path.read_text(encoding="utf-8", errors="ignore")
        match = REFRESH_RE.search(html)
        if not match:
            continue
        target = bp.unescape(match.group(1)).strip()
        if target.startswith(bp.SITE_ORIGIN):
            target = target[len(bp.SITE_ORIGIN) :]
        if not target.startswith("/"):
            target = "/" + target
        if target not in published:
            continue
        source = "/" + path.relative_to(ROOT).as_posix()
        if source in seen:
            continue
        seen.add(source)
        found.append({"from": source, "to": target})
    found.sort(key=lambda item: item["from"])
    return found


def upsert(conn, jobs: list[dict], seed_member: bool) -> None:
    today = bp.today_toronto()
    with conn.cursor() as cur:
        employer_ids: dict[str, str] = {}
        for job in jobs:
            slug = job["_employer_slug"]
            if slug in employer_ids:
                continue
            cur.execute(
                """
                insert into employers (slug, name)
                values (%s, %s)
                on conflict (slug) do update
                  set name = excluded.name,
                      updated_at = now()
                returning id
                """,
                (slug, bp.text(job.get("employer")) or slug),
            )
            employer_ids[slug] = cur.fetchone()[0]

        paths: list[str] = []
        for job in jobs:
            salary = bp.base_salary(job)
            annual_min, annual_max, currency, unit = annual_bounds(salary)
            posting = bp.job_posting_data(job)
            if posting is not None:
                posting = dict(posting)
                posting["directApply"] = False
            paragraphs = bp.html_to_paragraphs(bp.text(job.get("description")))
            posted = bp.posting_date(job) or None
            closing = bp.closing_date(job) or None
            alias = bp.SEARCH_ALIASES.get(bp.text(job.get("employer")), "")
            path = job["_path"]
            paths.append(path)
            cur.execute(
                """
                insert into jobs (
                  employer_id, employer_slug, job_slug, path, title, page_title,
                  meta_description, location, cities, location_places, closing_date,
                  posted_date, employment_type, job_types, work_mode, fully_remote,
                  salary, salary_annual_min, salary_annual_max, salary_currency,
                  salary_unit, department, description, paragraphs, description_html,
                  apply_url, tier, source, fetched_at, external_id, category,
                  search_alias, jobposting, removed_at, updated_at
                ) values (
                  %s, %s, %s, %s, %s, %s,
                  %s, %s, %s, %s, %s,
                  %s, %s, %s, %s, %s,
                  %s, %s, %s, %s,
                  %s, %s, %s, %s, %s,
                  %s, %s, %s, %s, %s, %s,
                  %s, %s, null, now()
                )
                on conflict (path) do update set
                  employer_id = excluded.employer_id,
                  employer_slug = excluded.employer_slug,
                  job_slug = excluded.job_slug,
                  title = excluded.title,
                  page_title = excluded.page_title,
                  meta_description = excluded.meta_description,
                  location = excluded.location,
                  cities = excluded.cities,
                  location_places = excluded.location_places,
                  closing_date = excluded.closing_date,
                  posted_date = excluded.posted_date,
                  employment_type = excluded.employment_type,
                  job_types = excluded.job_types,
                  work_mode = excluded.work_mode,
                  fully_remote = excluded.fully_remote,
                  salary = excluded.salary,
                  salary_annual_min = excluded.salary_annual_min,
                  salary_annual_max = excluded.salary_annual_max,
                  salary_currency = excluded.salary_currency,
                  salary_unit = excluded.salary_unit,
                  department = excluded.department,
                  description = excluded.description,
                  paragraphs = excluded.paragraphs,
                  description_html = excluded.description_html,
                  apply_url = excluded.apply_url,
                  tier = excluded.tier,
                  source = excluded.source,
                  fetched_at = excluded.fetched_at,
                  external_id = excluded.external_id,
                  category = excluded.category,
                  search_alias = excluded.search_alias,
                  jobposting = excluded.jobposting,
                  removed_at = null,
                  updated_at = now()
                """,
                (
                    employer_ids[job["_employer_slug"]],
                    job["_employer_slug"],
                    job["_job_slug"],
                    path,
                    bp.text(job.get("title")) or "Untitled",
                    job["_page_title"],
                    job["_meta_desc"],
                    bp.text(job.get("location")),
                    bp.job_cities(bp.text(job.get("location"))),
                    Json(bp.job_locations(bp.text(job.get("location")))),
                    closing,
                    posted,
                    bp.text(job.get("employment_type")),
                    job_types_for(job),
                    bp.text(job.get("work_mode")),
                    bp.fully_remote(job),
                    bp.text(job.get("salary")),
                    annual_min,
                    annual_max,
                    currency or None,
                    unit or None,
                    bp.text(job.get("department")),
                    bp.text(job.get("description")),
                    Json(paragraphs),
                    bp.job_description_html(job),
                    bp.text(job.get("apply_url")),
                    bp.text(job.get("tier")) or None,
                    bp.text(job.get("source")) or None,
                    parse_fetched(bp.text(job.get("fetched_at"))),
                    bp.explicit_job_id(job) or bp.apply_job_id(bp.text(job.get("apply_url"))) or None,
                    category_for(job),
                    alias,
                    Json(posting) if posting else None,
                ),
            )

        cur.execute(
            """
            update jobs
            set removed_at = now(), updated_at = now()
            where removed_at is null
              and not (path = any(%s))
            """,
            (paths,),
        )
        removed = cur.rowcount
        closed = sum(1 for job in jobs if bp.job_is_closed(job, today))
        if seed_member:
            cur.execute(
                """
                insert into profiles (id, email, membership_status, plan)
                values (%s, 'test@example.com', 'active', 'year')
                on conflict (email) do update
                  set membership_status = 'active',
                      plan = 'year',
                      updated_at = now()
                """,
                (TEST_MEMBER_ID,),
            )
    conn.commit()
    print(
        f"Upserted {len(jobs)} jobs ({closed} already past their closing date). "
        f"Marked {removed} missing paths removed."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-seed-member", action="store_true")
    parser.add_argument("--seed-member", action="store_true")
    args = parser.parse_args()
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL is required")
    jobs = load_jobs()
    check_paths(jobs)
    redirects = legacy_redirects(jobs)
    REDIRECTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    REDIRECTS_PATH.write_text(json.dumps(redirects, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(redirects)} legacy redirects to {REDIRECTS_PATH.relative_to(ROOT)}")
    host = ""
    try:
        host = database_url.split("@", 1)[1]
    except IndexError:
        host = database_url
    seed_member = args.seed_member or (
        not args.no_seed_member and ("localhost" in host or "127.0.0.1" in host)
    )
    conn = psycopg2.connect(database_url)
    try:
        upsert(conn, jobs, seed_member)
    finally:
        conn.close()
    if seed_member:
        print("Seeded local member test@example.com")


if __name__ == "__main__":
    main()
