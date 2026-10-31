import sqlite3
from collections.abc import Callable
from datetime import UTC, date, datetime

import pytest

from jobinsights.config import ReconcileSettings
from jobinsights.models import BoardRef, PostingRecord
from jobinsights.reconcile import ReconcileResult, reconcile_board
from jobinsights.store import repo
from jobinsights.store.repo import SpanEvent

MakeRecord = Callable[..., PostingRecord]

SETTINGS = ReconcileSettings(
    absences_to_close=2, suspicious_drop_min_open=20, zero_job_runs_to_release=3
)
NOW = datetime(2026, 10, 1, 6, 0, tzinfo=UTC)
ACME = BoardRef(ats="greenhouse", slug="acme")
DAY1 = date(2026, 10, 1)


def day(n: int) -> date:
    return date(2026, 10, n)


class Board:
    """A board with postings, driven one simulated day at a time."""

    def __init__(self, conn: sqlite3.Connection, make_record: MakeRecord) -> None:
        self.conn = conn
        self.make_record = make_record
        with conn:
            self.board_id = repo.upsert_board(
                conn, ACME, status="active", discovered_via="seed", discovered_date=day(1)
            )

    def add_postings(self, count: int, first_seen: date = DAY1) -> list[int]:
        """Postings seen for the first time on `first_seen`, each with an open span."""
        ids = []
        with self.conn:
            for n in range(count):
                record = self.make_record(native_id=f"acme:{first_seen}:{n}", board=ACME)
                result = repo.upsert_posting(
                    self.conn,
                    record,
                    run_date=first_seen,
                    parser_version="1",
                    board_id=self.board_id,
                )
                repo.mark_present(self.conn, result.posting_id, first_seen)
                ids.append(result.posting_id)
        return ids

    def record_fetch(self, on: date, item_count: int | None, target: str = "acme") -> None:
        with self.conn:
            run_id = repo.get_or_start_run(self.conn, on, NOW)
            fetch_id = repo.start_fetch(
                self.conn, run_id, "greenhouse", target, NOW, board_id=self.board_id
            )
            repo.finish_fetch(
                self.conn,
                fetch_id,
                ok=item_count is not None,
                http_status=200 if item_count is not None else 503,
                item_count=item_count,
                duration_ms=1,
            )

    def collect(
        self,
        on: date,
        present: list[int],
        *,
        settings: ReconcileSettings = SETTINGS,
        hold_absences: bool = False,
        out_of_scope: int = 0,
    ) -> ReconcileResult:
        """One successful fetch of the board on `on`, returning these postings.

        `out_of_scope` adds jobs to the response that aren't stored as postings.
        """
        response_items = len(present) + out_of_scope
        with self.conn:
            result = reconcile_board(
                self.conn,
                board_id=self.board_id,
                present_ids=present,
                response_items=response_items,
                run_date=on,
                settings=settings,
                hold_absences=hold_absences,
            )
        self.record_fetch(on, item_count=response_items)
        return result

    def spans(self, posting_id: int) -> list[tuple[str, str | None, str | None]]:
        rows = self.conn.execute(
            "SELECT open_date, close_date, pending_absent_date FROM posting_spans "
            "WHERE posting_id = ? ORDER BY open_date",
            (posting_id,),
        )
        return [(row[0], row[1], row[2]) for row in rows]


@pytest.fixture
def board(jobs_db: sqlite3.Connection, make_record: MakeRecord) -> Board:
    return Board(jobs_db, make_record)


# --- the rows of the table in PLAN.md section 5.3 --------------------------------


def test_a_new_posting_opens_a_span(board: Board, make_record: MakeRecord) -> None:
    with board.conn:
        posting_id = repo.upsert_posting(
            board.conn,
            make_record(native_id="acme:new", board=ACME),
            run_date=day(1),
            parser_version="1",
            board_id=board.board_id,
        ).posting_id

    result = board.collect(day(1), [posting_id])

    assert result.events == {SpanEvent.OPENED: 1}
    assert board.spans(posting_id) == [("2026-10-01", None, None)]


def test_a_seen_posting_stays_open(board: Board) -> None:
    [posting_id] = board.add_postings(1)

    result = board.collect(day(2), [posting_id])

    assert result.events == {SpanEvent.SEEN: 1}
    assert board.spans(posting_id) == [("2026-10-01", None, None)]


def test_a_seen_posting_clears_its_pending_absence(board: Board) -> None:
    [kept, returning] = board.add_postings(2)
    board.collect(day(2), [kept])
    assert board.spans(returning) == [("2026-10-01", None, "2026-10-02")]

    result = board.collect(day(3), [kept, returning])

    assert result.events == {SpanEvent.SEEN: 2}
    assert board.spans(returning) == [("2026-10-01", None, None)]


