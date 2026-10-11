#!/usr/bin/env python3
"""Tell Google's Indexing API about new and newly closed job URLs.

The weekday refresh does not run import_listings.py against Postgres. It runs
on a box that cannot reach the database and sends the importer's SQL through
an HTTPS connector. This script is separate: give it the previous feed and the
new feed (the same JSON rows as data/listings.json, including path or
apply_url, description, and closing_date). It does not connect to Postgres
and import_listings.py does not call it.

Paths match the importer. A row with path is used as-is. Rows without path
are ordered with build_pages.sort_jobs and assigned with build_pages.assign_paths.

Sends URL_UPDATED for new paths and for closed or removed paths (not
URL_DELETED). Skips jobs with no description. At most 180 URLs per run,
newest posted_date then fetched_at first.

    pip install google-auth
    python3 scripts/notify_indexing.py --previous previous.json --new new.json
    python3 scripts/notify_indexing.py --previous previous.json --new new.json --dry-run

Auth is the service-account JSON in GOOGLE_INDEXING_SA_JSON, or a file path in
GOOGLE_INDEXING_SA_FILE. If both are unset, google-auth is missing, or the
Indexing API returns an error, this prints a warning and exits 0. --dry-run
prints the notifications and does not need credentials.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_pages as bp  # noqa: E402

CAP = 180
INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing"
PUBLISH_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish"


def normalize_path(path: str) -> str:
    raw = path.strip()
    if "://" in raw:
        raw = urlparse(raw).path
    raw = raw.strip("/")
    if not raw:
        return ""
    return raw + "/"


def index_jobs(raw: object) -> dict[str, dict]:
    if not isinstance(raw, list):
        raise SystemExit("feed must be a JSON array")
    jobs = [dict(job) for job in raw if isinstance(job, dict) and not bp.is_excluded_job(job)]
    if any(not bp.text(job.get("path")) for job in jobs):
        jobs = bp.sort_jobs(jobs)
        bp.assign_paths(jobs)
    indexed: dict[str, dict] = {}
    for job in jobs:
        path = normalize_path(bp.text(job.get("path")) or bp.text(job.get("_path")))
        if not path:
            continue
        job["path"] = path
        indexed[path] = job
    return indexed


def load_feed(path: Path) -> dict[str, dict]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"could not read {path}: {exc}") from exc
    return index_jobs(raw)


def has_description(job: dict) -> bool:
    if bp.text(job.get("description")):
        return True
    paragraphs = job.get("paragraphs")
    if isinstance(paragraphs, list) and any(bp.text(item) for item in paragraphs):
        return True
    return False


def is_closed(job: dict, today: date) -> bool:
    closing = bp.closing_date(job)
    if not closing:
        return False
    return date.fromisoformat(closing) < today


def recency(job: dict) -> tuple[str, str, str]:
    posted = bp.posting_date(job) or "0000-00-00"
    fetched = bp.iso_date(bp.text(job.get("fetched_at"))) or "0000-00-00"
    return (posted, fetched, normalize_path(bp.text(job.get("path"))))


def select_notifications(
    previous: dict[str, dict],
    current: dict[str, dict],
    today: date,
    cap: int = CAP,
) -> tuple[list[dict], list[dict], list[dict]]:
    """New paths, removed paths, and paths whose closing date newly passed.

    Returns (to_send, skipped_no_description, skipped_over_cap). Each item has
    path, reason (new, closed, or removed), and job.
    """
    pending: list[dict] = []
    for path, job in current.items():
        if path not in previous:
            pending.append({"path": path, "reason": "new", "job": job})
        elif is_closed(job, today) and not is_closed(previous[path], today):
            pending.append({"path": path, "reason": "closed", "job": job})
    for path, job in previous.items():
        if path not in current:
            pending.append({"path": path, "reason": "removed", "job": job})

    described = [item for item in pending if has_description(item["job"])]
    skipped_thin = [item for item in pending if not has_description(item["job"])]
    described.sort(key=lambda item: recency(item["job"]), reverse=True)
    limit = cap if cap > 0 else 0
    return described[:limit], skipped_thin, described[limit:]


def site_origin() -> str:
    return (os.environ.get("NEXT_PUBLIC_SITE_URL") or "https://publicjobs.ca").rstrip("/")


def job_url(path: str) -> str:
    return f"{site_origin()}/{path.lstrip('/')}"


def summary(chosen: list[dict], thin: list[dict], over_cap: list[dict]) -> str:
    counts = {"new": 0, "closed": 0, "removed": 0}
    for item in chosen:
        counts[item["reason"]] = counts.get(item["reason"], 0) + 1
    return (
        f"notify_indexing: {len(chosen)} URL_UPDATED "
        f"({counts['new']} new, {counts['closed']} closed, {counts['removed']} removed); "
        f"skipped {len(thin)} with no description; "
        f"skipped {len(over_cap)} over the {CAP} cap"
    )


def access_token() -> str | None:
    raw = os.environ.get("GOOGLE_INDEXING_SA_JSON", "").strip()
    file_path = os.environ.get("GOOGLE_INDEXING_SA_FILE", "").strip()
    if not raw and not file_path:
        print(
            "warning: GOOGLE_INDEXING_SA_JSON and GOOGLE_INDEXING_SA_FILE are unset; skipping Indexing API",
            file=sys.stderr,
        )
        return None
    try:
        import urllib3
        from google.auth.transport.urllib3 import Request
        from google.oauth2 import service_account
    except ImportError:
        print(
            "warning: google-auth is not installed (pip install google-auth); skipping Indexing API",
            file=sys.stderr,
        )
        return None
    try:
        info = json.loads(raw) if raw else json.loads(Path(file_path).read_text(encoding="utf-8"))
        credentials = service_account.Credentials.from_service_account_info(info, scopes=[INDEXING_SCOPE])
        credentials.refresh(Request(urllib3.PoolManager()))
    except Exception as exc:
        print(f"warning: could not authenticate the Indexing API service account: {exc}", file=sys.stderr)
        return None
    token = getattr(credentials, "token", None)
    if not token:
        print("warning: Indexing API service account did not return an access token", file=sys.stderr)
        return None
    return token


def publish(token: str, url: str) -> None:
    payload = json.dumps({"url": url, "type": "URL_UPDATED"}).encode("utf-8")
    request = urllib.request.Request(
        PUBLISH_URL,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        response.read()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Notify Google about new and closed PublicJobs.ca URLs.")
    parser.add_argument("--previous", required=True, type=Path, help="Previous feed JSON (listings.json shape).")
    parser.add_argument("--new", required=True, type=Path, help="New feed JSON (listings.json shape).")
    parser.add_argument("--dry-run", action="store_true", help="Print URL_UPDATED lines and do not call Google.")
    args = parser.parse_args(argv)

    previous = load_feed(args.previous)
    current = load_feed(args.new)
    today = bp.today_toronto()
    chosen, thin, over_cap = select_notifications(previous, current, today)
    for item in thin:
        print(f"skipped no-description {job_url(item['path'])} {item['reason']}", file=sys.stderr)
    for item in over_cap:
        print(f"skipped cap {job_url(item['path'])} {item['reason']}", file=sys.stderr)

    if args.dry_run:
        for item in chosen:
            print(f"URL_UPDATED {job_url(item['path'])} {item['reason']}")
        print(summary(chosen, thin, over_cap))
        return 0

    print(summary(chosen, thin, over_cap))
    if not chosen:
        return 0
    token = access_token()
    if not token:
        return 0
    sent = 0
    for item in chosen:
        url = job_url(item["path"])
        try:
            publish(token, url)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            print(f"warning: Indexing API failed after {sent} URL_UPDATED for {url}: {exc}", file=sys.stderr)
            return 0
        sent += 1
        print(f"URL_UPDATED {url} {item['reason']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
