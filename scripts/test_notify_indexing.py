#!/usr/bin/env python3
"""Selection rules for scripts/notify_indexing.py. No network and no credentials."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import notify_indexing as notify  # noqa: E402

TODAY = date(2026, 10, 11)


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


def test_new_closed_removed_and_thin() -> None:
    previous = notify.index_jobs(
        [
            job(title="Still open", apply_url="https://example.com/a"),
            job(title="Now closed", apply_url="https://example.com/b", closing_date="2026-12-01"),
            job(title="Already closed", apply_url="https://example.com/c", closing_date="2026-10-01"),
            job(title="Removed", apply_url="https://example.com/d", posted_date="2026-09-01"),
            job(title="Thin removed", apply_url="https://example.com/e", description="  "),
        ]
    )
    current = notify.index_jobs(
        [
            job(title="Still open", apply_url="https://example.com/a"),
            job(title="Now closed", apply_url="https://example.com/b", closing_date="2026-10-10"),
            job(title="Already closed", apply_url="https://example.com/c", closing_date="2026-10-01"),
            job(title="Brand new", apply_url="https://example.com/f", posted_date="2026-10-11"),
            job(title="Thin new", apply_url="https://example.com/g", description=""),
            job(title="Paragraph only", apply_url="https://example.com/h", description=" ", paragraphs=["Bonjour."], posted_date="2026-10-09"),
        ]
    )
    chosen, thin, over = notify.select_notifications(previous, current, TODAY)
    reasons = {(item["job"]["title"], item["reason"]) for item in chosen}
    assert reasons == {
        ("Brand new", "new"),
        ("Now closed", "closed"),
        ("Removed", "removed"),
        ("Paragraph only", "new"),
    }, reasons
    assert {item["job"]["title"] for item in thin} == {"Thin new", "Thin removed"}
    assert over == []
    titles = [item["job"]["title"] for item in chosen]
    assert titles[0] == "Brand new"
    assert titles[-1] == "Removed"


def test_cap_keeps_newest() -> None:
    previous = notify.index_jobs([])
    rows = [
        job(
            title=f"Role {i:03d}",
            apply_url=f"https://example.com/{i}",
            posted_date=f"2026-01-{(i % 28) + 1:02d}",
            fetched_at=f"2026-02-{(i % 28) + 1:02d}T00:00:00Z",
        )
        for i in range(181)
    ]
    current = notify.index_jobs(rows)
    chosen, thin, over = notify.select_notifications(previous, current, TODAY, cap=180)
    assert len(chosen) == 180
    assert len(over) == 1
    assert thin == []
    assert notify.recency(chosen[0]["job"]) >= notify.recency(chosen[-1]["job"])
    assert notify.recency(over[0]["job"]) <= notify.recency(chosen[-1]["job"])


def test_explicit_path_is_kept() -> None:
    rows = notify.index_jobs(
        [job(title="Named", path="jobs/custom/kept/", apply_url="https://example.com/named")]
    )
    assert list(rows) == ["jobs/custom/kept/"]


def test_dry_run_and_missing_credentials() -> None:
    previous = [job(title="Gone", apply_url="https://example.com/gone")]
    current = [job(title="Added", apply_url="https://example.com/added", posted_date="2026-10-11")]
    with tempfile.TemporaryDirectory() as tmp:
        prev_path = Path(tmp) / "previous.json"
        new_path = Path(tmp) / "new.json"
        prev_path.write_text(json.dumps(previous), encoding="utf-8")
        new_path.write_text(json.dumps(current), encoding="utf-8")
        env = os.environ.copy()
        env.pop("GOOGLE_INDEXING_SA_JSON", None)
        env.pop("GOOGLE_INDEXING_SA_FILE", None)
        env["NEXT_PUBLIC_SITE_URL"] = "https://publicjobs.ca"
        dry = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "notify_indexing.py"),
                "--previous",
                str(prev_path),
                "--new",
                str(new_path),
                "--dry-run",
            ],
            check=False,
            capture_output=True,
            text=True,
            env=env,
        )
        assert dry.returncode == 0, dry.stderr
        assert "URL_UPDATED https://publicjobs.ca/jobs/" in dry.stdout
        assert " added" in dry.stdout or dry.stdout.count("URL_UPDATED") >= 1
        assert "removed" in dry.stdout
        assert "GOOGLE_INDEXING" not in dry.stderr
        live = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "notify_indexing.py"),
                "--previous",
                str(prev_path),
                "--new",
                str(new_path),
            ],
            check=False,
            capture_output=True,
            text=True,
            env=env,
        )
        assert live.returncode == 0, live.stderr
        assert "warning: GOOGLE_INDEXING_SA_JSON and GOOGLE_INDEXING_SA_FILE are unset" in live.stderr
        assert not any(line.startswith("URL_UPDATED ") for line in live.stdout.splitlines())


def main() -> None:
    test_new_closed_removed_and_thin()
    test_cap_keeps_newest()
    test_explicit_path_is_kept()
    test_dry_run_and_missing_credentials()
    print("notify indexing ok")


if __name__ == "__main__":
    main()
