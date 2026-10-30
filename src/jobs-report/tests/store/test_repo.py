import json
import sqlite3
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from jobinsights.descriptions import decompress
from jobinsights.models import BoardRef, PostingRecord
from jobinsights.store import repo

MakeRecord = Callable[..., PostingRecord]

DAY1 = date(2026, 10, 29)
DAY2 = date(2026, 10, 30)
NOW = datetime(2026, 10, 29, 6, 0, tzinfo=UTC)


def count(conn: sqlite3.Connection, table: str) -> int:
    return conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]


def posting(conn: sqlite3.Connection, posting_id: int) -> dict[str, object]:
    row = conn.execute("SELECT * FROM postings WHERE posting_id = ?", (posting_id,)).fetchone()
    return dict(row)


def versions(conn: sqlite3.Connection, posting_id: int) -> list[tuple[str, str]]:
    rows = conn.execute(
        "SELECT observed_date, title FROM posting_versions WHERE posting_id = ? "
        "ORDER BY observed_date",
        (posting_id,),
    )
    return [(row["observed_date"], row["title"]) for row in rows]


# --- runs and fetches -------------------------------------------------------


def test_run_starts_running_and_finishes(jobs_db: sqlite3.Connection) -> None:
    run_id = repo.start_run(jobs_db, DAY1, NOW, git_sha="abc123")
    started = jobs_db.execute("SELECT * FROM runs WHERE run_id = ?", (run_id,)).fetchone()
    assert (started["run_date"], started["status"]) == ("2026-10-29", "running")
    assert started["started_at"] == "2026-10-29T06:00:00+00:00"

    repo.finish_run(jobs_db, run_id, "partial", NOW + timedelta(minutes=5), {"failed": ["lever"]})

    finished = jobs_db.execute("SELECT * FROM runs WHERE run_id = ?", (run_id,)).fetchone()
    assert finished["status"] == "partial"
    assert finished["finished_at"] == "2026-10-29T06:05:00+00:00"
    assert json.loads(finished["summary_json"]) == {"failed": ["lever"]}


def test_timestamps_are_stored_in_utc(jobs_db: sqlite3.Connection) -> None:
    pacific = datetime(2026, 10, 28, 23, 0, tzinfo=timezone(timedelta(hours=-7)))

    run_id = repo.start_run(jobs_db, DAY1, pacific)

    row = jobs_db.execute("SELECT started_at FROM runs WHERE run_id = ?", (run_id,)).fetchone()
    assert row["started_at"] == "2026-10-29T06:00:00+00:00"


def test_naive_timestamp_is_rejected(jobs_db: sqlite3.Connection) -> None:
    with pytest.raises(ValueError, match="no timezone"):
        repo.start_run(jobs_db, DAY1, datetime(2026, 10, 29, 6, 0))


def test_fetch_starts_not_ok_and_finishes(jobs_db: sqlite3.Connection) -> None:
    run_id = repo.start_run(jobs_db, DAY1, NOW)
    fetch_id = repo.start_fetch(jobs_db, run_id, "greenhouse", "stripe", NOW)
    assert jobs_db.execute("SELECT ok FROM fetches").fetchone()["ok"] == 0

    repo.finish_fetch(jobs_db, fetch_id, ok=True, http_status=200, item_count=42, duration_ms=850)

    row = jobs_db.execute("SELECT * FROM fetches WHERE fetch_id = ?", (fetch_id,)).fetchone()
    assert (row["ok"], row["http_status"], row["item_count"], row["error"]) == (1, 200, 42, None)


# --- companies and boards ---------------------------------------------------


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Stripe, Inc.", "stripe"),
        ("stripe", "stripe"),
        ("Scale AI", "scale ai"),
        ("Acme Pty Ltd", "acme"),
        ("Société Générale S.A.", "société générale"),
        ("O'Reilly Media", "oreilly media"),
        ("Hugging-Face", "hugging face"),
        ("Co", "co"),  # a suffix alone is still a name
    ],
)
def test_normalize_company_name(name: str, expected: str) -> None:
    assert repo.normalize_company_name(name) == expected


