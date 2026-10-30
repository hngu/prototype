import sqlite3
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest

from jobinsights import archive
from jobinsights.archive import ArchiveItem
from jobinsights.store import db

TODAY = date(2026, 10, 29)

JOB_A = {"id": 1, "title": "Backend Engineer", "location": {"name": "Remote"}}
JOB_B = {"id": 2, "title": "Data Engineer", "location": {"name": "NYC"}}


def write(
    conn: sqlite3.Connection, fetch_id: int, run_date: date, *jobs: dict[str, Any]
) -> list[str]:
    """Archive a successful Greenhouse-style fetch of the given jobs."""
    return archive.write_manifest(
        conn,
        fetch_id=fetch_id,
        run_date=run_date,
        source="greenhouse",
        target="stripe",
        request_url="https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true",
        ok=True,
        http_status=200,
        envelope={"meta": {"total": len(jobs)}},
        items=[ArchiveItem(f"stripe:{job['id']}", job) for job in jobs],
    )


def objects(conn: sqlite3.Connection) -> dict[str, sqlite3.Row]:
    return {row["hash"]: row for row in conn.execute("SELECT * FROM raw_objects")}


def manifest_ids(conn: sqlite3.Connection) -> list[int]:
    return [row["fetch_id"] for row in conn.execute("SELECT fetch_id FROM manifests ORDER BY 1")]


# --- hashing and redaction --------------------------------------------------


def test_hash_ignores_key_order_and_whitespace() -> None:
    assert archive.object_hash({"a": 1, "b": [1, 2]}) == archive.object_hash({"b": [1, 2], "a": 1})


def test_hash_changes_with_content() -> None:
    assert archive.object_hash(JOB_A) != archive.object_hash(JOB_A | {"title": "Engineer"})


def test_hash_exclude_skips_top_level_keys() -> None:
    first = JOB_A | {"fetched_at": "2026-10-29T06:00:00Z"}
    second = JOB_A | {"fetched_at": "2026-10-30T06:00:00Z"}

    assert archive.object_hash(first) != archive.object_hash(second)
    assert archive.object_hash(first, ["fetched_at"]) == archive.object_hash(second, ["fetched_at"])


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        (
            "https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=abc&app_key=s3cret&what=python",
            "https://api.adzuna.com/v1/api/jobs/us/search/1"
            "?app_id=REDACTED&app_key=REDACTED&what=python",
        ),
        (
            "https://www.themuse.com/api/public/jobs?page=1&API_KEY=s3cret",
            "https://www.themuse.com/api/public/jobs?page=1&API_KEY=REDACTED",
        ),
        ("https://example.com/jobs?token=", "https://example.com/jobs?token=REDACTED"),
        (
            "https://api.lever.co/v0/postings/acme?mode=json",
            "https://api.lever.co/v0/postings/acme?mode=json",
        ),
        (
            "https://api.ashbyhq.com/posting-api/job-board/acme",
            "https://api.ashbyhq.com/posting-api/job-board/acme",
        ),
    ],
)
def test_redact_url(url: str, expected: str) -> None:
    assert archive.redact_url(url) == expected


# --- writing and reading ------------------------------------------------------


def test_same_item_twice_stores_one_object(archive_db: sqlite3.Connection) -> None:
    [first_hash] = write(archive_db, 1, TODAY - timedelta(days=1), JOB_A)
    [second_hash] = write(archive_db, 2, TODAY, JOB_A)

    assert first_hash == second_hash
    stored = objects(archive_db)
    assert list(stored) == [first_hash]
    assert stored[first_hash]["first_stored_date"] == "2026-10-28"
    assert stored[first_hash]["last_referenced_date"] == "2026-10-29"
    assert manifest_ids(archive_db) == [1, 2]


def test_older_write_never_moves_last_referenced_date_back(
    archive_db: sqlite3.Connection,
) -> None:
    [digest] = write(archive_db, 1, TODAY - timedelta(days=20), JOB_A)
    write(archive_db, 2, TODAY, JOB_A)

    write(archive_db, 3, TODAY - timedelta(days=10), JOB_A)  # e.g. a late backfill

    assert objects(archive_db)[digest]["last_referenced_date"] == "2026-10-29"


