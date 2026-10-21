#!/usr/bin/env python3
"""URL diff and chunking for scripts/notify_indexnow.py. No network."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import notify_indexnow as indexnow  # noqa: E402

TODAY = date(2026, 10, 11)
KEY = "73ae3ce2e86e564e9a35eadf85dcb3d6"


def job(**overrides) -> dict:
    row = {
        "title": "Clerk",
        "employer": "City of Toronto",
        "location": "Toronto",
        "closing_date": "2026-12-01",
        "posted_date": "2026-10-01",
        "description": "A real description.",
        "apply_url": "https://example.com/apply/1",
        "fetched_at": "2026-10-01T12:00:00Z",
    }
    row.update(overrides)
    return row


def test_diff_matches_indexing_rules() -> None:
    previous = indexnow.notify.index_jobs(
        [
            job(title="Still open", apply_url="https://example.com/a"),
            job(title="Now closed", apply_url="https://example.com/b", closing_date="2026-12-01"),
            job(title="Already closed", apply_url="https://example.com/c", closing_date="2026-10-01"),
            job(title="Removed", apply_url="https://example.com/d", posted_date="2026-09-01"),
            job(title="Thin removed", apply_url="https://example.com/e", description="  "),
        ]
    )
    current = indexnow.notify.index_jobs(
        [
            job(title="Still open", apply_url="https://example.com/a"),
            job(title="Now closed", apply_url="https://example.com/b", closing_date="2026-10-10"),
            job(title="Already closed", apply_url="https://example.com/c", closing_date="2026-10-01"),
            job(title="Brand new", apply_url="https://example.com/f", posted_date="2026-10-11"),
            job(title="Thin new", apply_url="https://example.com/g", description=""),
        ]
    )
    chosen, thin = indexnow.diff_urls(previous, current, TODAY)
    reasons = {(item["job"]["title"], item["reason"]) for item in chosen}
    assert reasons == {
        ("Brand new", "new"),
        ("Now closed", "closed"),
        ("Removed", "removed"),
    }, reasons
    assert {item["job"]["title"] for item in thin} == {"Thin new", "Thin removed"}
    urls = [indexnow.job_url(item["path"]) for item in chosen]
    assert urls[0].startswith("https://publicjobs.ca/jobs/")
    assert all(url.startswith("https://publicjobs.ca/") and url.endswith("/") for url in urls)
    titles = [item["job"]["title"] for item in chosen]
    assert titles[0] == "Brand new"
    assert "Still open" not in titles
    assert "Already closed" not in titles


def test_chunk_boundaries() -> None:
    assert indexnow.chunk_urls([]) == []
    assert indexnow.CHUNK == 10_000
    one = indexnow.chunk_urls(["https://publicjobs.ca/jobs/a/"])
    assert one == [["https://publicjobs.ca/jobs/a/"]]
    exact = [f"https://publicjobs.ca/jobs/{i}/" for i in range(10_000)]
    chunks = indexnow.chunk_urls(exact)
    assert len(chunks) == 1
    assert len(chunks[0]) == 10_000
    over = exact + ["https://publicjobs.ca/jobs/extra/"]
    chunks = indexnow.chunk_urls(over)
    assert [len(chunk) for chunk in chunks] == [10_000, 1]
    assert chunks[1] == ["https://publicjobs.ca/jobs/extra/"]
    assert chunks[0][0] == exact[0]
    assert chunks[0][-1] == exact[-1]
    two = indexnow.chunk_urls([f"https://publicjobs.ca/jobs/{i}/" for i in range(20_000)])
    assert [len(chunk) for chunk in two] == [10_000, 10_000]

    body = indexnow.payload(KEY, chunks[0][:2])
    assert body == {
        "host": "publicjobs.ca",
        "key": KEY,
        "keyLocation": f"https://publicjobs.ca/{KEY}.txt",
        "urlList": chunks[0][:2],
    }


def test_stats_url_included_when_sending() -> None:
    assert indexnow.STATS_URL == "https://publicjobs.ca/stats/"
    assert indexnow.include_stats_url([]) == []
    urls = ["https://publicjobs.ca/jobs/a/"]
    assert indexnow.include_stats_url(urls) == [
        "https://publicjobs.ca/jobs/a/",
        "https://publicjobs.ca/stats/",
    ]
    assert urls == ["https://publicjobs.ca/jobs/a/"]
    twice = indexnow.include_stats_url(indexnow.include_stats_url(urls))
    assert twice.count(indexnow.STATS_URL) == 1
    many = [f"https://publicjobs.ca/jobs/{i}/" for i in range(10_000)]
    chunks = indexnow.chunk_urls(indexnow.include_stats_url(many))
    assert [len(chunk) for chunk in chunks] == [10_000, 1]
    assert chunks[1] == ["https://publicjobs.ca/stats/"]


def test_key_file_and_middleware_exclusion() -> None:
    path = ROOT / "web" / "public" / f"{KEY}.txt"
    assert path.read_bytes() == KEY.encode("ascii")
    assert indexnow.load_key() == KEY
    middleware = (ROOT / "web" / "middleware.ts").read_text(encoding="utf-8")
    assert f"{KEY}\\\\.txt" in middleware
    config = (ROOT / "web" / "next.config.ts").read_text(encoding="utf-8")
    assert f"/{KEY}.txt" in config


def test_dry_run_prints_payload_and_post_failure_exits_zero() -> None:
    previous = [job(title="Gone", apply_url="https://example.com/gone")]
    current = [job(title="Added", apply_url="https://example.com/added", posted_date="2026-10-11")]
    with tempfile.TemporaryDirectory() as tmp:
        prev_path = Path(tmp) / "previous.json"
        new_path = Path(tmp) / "new.json"
        prev_path.write_text(json.dumps(previous), encoding="utf-8")
        new_path.write_text(json.dumps(current), encoding="utf-8")
        dry = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "notify_indexnow.py"),
                "--previous",
                str(prev_path),
                "--new",
                str(new_path),
                "--dry-run",
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        assert dry.returncode == 0, dry.stderr
        assert "posted" not in dry.stdout
        payload = json.loads(dry.stdout[: dry.stdout.rfind("}") + 1])
        assert payload["host"] == "publicjobs.ca"
        assert payload["key"] == KEY
        assert payload["keyLocation"] == f"https://publicjobs.ca/{KEY}.txt"
        assert len(payload["urlList"]) == 3
        assert payload["urlList"][-1] == "https://publicjobs.ca/stats/"
        assert all(url.startswith("https://publicjobs.ca/jobs/") for url in payload["urlList"][:-1])
        assert "added" in dry.stdout
        assert "removed" in dry.stdout
        assert "dry-run" in dry.stdout

        def boom(_body: dict) -> None:
            raise TimeoutError("timed out")

        original = indexnow.post_payload
        indexnow.post_payload = boom
        stderr = sys.stderr
        captured = tempfile.TemporaryFile(mode="w+", encoding="utf-8")
        try:
            sys.stderr = captured
            code = indexnow.run(["--previous", str(prev_path), "--new", str(new_path)])
        finally:
            sys.stderr = stderr
            indexnow.post_payload = original
        captured.seek(0)
        warning = captured.read()
        captured.close()
        assert code == 0
        assert "IndexNow failed" in warning
        assert "timed out" in warning


def main() -> None:
    test_diff_matches_indexing_rules()
    test_chunk_boundaries()
    test_stats_url_included_when_sending()
    test_key_file_and_middleware_exclusion()
    test_dry_run_prints_payload_and_post_failure_exits_zero()
    print("notify indexnow ok")


if __name__ == "__main__":
    main()
