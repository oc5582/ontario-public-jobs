#!/usr/bin/env python3
"""Tell IndexNow about new, newly closed, and removed PublicJobs.ca job URLs.

Run this on the weekday refresh immediately after scripts/notify_indexing.py,
with the same --previous and --new feed files. It does not connect to Postgres,
does not call Google, and is not scheduled in this repo.

The URL set matches notify_indexing.py: new paths, paths whose closing date
newly passed, and paths removed from the feed. Jobs with no description are
skipped. The Google Indexing API cap of 180 does not apply. URLs are posted
in chunks of 10,000.

    python3 scripts/notify_indexnow.py --previous previous.json --new new.json
    python3 scripts/notify_indexnow.py --previous previous.json --new new.json --dry-run

--dry-run prints the JSON body and does not call IndexNow. A bad feed, a
missing key file, a timeout, or any other error is logged and the process
exits 0 so the refresh is not failed. Submitting the same URLs again is safe.

The key is web/public/<32-hex>.txt, served at https://publicjobs.ca/<key>.txt.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import notify_indexing as notify  # noqa: E402

HOST = "publicjobs.ca"
ORIGIN = "https://publicjobs.ca"
ENDPOINT = "https://api.indexnow.org/indexnow"
CHUNK = 10_000
TIMEOUT = 20
# Larger than any feed. select_notifications treats a positive cap as a limit.
NO_CAP = 10**12
KEY_FILE_RE = re.compile(r"^([0-9a-f]{32})\.txt$")
PUBLIC_DIR = ROOT / "web" / "public"


def load_key() -> str:
    matches: list[str] = []
    if PUBLIC_DIR.is_dir():
        for path in sorted(PUBLIC_DIR.iterdir()):
            found = KEY_FILE_RE.match(path.name)
            if not found:
                continue
            key = found.group(1)
            if path.read_text(encoding="utf-8").strip() != key:
                raise ValueError(f"IndexNow key file {path.name} does not contain the key")
            matches.append(key)
    if len(matches) != 1:
        raise ValueError(f"expected one IndexNow key file in {PUBLIC_DIR}, found {len(matches)}")
    return matches[0]


def job_url(path: str) -> str:
    return f"{ORIGIN}/{path.lstrip('/')}"


def diff_urls(
    previous: dict[str, dict],
    current: dict[str, dict],
    today: date,
) -> tuple[list[dict], list[dict]]:
    """Added, newly closed, and removed jobs, using notify_indexing's rules.

    Returns (chosen, skipped_no_description). There is no Google quota cap.
    """
    chosen, thin, over = notify.select_notifications(previous, current, today, cap=NO_CAP)
    if over:
        chosen = chosen + over
    return chosen, thin


def chunk_urls(urls: list[str], size: int = CHUNK) -> list[list[str]]:
    if size < 1:
        raise ValueError("chunk size must be at least 1")
    return [urls[i : i + size] for i in range(0, len(urls), size)]


def payload(key: str, urls: list[str]) -> dict:
    return {
        "host": HOST,
        "key": key,
        "keyLocation": f"{ORIGIN}/{key}.txt",
        "urlList": urls,
    }


def post_payload(body: dict) -> None:
    data = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        ENDPOINT,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        response.read()


def _failure_detail(exc: BaseException) -> str:
    if isinstance(exc, urllib.error.HTTPError):
        try:
            body = exc.read().decode("utf-8", errors="replace")[:500]
        except Exception:
            body = ""
        return f"HTTP {exc.code} {body}".strip()
    return str(exc)


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Notify IndexNow about new and closed PublicJobs.ca URLs.")
    parser.add_argument("--previous", required=True, type=Path, help="Previous feed JSON (listings.json shape).")
    parser.add_argument("--new", required=True, type=Path, help="New feed JSON (listings.json shape).")
    parser.add_argument("--dry-run", action="store_true", help="Print the IndexNow JSON and do not POST.")
    args = parser.parse_args(argv)

    previous = notify.load_feed(args.previous)
    current = notify.load_feed(args.new)
    today = notify.bp.today_toronto()
    chosen, thin = diff_urls(previous, current, today)
    for item in thin:
        print(f"skipped no-description {job_url(item['path'])} {item['reason']}", file=sys.stderr)

    urls = [job_url(item["path"]) for item in chosen]
    key = load_key()
    chunks = chunk_urls(urls)
    counts = {"new": 0, "closed": 0, "removed": 0}
    for item in chosen:
        counts[item["reason"]] = counts.get(item["reason"], 0) + 1
    summary = (
        f"notify_indexnow: {len(urls)} urls "
        f"({counts['new']} added, {counts['closed']} changed, {counts['removed']} removed) "
        f"in {len(chunks)} request(s); skipped {len(thin)} with no description"
    )

    if args.dry_run:
        for body in (payload(key, chunk) for chunk in chunks):
            print(json.dumps(body, indent=2))
        print(f"{summary}; dry-run")
        return 0

    print(summary)
    for index, chunk in enumerate(chunks, start=1):
        body = payload(key, chunk)
        try:
            post_payload(body)
        except Exception as exc:
            print(
                f"warning: IndexNow failed on chunk {index}/{len(chunks)} "
                f"({len(chunk)} urls): {_failure_detail(exc)}",
                file=sys.stderr,
            )
            return 0
        print(f"notify_indexnow: posted chunk {index}/{len(chunks)} ({len(chunk)} urls)")
    return 0


def main(argv: list[str] | None = None) -> int:
    try:
        return run(argv)
    except SystemExit as exc:
        if exc.code in (0, None):
            return 0
        print(f"warning: notify_indexnow stopped: {exc.code}", file=sys.stderr)
        return 0
    except Exception as exc:
        print(f"warning: notify_indexnow failed: {exc}", file=sys.stderr)
        return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"warning: notify_indexnow failed: {exc}", file=sys.stderr)
        raise SystemExit(0)