def test_company_name_without_letters_is_rejected() -> None:
    with pytest.raises(ValueError, match="no letters or digits"):
        repo.normalize_company_name(" , . ")


def test_upsert_company_is_idempotent(jobs_db: sqlite3.Connection) -> None:
    first = repo.upsert_company(jobs_db, "Stripe, Inc.", DAY1)
    again = repo.upsert_company(jobs_db, "stripe", DAY2, website="https://stripe.com")
    later = repo.upsert_company(jobs_db, "Stripe", DAY2, website="https://example.com")

    assert first == again == later
    row = jobs_db.execute("SELECT * FROM companies").fetchone()
    assert row["name"] == "Stripe, Inc."
    assert row["first_tracked_date"] == "2026-10-29"
    assert row["website"] == "https://stripe.com"  # filled in once, then kept


def test_upsert_board_is_idempotent_and_keeps_discovery(jobs_db: sqlite3.Connection) -> None:
    board = BoardRef(ats="greenhouse", slug="stripe")
    first = repo.upsert_board(
        jobs_db, board, status="active", discovered_via="seed", discovered_date=DAY1
    )
    company_id = repo.upsert_company(jobs_db, "Stripe", DAY2)
    again = repo.upsert_board(
        jobs_db,
        board,
        status="candidate",
        discovered_via="hn",
        discovered_date=DAY2,
        company_id=company_id,
    )

    assert first == again
    assert count(jobs_db, "boards") == 1
    row = jobs_db.execute("SELECT * FROM boards").fetchone()
    assert (row["status"], row["discovered_via"], row["discovered_date"]) == (
        "active",
        "seed",
        "2026-10-29",
    )
    assert row["company_id"] == company_id


def test_board_regions_are_distinct(jobs_db: sqlite3.Connection) -> None:
    us = repo.upsert_board(
        jobs_db,
        BoardRef(ats="lever", slug="acme"),
        status="active",
        discovered_via="seed",
        discovered_date=DAY1,
    )
    eu = repo.upsert_board(
        jobs_db,
        BoardRef(ats="lever", region="eu", slug="acme"),
        status="active",
        discovered_via="seed",
        discovered_date=DAY1,
    )

    assert us != eu


# --- postings ---------------------------------------------------------------


def test_new_posting_is_stored_with_description_and_baseline_version(
    jobs_db: sqlite3.Connection, make_record: MakeRecord
) -> None:
    result = repo.upsert_posting(jobs_db, make_record(), run_date=DAY1, parser_version="1")

    assert (result.is_new, result.changed) == (True, False)
    row = posting(jobs_db, result.posting_id)
    assert (row["first_seen_date"], row["last_seen_date"]) == ("2026-10-29", "2026-10-29")
    assert json.loads(row["locations_raw"]) == ["San Francisco, CA", "Remote (US)"]
    text = jobs_db.execute("SELECT text_zlib FROM descriptions").fetchone()["text_zlib"]
    assert decompress(text) == "Build APIs."
    assert versions(jobs_db, result.posting_id) == [("2026-10-29", "Backend Engineer")]


def test_upsert_posting_same_day_is_idempotent(
    jobs_db: sqlite3.Connection, make_record: MakeRecord
) -> None:
    first = repo.upsert_posting(jobs_db, make_record(), run_date=DAY1, parser_version="1")
    before = posting(jobs_db, first.posting_id)

    again = repo.upsert_posting(jobs_db, make_record(), run_date=DAY1, parser_version="1")

    assert again == repo.UpsertResult(first.posting_id, is_new=False, changed=False)
    assert posting(jobs_db, first.posting_id) == before
    assert [count(jobs_db, t) for t in ("postings", "posting_versions", "descriptions")] == [
        1,
        1,
        1,
    ]


