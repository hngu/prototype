import sqlite3
from collections.abc import Callable
from datetime import UTC, date, datetime

from jobinsights.models import BoardRef, PostingRecord
from jobinsights.store import repo

MakeRecord = Callable[..., PostingRecord]

DAY1 = date(2026, 10, 1)
DAY2 = date(2026, 10, 2)
NOW = datetime(2026, 10, 1, 6, 0, tzinfo=UTC)


def add_board(
    conn: sqlite3.Connection,
    slug: str,
    *,
    ats: str = "greenhouse",
    status: repo.BoardStatus = "active",
    company_id: int | None = None,
) -> int:
    with conn:
        return repo.upsert_board(
            conn,
            BoardRef(ats=ats, slug=slug),
            status=status,
            discovered_via="seed",
            discovered_date=DAY1,
            company_id=company_id,
        )


def board_row(conn: sqlite3.Connection, board_id: int) -> sqlite3.Row:
    return conn.execute("SELECT * FROM boards WHERE board_id = ?", (board_id,)).fetchone()


# --- active_boards ----------------------------------------------------------------


def test_active_boards_returns_only_active_ones(jobs_db: sqlite3.Connection) -> None:
    add_board(jobs_db, "active-board")
    add_board(jobs_db, "candidate", status="candidate")
    add_board(jobs_db, "inactive", status="inactive")
    add_board(jobs_db, "invalid", status="invalid")

    assert [board.ref.slug for board in repo.active_boards(jobs_db)] == ["active-board"]


def test_active_boards_filters_by_ats_in_a_stable_order(jobs_db: sqlite3.Connection) -> None:
    add_board(jobs_db, "zeta")
    add_board(jobs_db, "alpha")
    add_board(jobs_db, "beta", ats="lever")

    everything = [(b.ref.ats, b.ref.slug) for b in repo.active_boards(jobs_db)]
    lever = [b.ref.slug for b in repo.active_boards(jobs_db, ats="lever")]

    assert everything == [("greenhouse", "alpha"), ("greenhouse", "zeta"), ("lever", "beta")]
    assert lever == ["beta"]


def test_active_boards_carry_their_ids_and_identity(jobs_db: sqlite3.Connection) -> None:
    with jobs_db:
        company_id = repo.upsert_company(jobs_db, "Acme", DAY1)
    board_id = add_board(jobs_db, "acme", company_id=company_id)

    [board] = repo.active_boards(jobs_db)

    assert board.board_id == board_id
    assert board.company_id == company_id
    assert board.ref == BoardRef(ats="greenhouse", region="default", slug="acme")


# --- success and failure ------------------------------------------------------------


def test_the_first_success_starts_tracking_and_later_ones_keep_it(
    jobs_db: sqlite3.Connection,
) -> None:
    board_id = add_board(jobs_db, "acme")

    with jobs_db:
        repo.record_board_success(jobs_db, board_id, DAY1)
        repo.record_board_success(jobs_db, board_id, DAY2)

    row = board_row(jobs_db, board_id)
    assert row["first_tracked_date"] == "2026-10-01"
    assert row["last_ok_date"] == "2026-10-02"


def test_failures_add_up_and_a_success_resets_them(jobs_db: sqlite3.Connection) -> None:
    board_id = add_board(jobs_db, "acme")

    with jobs_db:
        repo.record_board_failure(jobs_db, board_id)
        repo.record_board_failure(jobs_db, board_id)
    failed = board_row(jobs_db, board_id)
    with jobs_db:
        repo.record_board_success(jobs_db, board_id, DAY2)
    recovered = board_row(jobs_db, board_id)

    assert failed["consecutive_failures"] == 2
    assert failed["first_tracked_date"] is None  # a failure never starts tracking
    assert failed["last_ok_date"] is None
    assert recovered["consecutive_failures"] == 0


# --- open_posting_ids ---------------------------------------------------------------


def test_open_posting_ids_only_has_this_boards_open_postings(
    jobs_db: sqlite3.Connection, make_record: MakeRecord
) -> None:
    board_id = add_board(jobs_db, "acme")
    other_board = add_board(jobs_db, "other")

    def posting(native_id: str, on_board: int) -> int:
        result = repo.upsert_posting(
            jobs_db,
            make_record(native_id=native_id),
            run_date=DAY1,
            parser_version="1",
            board_id=on_board,
        )
        repo.mark_present(jobs_db, result.posting_id, DAY1)
        return result.posting_id

    with jobs_db:
        still_open = posting("acme:1", board_id)
        pending = posting("acme:2", board_id)
        closed = posting("acme:3", board_id)
        posting("other:1", other_board)
        repo.mark_absent(jobs_db, pending, DAY2)
        repo.mark_absent(jobs_db, closed, DAY1)
        repo.mark_absent(jobs_db, closed, DAY2)

    assert repo.open_posting_ids(jobs_db, board_id) == {still_open, pending}


def test_a_board_with_no_postings_has_none_open(jobs_db: sqlite3.Connection) -> None:
    assert repo.open_posting_ids(jobs_db, add_board(jobs_db, "acme")) == set()


# --- zero_job_streak ----------------------------------------------------------------


