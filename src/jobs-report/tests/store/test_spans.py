import sqlite3
from collections.abc import Callable
from datetime import date, timedelta

import pytest

from jobinsights.models import PostingRecord
from jobinsights.store import repo
from jobinsights.store.repo import SpanEvent, mark_absent, mark_present

MakeRecord = Callable[..., PostingRecord]
Span = tuple[str, str | None, str | None]  # open_date, close_date, pending_absent_date


def day(n: int) -> date:
    """Run date n: day(1) is 2026-10-01."""
    return date(2026, 10, 1) + timedelta(days=n - 1)


@pytest.fixture
def posting_id(jobs_db: sqlite3.Connection, make_record: MakeRecord) -> int:
    return repo.upsert_posting(
        jobs_db, make_record(), run_date=day(1), parser_version="1"
    ).posting_id


def spans(conn: sqlite3.Connection, posting_id: int) -> list[Span]:
    rows = conn.execute(
        "SELECT open_date, close_date, pending_absent_date FROM posting_spans "
        "WHERE posting_id = ? ORDER BY open_date",
        (posting_id,),
    )
    return [tuple(row) for row in rows]


def test_first_sighting_opens_a_span(jobs_db: sqlite3.Connection, posting_id: int) -> None:
    assert mark_present(jobs_db, posting_id, day(1)) is SpanEvent.OPENED
    assert spans(jobs_db, posting_id) == [("2026-10-01", None, None)]


def test_seen_again_keeps_the_span(jobs_db: sqlite3.Connection, posting_id: int) -> None:
    mark_present(jobs_db, posting_id, day(1))

    assert mark_present(jobs_db, posting_id, day(2)) is SpanEvent.SEEN
    assert mark_present(jobs_db, posting_id, day(2)) is SpanEvent.SEEN  # same-day re-run
    assert spans(jobs_db, posting_id) == [("2026-10-01", None, None)]


def test_first_absence_is_pending(jobs_db: sqlite3.Connection, posting_id: int) -> None:
    mark_present(jobs_db, posting_id, day(1))

    assert mark_absent(jobs_db, posting_id, day(2)) is SpanEvent.PENDING
    assert spans(jobs_db, posting_id) == [("2026-10-01", None, "2026-10-02")]


def test_second_absence_on_a_later_day_closes_at_the_first_absent_date(
    jobs_db: sqlite3.Connection, posting_id: int
) -> None:
    mark_present(jobs_db, posting_id, day(1))
    mark_absent(jobs_db, posting_id, day(2))

    assert mark_absent(jobs_db, posting_id, day(3)) is SpanEvent.CLOSED
    assert spans(jobs_db, posting_id) == [("2026-10-01", "2026-10-02", None)]


def test_same_day_rerun_never_confirms_a_closure(
    jobs_db: sqlite3.Connection, posting_id: int
) -> None:
    mark_present(jobs_db, posting_id, day(1))
    mark_absent(jobs_db, posting_id, day(2))

    assert mark_absent(jobs_db, posting_id, day(2)) is SpanEvent.UNCHANGED
    assert spans(jobs_db, posting_id) == [("2026-10-01", None, "2026-10-02")]


def test_seen_after_one_absence_clears_pending(
    jobs_db: sqlite3.Connection, posting_id: int
) -> None:
    mark_present(jobs_db, posting_id, day(1))
    mark_absent(jobs_db, posting_id, day(2))

    assert mark_present(jobs_db, posting_id, day(3)) is SpanEvent.SEEN
    assert spans(jobs_db, posting_id) == [("2026-10-01", None, None)]
    # The next absence starts the count again rather than closing.
    assert mark_absent(jobs_db, posting_id, day(4)) is SpanEvent.PENDING


def test_seen_after_close_reopens_with_a_new_span(
    jobs_db: sqlite3.Connection, posting_id: int
) -> None:
    mark_present(jobs_db, posting_id, day(1))
    mark_absent(jobs_db, posting_id, day(2))
    mark_absent(jobs_db, posting_id, day(3))

    assert mark_present(jobs_db, posting_id, day(5)) is SpanEvent.REOPENED
    assert spans(jobs_db, posting_id) == [
        ("2026-10-01", "2026-10-02", None),
        ("2026-10-05", None, None),
    ]


def test_absent_without_an_open_span_changes_nothing(
    jobs_db: sqlite3.Connection, posting_id: int
) -> None:
    assert mark_absent(jobs_db, posting_id, day(1)) is SpanEvent.UNCHANGED  # never opened

    mark_present(jobs_db, posting_id, day(1))
    mark_absent(jobs_db, posting_id, day(2))
    mark_absent(jobs_db, posting_id, day(3))

    assert mark_absent(jobs_db, posting_id, day(4)) is SpanEvent.UNCHANGED  # already closed
    assert spans(jobs_db, posting_id) == [("2026-10-01", "2026-10-02", None)]


def test_full_lifecycle(jobs_db: sqlite3.Connection, posting_id: int) -> None:
    events = [
        mark_present(jobs_db, posting_id, day(1)),
        mark_present(jobs_db, posting_id, day(2)),
        mark_absent(jobs_db, posting_id, day(3)),
        mark_absent(jobs_db, posting_id, day(3)),
        mark_absent(jobs_db, posting_id, day(4)),
        mark_present(jobs_db, posting_id, day(8)),
        mark_absent(jobs_db, posting_id, day(9)),
        mark_present(jobs_db, posting_id, day(10)),
    ]

    assert events == [
        SpanEvent.OPENED,
        SpanEvent.SEEN,
        SpanEvent.PENDING,
        SpanEvent.UNCHANGED,
        SpanEvent.CLOSED,
        SpanEvent.REOPENED,
        SpanEvent.PENDING,
        SpanEvent.SEEN,
    ]
    assert spans(jobs_db, posting_id) == [
        ("2026-10-01", "2026-10-03", None),
        ("2026-10-08", None, None),
    ]


def test_database_refuses_a_second_open_span(jobs_db: sqlite3.Connection, posting_id: int) -> None:
    mark_present(jobs_db, posting_id, day(1))

    with pytest.raises(sqlite3.IntegrityError, match="UNIQUE constraint failed"):
        jobs_db.execute(
            "INSERT INTO posting_spans (posting_id, open_date) VALUES (?, ?)",
            (posting_id, "2026-10-02"),
        )