def test_the_first_absence_is_only_pending(board: Board) -> None:
    [kept, missing] = board.add_postings(2)

    result = board.collect(day(2), [kept])

    assert result.events == {SpanEvent.SEEN: 1, SpanEvent.PENDING: 1}
    assert board.spans(missing) == [("2026-10-01", None, "2026-10-02")]


def test_a_second_absence_closes_as_of_the_first(board: Board) -> None:
    [kept, missing] = board.add_postings(2)
    board.collect(day(2), [kept])

    result = board.collect(day(5), [kept])

    assert result.events == {SpanEvent.SEEN: 1, SpanEvent.CLOSED: 1}
    assert board.spans(missing) == [("2026-10-01", "2026-10-02", None)]


def test_a_returning_posting_is_a_repost_with_a_new_span(board: Board) -> None:
    [kept, reposted] = board.add_postings(2)
    board.collect(day(2), [kept])
    board.collect(day(3), [kept])

    result = board.collect(day(9), [kept, reposted])

    assert result.events == {SpanEvent.SEEN: 1, SpanEvent.REOPENED: 1}
    assert board.spans(reposted) == [
        ("2026-10-01", "2026-10-02", None),
        ("2026-10-09", None, None),
    ]


def test_a_same_day_rerun_never_confirms_a_closure(board: Board) -> None:
    [kept, missing] = board.add_postings(2)
    board.collect(day(2), [kept])

    result = board.collect(day(2), [kept])

    assert result.events == {SpanEvent.SEEN: 1, SpanEvent.UNCHANGED: 1}
    assert board.spans(missing) == [("2026-10-01", None, "2026-10-02")]


def test_only_this_boards_postings_are_touched(
    board: Board, jobs_db: sqlite3.Connection, make_record: MakeRecord
) -> None:
    other_ref = BoardRef(ats="greenhouse", slug="other")
    with jobs_db:
        other_board = repo.upsert_board(
            jobs_db, other_ref, status="active", discovered_via="seed", discovered_date=day(1)
        )
        other = repo.upsert_posting(
            jobs_db,
            make_record(native_id="other:1", board=other_ref),
            run_date=day(1),
            parser_version="1",
            board_id=other_board,
        ).posting_id
        repo.mark_present(jobs_db, other, day(1))
    [kept] = board.add_postings(1)

    board.collect(day(2), [kept])

    assert board.spans(other) == [("2026-10-01", None, None)]


# --- a large board dropping to 0 ---------------------------------------------------


def test_a_board_over_the_threshold_is_held_when_it_drops_to_zero(board: Board) -> None:
    ids = board.add_postings(21)

    result = board.collect(day(2), [])

    assert result.held
    assert not result.released
    assert not result.events
    assert board.spans(ids[0]) == [("2026-10-01", None, None)]  # not even pending


def test_a_board_at_the_threshold_is_not_held(board: Board) -> None:
    ids = board.add_postings(20)

    result = board.collect(day(2), [])

    assert not result.held
    assert result.events == {SpanEvent.PENDING: 20}
    assert board.spans(ids[0]) == [("2026-10-01", None, "2026-10-02")]


def test_a_drop_to_a_few_jobs_is_not_held(board: Board) -> None:
    ids = board.add_postings(30)

    result = board.collect(day(2), ids[:1])

    assert not result.held
    assert result.events == {SpanEvent.SEEN: 1, SpanEvent.PENDING: 29}


def test_the_third_zero_job_run_closes_as_of_the_first(board: Board) -> None:
    ids = board.add_postings(25)

    first = board.collect(day(5), [])
    second = board.collect(day(6), [])
    third = board.collect(day(7), [])

    assert first.held
    assert second.held
    assert not third.held
    assert third.released
    assert third.events == {SpanEvent.CLOSED: 25}
    for posting_id in ids:
        assert board.spans(posting_id) == [("2026-10-01", "2026-10-05", None)]


def test_zero_days_need_not_be_consecutive_dates(board: Board) -> None:
    [first_id, *_] = board.add_postings(25)

    board.collect(day(5), [])
    board.collect(day(8), [])
    third = board.collect(day(20), [])

    assert third.released
    assert board.spans(first_id) == [("2026-10-01", "2026-10-05", None)]


def test_a_fetch_with_jobs_resets_the_count(board: Board) -> None:
    ids = board.add_postings(25)

    board.collect(day(5), [])
    board.collect(day(6), [])
    back = board.collect(day(7), ids)
    fourth = board.collect(day(8), [])
    fifth = board.collect(day(9), [])
    sixth = board.collect(day(10), [])

    assert back.events == {SpanEvent.SEEN: 25}
    assert fourth.held
    assert fifth.held
    assert sixth.released
    assert board.spans(ids[0]) == [("2026-10-01", "2026-10-08", None)]