def record_fetch(
    conn: sqlite3.Connection,
    board_id: int,
    on: date,
    item_count: int | None,
    target: str = "acme",
) -> None:
    with conn:
        run_id = repo.get_or_start_run(conn, on, NOW)
        fetch_id = repo.start_fetch(conn, run_id, "greenhouse", target, NOW, board_id=board_id)
        repo.finish_fetch(
            conn,
            fetch_id,
            ok=item_count is not None,
            http_status=200,
            item_count=item_count,
            duration_ms=1,
        )


def test_the_streak_is_oldest_first_and_stops_at_the_last_day_with_jobs(
    jobs_db: sqlite3.Connection,
) -> None:
    board_id = add_board(jobs_db, "acme")
    for n, count in [(1, 0), (2, 5), (3, 0), (4, None), (5, 0)]:
        record_fetch(jobs_db, board_id, date(2026, 10, n), count)

    streak = repo.zero_job_streak(jobs_db, board_id, before=date(2026, 10, 6))

    assert streak == [date(2026, 10, 3), date(2026, 10, 5)]


def test_the_streak_leaves_out_the_given_date_and_later(jobs_db: sqlite3.Connection) -> None:
    board_id = add_board(jobs_db, "acme")
    for n in (1, 2, 3):
        record_fetch(jobs_db, board_id, date(2026, 10, n), 0)

    streak = repo.zero_job_streak(jobs_db, board_id, before=date(2026, 10, 2))

    assert streak == [date(2026, 10, 1)]


def test_the_streak_ignores_other_boards(jobs_db: sqlite3.Connection) -> None:
    board_id = add_board(jobs_db, "acme")
    other = add_board(jobs_db, "other")
    record_fetch(jobs_db, other, DAY1, 0, target="other")

    assert repo.zero_job_streak(jobs_db, board_id, before=DAY2) == []


# --- runs and fetches of boards -------------------------------------------------------


def test_find_run_looks_up_by_date(jobs_db: sqlite3.Connection) -> None:
    assert repo.find_run(jobs_db, DAY1) is None

    with jobs_db:
        run_id = repo.get_or_start_run(jobs_db, DAY1, NOW)

    assert repo.find_run(jobs_db, DAY1) == run_id
    assert repo.find_run(jobs_db, DAY2) is None


def test_a_second_start_on_the_same_date_continues_the_run(jobs_db: sqlite3.Connection) -> None:
    later = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)
    with jobs_db:
        run_id = repo.get_or_start_run(jobs_db, DAY1, NOW, git_sha="old")
        repo.finish_run(jobs_db, run_id, "partial", NOW)
        again = repo.get_or_start_run(jobs_db, DAY1, later, git_sha="new")

    row = jobs_db.execute("SELECT * FROM runs").fetchone()
    assert again == run_id
    assert row["status"] == "running"
    assert row["finished_at"] is None
    assert row["started_at"] == "2026-10-01T06:00:00+00:00"
    assert row["git_sha"] == "new"
    assert jobs_db.execute("SELECT count(*) FROM runs").fetchone()[0] == 1


def test_different_dates_get_different_runs(jobs_db: sqlite3.Connection) -> None:
    with jobs_db:
        first = repo.get_or_start_run(jobs_db, DAY1, NOW)
        second = repo.get_or_start_run(jobs_db, DAY2, NOW)

    assert first != second


def test_a_saved_response_is_marked_when_processed(jobs_db: sqlite3.Connection) -> None:
    board_id = add_board(jobs_db, "acme")
    with jobs_db:
        run_id = repo.get_or_start_run(jobs_db, DAY1, NOW)
        fetch_id = repo.start_fetch(jobs_db, run_id, "greenhouse", "acme", NOW, board_id=board_id)
        repo.finish_fetch(
            jobs_db, fetch_id, ok=False, http_status=200, item_count=None, duration_ms=5
        )
    [unprocessed] = repo.board_fetches(jobs_db, run_id)

    with jobs_db:
        repo.mark_fetch_processed(jobs_db, fetch_id, ok=True, item_count=3, processed_at=NOW)
    [processed] = repo.board_fetches(jobs_db, run_id)

    assert unprocessed == repo.BoardFetch(fetch_id, board_id, ok=False, processed_at=None)
    assert processed.ok
    assert processed.processed_at == "2026-10-01T06:00:00+00:00"
    row = jobs_db.execute("SELECT * FROM fetches").fetchone()
    assert (row["item_count"], row["http_status"], row["duration_ms"]) == (3, 200, 5)


def test_board_fetches_leave_out_other_runs_and_single_job_requests(
    jobs_db: sqlite3.Connection,
) -> None:
    board_id = add_board(jobs_db, "acme")
    with jobs_db:
        run_id = repo.get_or_start_run(jobs_db, DAY1, NOW)
        other_run = repo.get_or_start_run(jobs_db, DAY2, NOW)
        wanted = repo.start_fetch(jobs_db, run_id, "greenhouse", "acme", NOW, board_id=board_id)
        repo.start_fetch(jobs_db, run_id, "greenhouse", "detail:acme:1", NOW, board_id=board_id)
        repo.start_fetch(jobs_db, other_run, "greenhouse", "acme", NOW, board_id=board_id)

    assert [fetch.fetch_id for fetch in repo.board_fetches(jobs_db, run_id)] == [wanted]