def test_read_fetch_round_trips_items_in_order(archive_db: sqlite3.Connection) -> None:
    hashes = write(archive_db, 7, TODAY, JOB_B, JOB_A)

    fetch = archive.read_fetch(archive_db, 7)

    assert fetch is not None
    assert (fetch.run_date, fetch.source, fetch.target) == (TODAY, "greenhouse", "stripe")
    assert (fetch.ok, fetch.http_status, fetch.error_body) == (True, 200, None)
    assert fetch.envelope == {"meta": {"total": 2}}
    assert [(i.native_id, i.hash, i.kind, i.body) for i in fetch.items] == [
        ("stripe:2", hashes[0], "item", JOB_B),
        ("stripe:1", hashes[1], "item", JOB_A),
    ]


def test_read_fetch_of_unknown_id_is_none(archive_db: sqlite3.Connection) -> None:
    assert archive.read_fetch(archive_db, 404) is None


def test_hash_exclude_keeps_the_field_in_the_stored_body(archive_db: sqlite3.Connection) -> None:
    for fetch_id, stamp in [(1, "2026-10-28T06:00:00Z"), (2, "2026-10-29T06:00:00Z")]:
        archive.write_manifest(
            archive_db,
            fetch_id=fetch_id,
            run_date=TODAY,
            source="remoteok",
            target="all",
            request_url="https://remoteok.com/api",
            ok=True,
            http_status=200,
            items=[ArchiveItem("1", JOB_A | {"fetched_at": stamp})],
            hash_exclude=["fetched_at"],
        )

    assert len(objects(archive_db)) == 1
    fetch = archive.read_fetch(archive_db, 2)
    assert fetch is not None
    assert fetch.items[0].body["fetched_at"] == "2026-10-28T06:00:00Z"  # first body stored wins


def test_failed_fetch_keeps_a_truncated_error_body(archive_db: sqlite3.Connection) -> None:
    archive.write_manifest(
        archive_db,
        fetch_id=3,
        run_date=TODAY,
        source="lever",
        target="acme",
        request_url="https://api.lever.co/v0/postings/acme?mode=json",
        ok=False,
        http_status=503,
        error_body="x" * 100_000,
    )

    fetch = archive.read_fetch(archive_db, 3)

    assert fetch is not None
    assert (fetch.ok, fetch.http_status, fetch.items, fetch.envelope) == (False, 503, [], None)
    assert fetch.error_body == b"x" * archive.ERROR_BODY_LIMIT


def test_unsplittable_body_is_archived_as_one_response_object(
    archive_db: sqlite3.Connection,
) -> None:
    body = {"unexpected": "shape"}
    archive.write_manifest(
        archive_db,
        fetch_id=4,
        run_date=TODAY,
        source="ashby",
        target="acme",
        request_url="https://api.ashbyhq.com/posting-api/job-board/acme",
        ok=False,
        http_status=200,
        items=[ArchiveItem(None, body, kind="response")],
    )

    fetch = archive.read_fetch(archive_db, 4)

    assert fetch is not None
    assert [(i.native_id, i.kind, i.body) for i in fetch.items] == [(None, "response", body)]


def test_request_url_is_redacted_on_write(archive_db: sqlite3.Connection) -> None:
    archive.write_manifest(
        archive_db,
        fetch_id=5,
        run_date=TODAY,
        source="adzuna",
        target="us:1",
        request_url="https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=abc&app_key=s3cret",
        ok=True,
        http_status=200,
    )

    stored = archive_db.execute("SELECT request_url FROM manifests").fetchone()["request_url"]
    assert "s3cret" not in stored
    assert "abc" not in stored


def test_write_is_committed_before_returning(tmp_path: Path) -> None:
    writer = db.connect(tmp_path / "archive.sqlite")
    db.migrate(writer, db.ARCHIVE_MIGRATIONS_DIR)

    write(writer, 1, TODAY, JOB_A)

    reader = db.connect(tmp_path / "archive.sqlite")
    assert manifest_ids(reader) == [1]
    assert len(objects(reader)) == 1