def test_a_failed_fetch_neither_counts_nor_resets(board: Board) -> None:
    [first_id, *_] = board.add_postings(25)

    board.collect(day(5), [])
    board.record_fetch(day(6), item_count=None)
    second = board.collect(day(7), [])
    board.record_fetch(day(8), item_count=None)
    third = board.collect(day(9), [])

    assert second.held
    assert third.released
    assert board.spans(first_id) == [("2026-10-01", "2026-10-05", None)]


def test_a_request_for_one_job_does_not_reset_the_count(board: Board) -> None:
    board.add_postings(25)

    board.collect(day(5), [])
    board.record_fetch(day(6), item_count=1, target="detail:acme:123")
    board.collect(day(7), [])
    third = board.collect(day(8), [])

    assert third.released


def test_a_same_day_rerun_counts_as_one_zero_job_run(board: Board) -> None:
    board.add_postings(25)

    board.collect(day(5), [])
    board.collect(day(5), [])
    second_day = board.collect(day(6), [])
    second_day_again = board.collect(day(6), [])

    assert second_day.held
    assert second_day_again.held


def test_a_days_latest_fetch_decides_it(board: Board) -> None:
    ids = board.add_postings(25)

    board.collect(day(5), [])
    board.record_fetch(day(5), item_count=25)  # a later fetch that day had jobs
    board.collect(day(6), [])
    second = board.collect(day(7), [])

    assert second.held  # day 5 doesn't count, so this is only the 2nd
    assert board.spans(ids[0]) == [("2026-10-01", None, None)]


def test_a_posting_already_pending_closes_on_its_own_date(board: Board) -> None:
    ids = board.add_postings(26)
    board.collect(day(2), ids[1:])  # ids[0] goes missing while the rest stay

    board.collect(day(5), [])
    board.collect(day(6), [])
    third = board.collect(day(7), [])

    assert third.events == {SpanEvent.CLOSED: 26}
    assert board.spans(ids[0]) == [("2026-10-01", "2026-10-02", None)]
    assert board.spans(ids[1]) == [("2026-10-01", "2026-10-05", None)]


def test_jobs_coming_back_after_a_release_are_reposts(board: Board) -> None:
    ids = board.add_postings(25)
    for n in (5, 6, 7):
        board.collect(day(n), [])

    result = board.collect(day(9), ids)

    assert result.events == {SpanEvent.REOPENED: 25}
    assert board.spans(ids[0]) == [
        ("2026-10-01", "2026-10-05", None),
        ("2026-10-09", None, None),
    ]


def test_an_empty_board_after_a_release_has_nothing_left_to_do(board: Board) -> None:
    board.add_postings(25)
    for n in (5, 6, 7):
        board.collect(day(n), [])

    result = board.collect(day(8), [])

    assert not result.held
    assert not result.released
    assert not result.events


def test_release_after_one_run_means_no_hold(board: Board) -> None:
    ids = board.add_postings(25)
    settings = SETTINGS.model_copy(update={"zero_job_runs_to_release": 1})

    first = board.collect(day(5), [], settings=settings)
    second = board.collect(day(6), [], settings=settings)

    assert not first.held
    assert first.events == {SpanEvent.PENDING: 25}
    assert second.events == {SpanEvent.CLOSED: 25}
    assert board.spans(ids[0]) == [("2026-10-01", "2026-10-05", None)]


# --- responses with jobs that aren't stored --------------------------------------


def test_jobs_all_out_of_scope_is_not_a_suspicious_drop(board: Board) -> None:
    ids = board.add_postings(25)

    first = board.collect(day(5), [], out_of_scope=40)
    second = board.collect(day(6), [], out_of_scope=40)

    assert not first.held
    assert first.events == {SpanEvent.PENDING: 25}
    assert second.events == {SpanEvent.CLOSED: 25}
    assert board.spans(ids[0]) == [("2026-10-01", "2026-10-05", None)]


def test_a_day_with_only_out_of_scope_jobs_resets_the_zero_job_count(board: Board) -> None:
    ids = board.add_postings(25)

    board.collect(day(5), [])
    board.collect(day(6), ids, out_of_scope=40)
    second = board.collect(day(7), [])
    third = board.collect(day(8), [])

    assert second.held
    assert third.held  # only 2 zero-job runs since the board last had jobs


# --- holding absences after a parse error ----------------------------------------


def test_hold_absences_marks_only_the_present(board: Board) -> None:
    [kept, missing] = board.add_postings(2)
    board.collect(day(2), [kept])  # `missing` is now pending

    result = board.collect(day(3), [kept], hold_absences=True)

    assert result.events == {SpanEvent.SEEN: 1}
    assert not result.held
    assert board.spans(missing) == [("2026-10-01", None, "2026-10-02")]


def test_hold_absences_with_nothing_parsed_is_not_a_suspicious_drop(board: Board) -> None:
    ids = board.add_postings(25)

    result = board.collect(day(2), [], hold_absences=True, out_of_scope=3)

    assert not result.held
    assert not result.released
    assert not result.events
    assert board.spans(ids[0]) == [("2026-10-01", None, None)]