def test_upsert_posting_next_day_only_advances_last_seen(
    jobs_db: sqlite3.Connection, make_record: MakeRecord
) -> None:
    first = repo.upsert_posting(jobs_db, make_record(), run_date=DAY1, parser_version="1")

    result = repo.upsert_posting(jobs_db, make_record(), run_date=DAY2, parser_version="1")

    assert result.changed is False
    row = posting(jobs_db, first.posting_id)
    assert (row["first_seen_date"], row["last_seen_date"]) == ("2026-10-29", "2026-10-30")
    assert count(jobs_db, "posting_versions") == 1


@pytest.mark.parametrize(
    "change",
    [
        {"title": "Senior Backend Engineer"},
        {"description_html": "<p>Build <b>APIs</b> and SDKs.</p>"},
        {"locations_raw": ["New York, NY"]},
        {"salary_raw": "$200,000 - $260,000"},
    ],
)
def test_version_added_on_tracked_field_change(
    jobs_db: sqlite3.Connection, make_record: MakeRecord, change: dict[str, object]
) -> None:
    first = repo.upsert_posting(jobs_db, make_record(), run_date=DAY1, parser_version="1")

    result = repo.upsert_posting(jobs_db, make_record(**change), run_date=DAY2, parser_version="1")

    assert result.changed is True
    assert count(jobs_db, "posting_versions") == 2
    dates = [d for d, _ in versions(jobs_db, first.posting_id)]
    assert dates == ["2026-10-29", "2026-10-30"]


def test_version_not_added_on_untracked_change(
    jobs_db: sqlite3.Connection, make_record: MakeRecord
) -> None:
    first = repo.upsert_posting(jobs_db, make_record(), run_date=DAY1, parser_version="1")

    result = repo.upsert_posting(
        jobs_db, make_record(department_raw="Platform"), run_date=DAY2, parser_version="2"
    )

    assert result.changed is False
    assert count(jobs_db, "posting_versions") == 1
    row = posting(jobs_db, first.posting_id)
    assert (row["department_raw"], row["parser_version"]) == ("Platform", "2")


def test_formatting_only_description_change_is_not_a_version(
    jobs_db: sqlite3.Connection, make_record: MakeRecord
) -> None:
    repo.upsert_posting(jobs_db, make_record(), run_date=DAY1, parser_version="1")

    result = repo.upsert_posting(
        jobs_db,
        make_record(description_html="<p>\n  Build <strong>APIs</strong>.\n</p>"),
        run_date=DAY2,
        parser_version="1",
    )

    assert result.changed is False
    assert count(jobs_db, "descriptions") == 1


def test_second_change_on_same_day_rewrites_that_days_version(
    jobs_db: sqlite3.Connection, make_record: MakeRecord
) -> None:
    first = repo.upsert_posting(jobs_db, make_record(), run_date=DAY1, parser_version="1")
    repo.upsert_posting(
        jobs_db, make_record(title="Engineer II"), run_date=DAY2, parser_version="1"
    )

    repo.upsert_posting(
        jobs_db, make_record(title="Engineer III"), run_date=DAY2, parser_version="1"
    )

    assert versions(jobs_db, first.posting_id) == [
        ("2026-10-29", "Backend Engineer"),
        ("2026-10-30", "Engineer III"),
    ]


def test_change_reverted_on_same_day_leaves_no_version(
    jobs_db: sqlite3.Connection, make_record: MakeRecord
) -> None:
    first = repo.upsert_posting(jobs_db, make_record(), run_date=DAY1, parser_version="1")
    repo.upsert_posting(
        jobs_db, make_record(title="Engineer II"), run_date=DAY2, parser_version="1"
    )

    result = repo.upsert_posting(jobs_db, make_record(), run_date=DAY2, parser_version="1")

    assert result.changed is True  # differs from what was stored before this call
    assert versions(jobs_db, first.posting_id) == [("2026-10-29", "Backend Engineer")]