def test_duplicate_fetch_id_writes_nothing(archive_db: sqlite3.Connection) -> None:
    write(archive_db, 1, TODAY, JOB_A)

    with pytest.raises(sqlite3.IntegrityError):
        write(archive_db, 1, TODAY, JOB_B)

    assert len(objects(archive_db)) == 1  # JOB_B rolled back with the manifest


def test_iter_manifests_filters_by_date_and_source(archive_db: sqlite3.Connection) -> None:
    write(archive_db, 1, TODAY - timedelta(days=2), JOB_A)
    write(archive_db, 2, TODAY - timedelta(days=1), JOB_A)
    write(archive_db, 3, TODAY, JOB_A)
    archive.write_manifest(
        archive_db,
        fetch_id=4,
        run_date=TODAY,
        source="lever",
        target="acme",
        request_url="https://api.lever.co/v0/postings/acme?mode=json",
        ok=True,
        http_status=200,
    )

    in_range = archive.iter_manifests(archive_db, TODAY - timedelta(days=1), TODAY)
    assert [m.fetch_id for m in in_range] == [2, 3, 4]
    greenhouse = archive.iter_manifests(archive_db, TODAY, TODAY, source="greenhouse")
    assert [(m.fetch_id, m.source, m.ok) for m in greenhouse] == [(3, "greenhouse", True)]


# --- pruning ----------------------------------------------------------------


def test_prune_removes_expired_manifests_and_their_objects(archive_db: sqlite3.Connection) -> None:
    write(archive_db, 1, TODAY - timedelta(days=120), JOB_A, JOB_B)

    result = archive.prune(archive_db, TODAY, retention_days=90)

    assert (result.manifests_deleted, result.objects_deleted) == (1, 2)
    assert manifest_ids(archive_db) == []
    assert objects(archive_db) == {}


def test_prune_keeps_objects_still_referenced_inside_the_window(
    archive_db: sqlite3.Connection,
) -> None:
    hash_a, _ = write(archive_db, 1, TODAY - timedelta(days=120), JOB_A, JOB_B)
    write(archive_db, 2, TODAY - timedelta(days=10), JOB_A)

    archive.prune(archive_db, TODAY, retention_days=90)

    assert manifest_ids(archive_db) == [2]
    stored = objects(archive_db)
    assert list(stored) == [hash_a]  # first stored 120 days ago, still referenced
    assert stored[hash_a]["first_stored_date"] == "2026-07-01"
    fetch = archive.read_fetch(archive_db, 2)
    assert fetch is not None
    assert [item.body for item in fetch.items] == [JOB_A]


def test_prune_window_boundary(archive_db: sqlite3.Connection) -> None:
    oldest_kept = TODAY - timedelta(days=89)  # 90 run dates including today
    write(archive_db, 1, oldest_kept - timedelta(days=1), JOB_A)
    write(archive_db, 2, oldest_kept, JOB_B)

    result = archive.prune(archive_db, TODAY, retention_days=90)

    assert result.cutoff == oldest_kept
    assert manifest_ids(archive_db) == [2]
    assert [row["last_referenced_date"] for row in objects(archive_db).values()] == ["2026-08-01"]


def test_every_manifest_left_after_prune_can_be_read(archive_db: sqlite3.Connection) -> None:
    for offset in range(0, 150, 7):
        jobs = [JOB_A] if offset % 2 else [JOB_A, JOB_B]
        write(archive_db, offset + 1, TODAY - timedelta(days=offset), *jobs)

    archive.prune(archive_db, TODAY, retention_days=90)

    for fetch_id in manifest_ids(archive_db):
        assert archive.read_fetch(archive_db, fetch_id) is not None


def test_prune_rejects_a_zero_window(archive_db: sqlite3.Connection) -> None:
    with pytest.raises(ValueError, match="at least 1"):
        archive.prune(archive_db, TODAY, retention_days=0)