def test_postings_with_the_same_text_share_one_description(
    jobs_db: sqlite3.Connection, make_record: MakeRecord
) -> None:
    repo.upsert_posting(jobs_db, make_record(), run_date=DAY1, parser_version="1")
    repo.upsert_posting(
        jobs_db,
        make_record(native_id="stripe:456", description_html="<div>Build <i>APIs</i>.</div>"),
        run_date=DAY1,
        parser_version="1",
    )

    assert count(jobs_db, "postings") == 2
    assert count(jobs_db, "descriptions") == 1


def test_plain_text_description_is_normalized(
    jobs_db: sqlite3.Connection, make_record: MakeRecord
) -> None:
    record = make_record(description_html=None, description_text="  Build APIs.  \r\n")

    result = repo.upsert_posting(jobs_db, record, run_date=DAY1, parser_version="1")

    row = posting(jobs_db, result.posting_id)
    blob = jobs_db.execute(
        "SELECT text_zlib FROM descriptions WHERE description_hash = ?", (row["description_hash"],)
    ).fetchone()["text_zlib"]
    assert decompress(blob) == "Build APIs."


@pytest.mark.parametrize("html", [None, "", "<p> </p>"])
def test_missing_or_empty_description_stores_none(
    jobs_db: sqlite3.Connection, make_record: MakeRecord, html: str | None
) -> None:
    result = repo.upsert_posting(
        jobs_db, make_record(description_html=html), run_date=DAY1, parser_version="1"
    )

    assert posting(jobs_db, result.posting_id)["description_hash"] is None
    assert count(jobs_db, "descriptions") == 0


def test_upsert_with_an_older_run_date_is_refused(
    jobs_db: sqlite3.Connection, make_record: MakeRecord
) -> None:
    repo.upsert_posting(jobs_db, make_record(), run_date=DAY2, parser_version="1")

    with pytest.raises(ValueError, match="older run_date"):
        repo.upsert_posting(
            jobs_db, make_record(description_html="<p>new</p>"), run_date=DAY1, parser_version="1"
        )

    assert count(jobs_db, "descriptions") == 1  # nothing written before the check


def test_upsert_stores_ids_and_raw_fields(
    jobs_db: sqlite3.Connection, make_record: MakeRecord
) -> None:
    company_id = repo.upsert_company(jobs_db, "Stripe", DAY1)
    board_id = repo.upsert_board(
        jobs_db,
        BoardRef(ats="greenhouse", slug="stripe"),
        status="active",
        discovered_via="seed",
        discovered_date=DAY1,
        company_id=company_id,
    )
    record = make_record(extra={"internal_job_id": 99}, salary_min=180000, salary_max=240000)

    result = repo.upsert_posting(
        jobs_db,
        record,
        run_date=DAY1,
        parser_version="1",
        archive_hash="ab" * 32,
        board_id=board_id,
        company_id=company_id,
    )

    row = posting(jobs_db, result.posting_id)
    assert (row["board_id"], row["company_id"], row["snapshot"]) == (board_id, company_id, 1)
    assert (row["salary_min"], row["salary_max"]) == (180000.0, 240000.0)
    assert json.loads(row["extra_json"]) == {"internal_job_id": 99}
    assert row["archive_hash"] == "ab" * 32


# --- models -----------------------------------------------------------------


def test_record_rejects_both_description_kinds(make_record: MakeRecord) -> None:
    with pytest.raises(ValidationError, match="not both"):
        make_record(description_text="plain too")


def test_record_rejects_unknown_fields(make_record: MakeRecord) -> None:
    with pytest.raises(ValidationError, match="Extra inputs"):
        make_record(seniority="senior")


def test_record_rejects_empty_title(make_record: MakeRecord) -> None:
    with pytest.raises(ValidationError):
        make_record(title="")
