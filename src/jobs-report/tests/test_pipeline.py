"""The whole collection loop over simulated days, with mocked HTTP and real databases."""

import json
import sqlite3
import zlib
from typing import Any

import httpx
import pytest

from jobinsights import archive, pipeline
from jobinsights.config import SeedBoard
from jobinsights.pipeline import sync_seeds
from jobinsights.role_filter import ROLE_FILTER_VERSION
from jobinsights.sources import ashby, greenhouse, lever
from jobinsights.store import repo
from pipeline_world import (
    ACME_URL,
    ALL_ARCHIVE_TABLES,
    ALL_JOBS_TABLES,
    FIXTURES,
    OTHER_URL,
    SOURCES,
    World,
    day,
    gh_job,
    ok,
)

# See tests/pipeline_world.py for the harness; the `world` fixture is in conftest.py.


# --- the happy path -------------------------------------------------------------------


def test_a_first_collection_stores_everything(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2))

    result = world.collect(day(1))

    assert result.status == "ok"
    counts = result.sources["greenhouse"]
    assert (counts.boards_ok, counts.items, counts.new, counts.opened) == (1, 2, 2, 2)
    assert counts.objects_stored == 2
    assert world.spans("acme:1") == [("2026-10-01", None, None)]

    posting = world.jobs.execute("SELECT * FROM postings WHERE native_id = 'acme:1'").fetchone()
    assert posting["board_id"] == world.board_ids["acme"]
    assert posting["company_id"] == world.board_row()["company_id"]
    assert posting["parser_version"] == greenhouse.PARSER_VERSION
    assert posting["first_seen_date"] == "2026-10-01"
    stored = world.archive.execute(
        "SELECT source, kind FROM raw_objects WHERE hash = ?", (posting["archive_hash"],)
    ).fetchone()
    assert tuple(stored) == ("greenhouse", "item")

    [fetch] = world.fetches()
    assert (fetch["ok"], fetch["http_status"], fetch["item_count"]) == (1, 200, 2)
    assert fetch["processed_at"] == "2026-10-01T06:00:00+00:00"
    assert fetch["error"] is None
    assert fetch["board_id"] == world.board_ids["acme"]
    manifest = world.manifest(fetch["fetch_id"])
    assert (manifest["ok"], manifest["http_status"]) == (1, 200)
    assert manifest["request_url"] == ACME_URL
    world.assert_every_fetch_has_a_manifest()

    board = world.board_row()
    assert board["first_tracked_date"] == "2026-10-01"
    assert board["last_ok_date"] == "2026-10-01"

    run = world.run_row(day(1))
    assert run["status"] == "ok"
    assert run["finished_at"] is not None
    summary = json.loads(run["summary_json"])
    assert summary["collections"][0]["sources"]["greenhouse"]["new"] == 2


@pytest.mark.parametrize(
    ("ats", "slug", "url", "adapter"),
    [
        ("greenhouse", "stripe", SOURCES["greenhouse"].endpoint, greenhouse),
        ("lever", "zoox", SOURCES["lever"].endpoint, lever),
        ("ashby", "ramp", SOURCES["ashby"].endpoint, ashby),
    ],
)
def test_real_fixtures_flow_through_for_each_ats(
    world: World, ats: str, slug: str, url: str, adapter: Any
) -> None:
    world.add_board(slug, ats=ats)
    body = json.loads((FIXTURES / ats / f"{slug}.json").read_text())
    world.route(url.format(slug=slug), httpx.Response(200, json=body))

    result = world.collect(day(1))

    counts = result.sources[ats]
    assert result.status == "ok"
    assert (counts.boards_ok, counts.items, counts.parse_errors) == (1, 3, 0)
    assert counts.new + counts.skipped == 3
    assert counts.opened == counts.new
    assert world.jobs.execute("SELECT count(*) FROM postings").fetchone()[0] == counts.new
    assert world.jobs.execute("SELECT count(*) FROM posting_spans").fetchone()[0] == counts.new
    # Everything is archived, whichever jobs were stored.
    assert world.archive.execute("SELECT count(*) FROM raw_objects").fetchone()[0] == 3
    world.assert_every_fetch_has_a_manifest()


def test_no_active_boards_is_nothing_to_do(world: World) -> None:
    result = world.collect(day(1))

    assert result.nothing_to_do
    assert result.status == "ok"
    assert world.jobs.execute("SELECT count(*) FROM runs").fetchone()[0] == 0


def test_a_sources_volatile_fields_are_left_out_of_the_archive_hash(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = SOURCES["greenhouse"].model_copy(update={"hash_exclude": ["updated_at"]})
    monkeypatch.setitem(SOURCES, "greenhouse", source)
    world.add_board("acme")
    first = gh_job(1)
    later = gh_job(1) | {"updated_at": "2026-09-03T10:00:00-04:00"}
    world.route(
        ACME_URL,
        httpx.Response(200, json={"jobs": [first], "meta": {"total": 1}}),
        httpx.Response(200, json={"jobs": [later], "meta": {"total": 1}}),
    )

    world.collect(day(1))
    world.collect(day(2))

    assert world.archive.execute("SELECT count(*) FROM raw_objects").fetchone()[0] == 1


def test_only_the_selected_sources_are_collected(world: World) -> None:
    world.add_board("acme")
    world.add_board("zoox", ats="lever")
    world.adapters = {"lever": lever}
    route = world.route(SOURCES["lever"].endpoint.format(slug="zoox"), httpx.Response(200, json=[]))

    result = world.collect(day(1))

    assert route.call_count == 1
    assert set(result.sources) == {"lever"}
    assert world.fetches("acme") == []


# --- only software engineering is stored --------------------------------------------------


def mixed_response(*jobs: tuple[int, str]) -> httpx.Response:
    bodies = [gh_job(job_id, title) for job_id, title in jobs]
    return httpx.Response(200, json={"jobs": bodies, "meta": {"total": len(bodies)}})


def test_only_software_engineering_jobs_are_stored_but_all_are_archived(world: World) -> None:
    world.add_board("acme")
    world.route(
        ACME_URL,
        mixed_response((1, "Software Engineer"), (2, "Account Executive"), (3, "Sales Engineer")),
    )

    result = world.collect(day(1))

    counts = result.sources["greenhouse"]
    assert result.status == "ok"
    assert (counts.items, counts.new, counts.skipped, counts.opened) == (3, 1, 2, 1)
    stored = [row[0] for row in world.jobs.execute("SELECT native_id FROM postings")]
    assert stored == ["acme:1"]
    assert world.jobs.execute("SELECT count(*) FROM descriptions").fetchone()[0] == 1
    [fetch] = world.fetches()
    assert fetch["item_count"] == 3  # the whole response
    archived = archive.read_fetch(world.archive, fetch["fetch_id"])
    assert archived is not None
    assert [item.native_id for item in archived.items] == ["acme:1", "acme:2", "acme:3"]


def test_the_filter_version_is_recorded_with_each_collection(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1))

    world.collect(day(1))

    summary = json.loads(world.run_row(day(1))["summary_json"])
    assert summary["collections"][0]["role_filter_version"] == ROLE_FILTER_VERSION


def test_a_job_retitled_out_of_scope_stays_tracked_and_does_not_close(world: World) -> None:
    world.add_board("acme")
    world.route(
        ACME_URL,
        mixed_response((1, "Software Engineer")),
        mixed_response((1, "Account Executive")),
        mixed_response((1, "Account Executive")),
    )
    world.collect(day(1))

    second = world.collect(day(2))
    third = world.collect(day(3))

    assert second.sources["greenhouse"].changed == 1
    assert second.sources["greenhouse"].pending == 0
    assert third.sources["greenhouse"].closed == 0
    assert world.spans("acme:1") == [("2026-10-01", None, None)]
    row = world.jobs.execute("SELECT title, last_seen_date FROM postings").fetchone()
    assert tuple(row) == ("Account Executive", "2026-10-03")
    titles = world.jobs.execute(
        "SELECT title FROM posting_versions ORDER BY observed_date"
    ).fetchall()
    assert [t[0] for t in titles] == ["Software Engineer", "Account Executive"]


def test_a_job_retitled_into_scope_is_stored_from_that_day(world: World) -> None:
    world.add_board("acme")
    world.route(
        ACME_URL,
        mixed_response((1, "Account Executive")),
        mixed_response((1, "Software Engineer")),
    )
    first = world.collect(day(1))

    second = world.collect(day(2))

    assert (first.sources["greenhouse"].new, first.sources["greenhouse"].skipped) == (0, 1)
    assert second.sources["greenhouse"].new == 1
    assert world.spans("acme:1") == [("2026-10-02", None, None)]
    row = world.jobs.execute("SELECT first_seen_date, posted_at FROM postings").fetchone()
    assert row["first_seen_date"] == "2026-10-02"
    assert row["posted_at"] == "2026-09-01T14:00:00+00:00"  # the job's real age is still there


def test_a_closed_job_retitled_out_of_scope_can_still_repost(world: World) -> None:
    world.add_board("acme")
    world.route(
        ACME_URL,
        mixed_response((1, "Software Engineer"), (2, "Software Engineer")),
        mixed_response((2, "Software Engineer")),
        mixed_response((2, "Software Engineer")),
        mixed_response((1, "Account Executive"), (2, "Software Engineer")),
    )
    for n in (1, 2, 3):
        world.collect(day(n))

    result = world.collect(day(9))

    assert result.sources["greenhouse"].reopened == 1
    assert world.spans("acme:1") == [
        ("2026-10-01", "2026-10-02", None),
        ("2026-10-09", None, None),
    ]


def test_the_same_job_id_on_another_board_is_filtered_on_its_own(world: World) -> None:
    world.add_board("acme")
    world.add_board("other")
    world.route(ACME_URL, mixed_response((1, "Software Engineer")))
    world.route(OTHER_URL, mixed_response((1, "Account Executive")))

    world.collect(day(1))

    stored = [row[0] for row in world.jobs.execute("SELECT native_id FROM postings")]
    assert stored == ["acme:1"]


def test_out_of_scope_jobs_never_get_spans_or_absences(world: World) -> None:
    world.add_board("acme")
    world.route(
        ACME_URL,
        mixed_response((1, "Software Engineer"), (2, "Account Executive")),
        mixed_response((1, "Software Engineer")),
        mixed_response((1, "Software Engineer")),
    )

    results = [world.collect(day(n)) for n in (1, 2, 3)]

    assert [r.sources["greenhouse"].pending for r in results] == [0, 0, 0]
    assert world.jobs.execute("SELECT count(*) FROM posting_spans").fetchone()[0] == 1


def test_a_response_with_only_out_of_scope_jobs_closes_normally(world: World) -> None:
    world.add_board("acme")
    gone = mixed_response((100, "Account Executive"))
    world.route(ACME_URL, ok(*range(1, 11)), gone, gone)
    world.collect(day(1))

    second = world.collect(day(2))
    third = world.collect(day(3))

    assert second.sources["greenhouse"].held == 0
    assert second.sources["greenhouse"].pending == 10
    assert third.sources["greenhouse"].closed == 10
    assert world.spans("acme:1") == [("2026-10-01", "2026-10-02", None)]


@pytest.mark.parametrize(("open_jobs", "held"), [(9, 1), (8, 0)])
def test_an_empty_response_is_held_above_the_threshold(
    world: World, open_jobs: int, held: int
) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(*range(1, open_jobs + 1)), ok())
    world.collect(day(1))

    result = world.collect(day(2))

    assert result.sources["greenhouse"].held == held


def test_the_hold_threshold_counts_only_stored_jobs(world: World) -> None:
    # 100 jobs on the board, but only 5 stored, so an empty response isn't held.
    world.add_board("acme")
    engineers = [(n, "Software Engineer") for n in range(1, 6)]
    others = [(n, "Account Executive") for n in range(6, 101)]
    world.route(ACME_URL, mixed_response(*engineers, *others), ok())
    world.collect(day(1))

    result = world.collect(day(2))

    assert result.sources["greenhouse"].held == 0
    assert result.sources["greenhouse"].pending == 5


def test_a_parse_error_still_holds_closures_with_the_filter_on(world: World) -> None:
    world.add_board("acme")
    bad = httpx.Response(
        200,
        json={"jobs": [gh_job(1), {"id": 666}, gh_job(3, "Sales Engineer")], "meta": {"total": 3}},
    )
    world.route(ACME_URL, ok(1, 2), bad)
    world.collect(day(1))

    result = world.collect(day(2))

    counts = result.sources["greenhouse"]
    assert (counts.parse_errors, counts.skipped, counts.pending) == (1, 1, 0)
    assert world.spans("acme:2") == [("2026-10-01", None, None)]


def test_running_again_with_out_of_scope_jobs_changes_nothing(world: World) -> None:
    world.add_board("acme")
    route = world.route(
        ACME_URL, mixed_response((1, "Software Engineer"), (2, "Account Executive"))
    )
    world.collect(day(1))
    before = world.snapshot(ALL_JOBS_TABLES, ALL_ARCHIVE_TABLES)

    second = world.collect(day(1))

    assert second.nothing_to_do
    assert route.call_count == 1
    assert world.snapshot(ALL_JOBS_TABLES, ALL_ARCHIVE_TABLES) == before


# --- running twice on the same day --------------------------------------------------------


def test_running_twice_changes_nothing_and_calls_nothing(world: World) -> None:
    world.add_board("acme")
    route = world.route(ACME_URL, ok(1, 2))
    first = world.collect(day(1))
    before = world.snapshot(ALL_JOBS_TABLES, ALL_ARCHIVE_TABLES)

    second = world.collect(day(1))

    assert first.status == "ok"
    assert second.nothing_to_do
    assert second.status == "ok"
    assert second.sources["greenhouse"].boards_already_done == 1
    assert route.call_count == 1
    assert world.snapshot(ALL_JOBS_TABLES, ALL_ARCHIVE_TABLES) == before


def test_force_fetches_again_in_the_same_run_without_changing_jobs(world: World) -> None:
    world.add_board("acme")
    route = world.route(ACME_URL, ok(1, 2))
    world.collect(day(1))
    job_tables = ("descriptions", "postings", "posting_spans", "posting_versions")
    before = world.snapshot(job_tables, ("raw_objects",))

    result = world.collect(day(1), force=True)

    assert route.call_count == 2
    assert result.status == "ok"
    assert result.sources["greenhouse"].objects_stored == 0
    assert world.snapshot(job_tables, ("raw_objects",)) == before
    assert world.jobs.execute("SELECT count(*) FROM runs").fetchone()[0] == 1
    assert len(world.fetches()) == 2
    world.assert_every_fetch_has_a_manifest()


def test_a_forced_rerun_never_confirms_a_closure(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2), ok(1), ok(1))
    world.collect(day(1))
    world.collect(day(2))

    world.collect(day(2), force=True)

    assert world.spans("acme:2") == [("2026-10-01", None, "2026-10-02")]


def test_a_board_added_later_in_the_day_is_collected(world: World) -> None:
    world.add_board("acme")
    acme = world.route(ACME_URL, ok(1))
    world.collect(day(1))
    world.add_board("other")
    other = world.route(OTHER_URL, ok(9))

    result = world.collect(day(1))

    assert acme.call_count == 1
    assert other.call_count == 1
    counts = result.sources["greenhouse"]
    assert (counts.boards_ok, counts.boards_already_done) == (1, 1)
    assert world.jobs.execute("SELECT count(*) FROM runs").fetchone()[0] == 1


def test_collections_in_a_day_all_stay_in_the_run_summary(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1))
    world.collect(day(1))
    world.add_board("other")
    world.route(OTHER_URL, ok(9))

    world.collect(day(1))

    summary = json.loads(world.run_row(day(1))["summary_json"])
    assert [c["sources"]["greenhouse"]["new"] for c in summary["collections"]] == [1, 1]


# --- failed fetches -----------------------------------------------------------------------


FAILURES: list[tuple[str, httpx.Response | Exception]] = [
    ("server error", httpx.Response(500, content=b"oops")),
    ("rate limited", httpx.Response(429, content=b"slow down")),
    ("timeout", httpx.ReadTimeout("too slow")),
    ("not json", httpx.Response(200, content=b"<html>maintenance</html>")),
    ("wrong shape", httpx.Response(200, json={"error": "nope"})),
    ("partial list", httpx.Response(200, json={"jobs": [gh_job(1)], "meta": {"total": 2}})),
]


@pytest.mark.parametrize(("name", "failure"), FAILURES, ids=[name for name, _ in FAILURES])
def test_a_failed_fetch_causes_no_closures(
    world: World, name: str, failure: httpx.Response | Exception
) -> None:
    world.add_board("acme")
    route = world.route(ACME_URL, ok(1, 2))
    world.collect(day(1))
    if isinstance(failure, Exception):
        route.mock(side_effect=failure)
    else:
        route.mock(return_value=failure)
    job_tables = ("descriptions", "postings", "posting_spans", "posting_versions")
    before = world.snapshot(job_tables, ())

    for later in (day(2), day(3), day(4)):
        result = world.collect(later, retries=0)
        assert result.status == "failed"

    assert world.snapshot(job_tables, ()) == before
    assert world.spans("acme:1") == [("2026-10-01", None, None)]
    assert world.board_row()["last_ok_date"] == "2026-10-01"
    assert world.board_row()["consecutive_failures"] == 3
    failed = world.fetches()[-1]
    assert failed["ok"] == 0
    assert failed["item_count"] is None
    assert failed["processed_at"] is None
    assert failed["error"]
    assert world.manifest(failed["fetch_id"])["ok"] == 0
    world.assert_every_fetch_has_a_manifest()


def test_failure_details_are_archived(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, httpx.Response(500, content=b"oops"))

    world.collect(day(1), retries=0)

    [fetch] = world.fetches()
    assert fetch["http_status"] == 500
    assert fetch["error"] == "HTTP 500"
    manifest = world.manifest(fetch["fetch_id"])
    assert zlib.decompress(manifest["error_body_zlib"]) == b"oops"


def test_a_network_error_is_archived_as_text(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, httpx.ReadTimeout("too slow"))

    world.collect(day(1), retries=0)

    [fetch] = world.fetches()
    assert fetch["http_status"] is None
    assert fetch["error"] == "ReadTimeout: too slow"
    manifest = world.manifest(fetch["fetch_id"])
    assert zlib.decompress(manifest["error_body_zlib"]) == b"ReadTimeout: too slow"


@pytest.mark.parametrize(
    ("response", "expected_body"),
    [
        (httpx.Response(200, content=b"<html>down</html>"), "<html>down</html>"),
        (httpx.Response(200, json={"error": "nope"}), {"error": "nope"}),
        (
            httpx.Response(200, json={"jobs": [gh_job(1)], "meta": {"total": 2}}),
            {"jobs": [gh_job(1)], "meta": {"total": 2}},
        ),
    ],
    ids=["not json", "wrong shape", "partial list"],
)
def test_a_malformed_response_is_kept_whole(
    world: World, response: httpx.Response, expected_body: Any
) -> None:
    world.add_board("acme")
    world.route(ACME_URL, response)

    world.collect(day(1), retries=0)

    [fetch] = world.fetches()
    assert "ResponseShapeError" in fetch["error"]
    archived = archive.read_fetch(world.archive, fetch["fetch_id"])
    assert archived is not None
    assert not archived.ok
    [item] = archived.items
    assert (item.kind, item.native_id, item.body) == ("response", None, expected_body)


def test_one_board_failing_does_not_stop_the_others(world: World) -> None:
    world.add_board("acme")
    world.add_board("other")
    world.route(ACME_URL, httpx.Response(404))
    world.route(OTHER_URL, ok(9))

    result = world.collect(day(1))

    assert result.status == "partial"
    assert result.failed_boards == ["greenhouse/acme"]
    counts = result.sources["greenhouse"]
    assert (counts.boards_ok, counts.boards_failed) == (1, 1)
    assert world.spans("other:9") == [("2026-10-01", None, None)]
    assert world.run_row(day(1))["status"] == "partial"
    world.assert_every_fetch_has_a_manifest()


def test_an_unexpected_error_in_one_board_is_recorded_and_the_rest_continue(
    world: World,
) -> None:
    world.add_board("acme")
    world.add_board("eu-board", region="eu")  # Greenhouse has no verified EU host, so this raises
    world.route(ACME_URL, ok(1))

    result = world.collect(day(1))

    assert result.status == "partial"
    assert result.failed_boards == ["greenhouse/eu-board"]
    [fetch] = world.fetches("eu-board")
    assert "region" in fetch["error"]
    assert world.manifest(fetch["fetch_id"])["ok"] == 0
    assert world.spans("acme:1") == [("2026-10-01", None, None)]
    world.assert_every_fetch_has_a_manifest()
    assert world.sleeps == []  # not retried: it would fail the same way


# --- retries ---------------------------------------------------------------------------------


def test_a_failed_board_is_retried_then_processed_with_the_rest(world: World) -> None:
    world.add_board("acme")
    world.add_board("other")
    acme = world.route(ACME_URL, httpx.Response(500), httpx.Response(503), ok(1, 2))
    other = world.route(OTHER_URL, ok(9))

    result = world.collect(day(1))

    assert result.status == "ok"
    assert acme.call_count == 3
    assert other.call_count == 1  # a good response is kept, not fetched again
    assert result.failed_boards == []
    counts = result.sources["greenhouse"]
    assert (counts.boards_ok, counts.boards_failed, counts.retries, counts.new) == (2, 0, 2, 3)
    assert world.board_row()["consecutive_failures"] == 0
    assert [row["ok"] for row in world.fetches()] == [0, 0, 1]
    world.assert_every_fetch_has_a_manifest()


@pytest.mark.parametrize(
    "malformed",
    [
        httpx.Response(200, content=b"<html>down</html>"),
        httpx.Response(200, json={"jobs": [gh_job(1)], "meta": {"total": 2}}),
    ],
    ids=["not json", "partial list"],
)
def test_a_malformed_response_is_retried(world: World, malformed: httpx.Response) -> None:
    world.add_board("acme")
    route = world.route(ACME_URL, malformed, ok(1))

    result = world.collect(day(1))

    assert result.status == "ok"
    assert route.call_count == 2
    assert world.spans("acme:1") == [("2026-10-01", None, None)]


def test_retries_wait_longer_each_round(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, httpx.Response(500))

    world.collect(day(1))

    assert len(world.sleeps) == 3
    for wait, base in zip(world.sleeps, [30, 60, 120], strict=True):
        assert base <= wait <= base * 1.25


def test_closures_are_the_same_as_a_clean_run_after_retries(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2), httpx.Response(500), ok(1), ok(1))
    world.collect(day(1))

    world.collect(day(2))  # fails once, then the retry returns job 1 only
    world.collect(day(3))

    assert world.spans("acme:1") == [("2026-10-01", None, None)]
    assert world.spans("acme:2") == [("2026-10-01", "2026-10-02", None)]


def test_after_the_retries_failures_are_logged_and_the_rest_processed(
    world: World, caplog: pytest.LogCaptureFixture
) -> None:
    world.add_board("acme")
    world.add_board("other")
    acme = world.route(ACME_URL, httpx.Response(500))
    world.route(OTHER_URL, ok(9))

    result = world.collect(day(1))

    assert acme.call_count == 4  # the first try plus 3 retries
    assert result.status == "partial"
    assert result.failed_boards == ["greenhouse/acme"]
    assert world.spans("other:9") == [("2026-10-01", None, None)]
    assert len(world.fetches("acme")) == 4
    world.assert_every_fetch_has_a_manifest()
    assert any(
        record.message == "board still failing after retries" and record.board == "acme"
        for record in caplog.records
    )


def test_a_failing_board_counts_once_per_day_however_many_attempts(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, httpx.Response(500))

    world.collect(day(1))
    world.collect(day(1))  # a later collection the same day, still failing
    assert world.board_row()["consecutive_failures"] == 1

    world.collect(day(2))
    assert world.board_row()["consecutive_failures"] == 2


@pytest.mark.parametrize("status", [400, 401, 403, 404, 410])
def test_a_client_error_is_not_retried(world: World, status: int) -> None:
    world.add_board("acme")
    route = world.route(ACME_URL, httpx.Response(status))

    world.collect(day(1))

    assert route.call_count == 1
    assert world.sleeps == []


def test_a_later_collection_picks_up_only_what_failed(world: World) -> None:
    world.add_board("acme")
    world.add_board("other")
    acme = world.route(ACME_URL, httpx.Response(404), ok(1))
    other = world.route(OTHER_URL, ok(9))

    first = world.collect(day(1))
    second = world.collect(day(1))

    assert first.status == "partial"
    assert second.status == "ok"
    assert acme.call_count == 2
    assert other.call_count == 1
    assert second.sources["greenhouse"].boards_already_done == 1
    assert world.run_row(day(1))["status"] == "ok"
    assert world.jobs.execute("SELECT count(*) FROM runs").fetchone()[0] == 1
    assert world.spans("acme:1") == [("2026-10-01", None, None)]
    assert world.board_row()["consecutive_failures"] == 0
    world.assert_every_fetch_has_a_manifest()


def test_a_later_collection_of_one_source_keeps_the_days_status(world: World) -> None:
    world.add_board("acme")
    world.add_board("zoox", ats="lever")
    world.route(ACME_URL, httpx.Response(404))
    world.route(SOURCES["lever"].endpoint.format(slug="zoox"), httpx.Response(200, json=[]))
    world.adapters = {"greenhouse": greenhouse}
    assert world.collect(day(1)).status == "failed"

    world.adapters = {"lever": lever}
    result = world.collect(day(1))

    assert result.status == "partial"  # Greenhouse's board is still failing today


# --- closures across days ------------------------------------------------------------------


def test_a_job_missing_from_two_successful_fetches_closes(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2), ok(1), ok(1))
    world.collect(day(1))

    second = world.collect(day(2))
    assert second.sources["greenhouse"].pending == 1
    assert world.spans("acme:2") == [("2026-10-01", None, "2026-10-02")]

    third = world.collect(day(3))
    assert third.sources["greenhouse"].closed == 1
    assert world.spans("acme:2") == [("2026-10-01", "2026-10-02", None)]
    assert world.spans("acme:1") == [("2026-10-01", None, None)]


def test_a_failed_day_in_between_does_not_confirm_or_clear_an_absence(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2), ok(1), httpx.Response(404), ok(1))
    world.collect(day(1))
    world.collect(day(2))

    world.collect(day(3))
    assert world.spans("acme:2") == [("2026-10-01", None, "2026-10-02")]

    world.collect(day(4))
    assert world.spans("acme:2") == [("2026-10-01", "2026-10-02", None)]


def test_a_job_that_returns_gets_a_new_span(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2), ok(1), ok(1), ok(1, 2))
    world.collect(day(1))
    world.collect(day(2))
    world.collect(day(3))

    result = world.collect(day(9))

    assert result.sources["greenhouse"].reopened == 1
    assert world.spans("acme:2") == [
        ("2026-10-01", "2026-10-02", None),
        ("2026-10-09", None, None),
    ]


def test_a_changed_job_logs_a_new_version(world: World) -> None:
    world.add_board("acme")
    changed = {"jobs": [gh_job(1, "Staff Engineer")], "meta": {"total": 1}}
    world.route(ACME_URL, ok(1), httpx.Response(200, json=changed))
    world.collect(day(1))

    result = world.collect(day(2))

    assert result.sources["greenhouse"].changed == 1
    titles = world.jobs.execute(
        "SELECT title FROM posting_versions ORDER BY observed_date"
    ).fetchall()
    assert [row[0] for row in titles] == ["Backend Engineer", "Staff Engineer"]


def test_a_big_drop_to_zero_is_held_then_believed(world: World) -> None:
    world.add_board("acme")
    ids = range(1, 27)
    world.route(ACME_URL, ok(*ids), ok(), ok(), ok())
    world.collect(day(1))

    first = world.collect(day(5))
    second = world.collect(day(6))
    assert first.sources["greenhouse"].held == 1
    assert second.sources["greenhouse"].held == 1
    assert first.status == "ok"  # the fetch worked, so nothing failed
    assert "held" in world.fetches()[-1]["error"]
    assert world.fetches()[-1]["ok"] == 1
    assert world.spans("acme:1") == [("2026-10-01", None, None)]

    third = world.collect(day(7))
    assert third.sources["greenhouse"].released == 1
    assert third.sources["greenhouse"].closed == 26
    assert "released" in world.fetches()[-1]["error"]
    assert world.spans("acme:1") == [("2026-10-01", "2026-10-05", None)]


def test_a_small_board_dropping_to_zero_closes_normally(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2), ok(), ok())
    world.collect(day(1))

    assert world.collect(day(2)).sources["greenhouse"].held == 0
    world.collect(day(3))

    assert world.spans("acme:1") == [("2026-10-01", "2026-10-02", None)]


# --- a job that won't parse -----------------------------------------------------------------


def poisoned() -> httpx.Response:
    jobs = [gh_job(1), {"id": 666, "content": "no title"}, gh_job(3)]
    return httpx.Response(200, json={"jobs": jobs, "meta": {"total": 3}})


def test_a_parser_raising_on_one_item_leaves_the_archive_complete(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, poisoned())

    world.collect(day(1))

    [fetch] = world.fetches()
    archived = archive.read_fetch(world.archive, fetch["fetch_id"])
    assert archived is not None
    assert archived.ok  # the response itself was complete, so a fixed parser can replay it
    assert [item.native_id for item in archived.items] == ["acme:1", "acme:666", "acme:3"]
    assert archived.items[1].body == {"id": 666, "content": "no title"}
    assert world.archive.execute("SELECT count(*) FROM raw_objects").fetchone()[0] == 3
    world.assert_every_fetch_has_a_manifest()


def test_a_parser_raising_keeps_the_good_jobs_and_holds_closures(
    world: World, caplog: pytest.LogCaptureFixture
) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2, 3), poisoned(), poisoned())
    world.collect(day(1))

    result = world.collect(day(2))
    world.collect(day(3))

    assert result.status == "partial"
    assert result.failed_boards == []
    counts = result.sources["greenhouse"]
    assert (counts.boards_ok, counts.parse_errors, counts.pending) == (1, 1, 0)
    [_, fetch, _] = world.fetches()
    assert (fetch["ok"], fetch["item_count"]) == (0, 3)
    assert fetch["error"] == "parse errors: 1 of 3"
    assert fetch["processed_at"] is not None
    # Job 2 is really gone, but it might have been the bad one, so it's not even pending.
    assert world.spans("acme:2") == [("2026-10-01", None, None)]
    assert world.spans("acme:1") == [("2026-10-01", None, None)]
    last_seen = world.jobs.execute(
        "SELECT last_seen_date FROM postings WHERE native_id = 'acme:3'"
    ).fetchone()
    assert last_seen[0] == "2026-10-03"
    # The board did answer, so it isn't counted as failing.
    assert world.board_row()["consecutive_failures"] == 0
    assert world.board_row()["last_ok_date"] == "2026-10-03"
    assert any(
        record.message == "job failed to parse" and record.native_id == "acme:666"
        for record in caplog.records
    )


def test_a_parse_error_is_not_retried_or_refetched_the_same_day(world: World) -> None:
    world.add_board("acme")
    route = world.route(ACME_URL, poisoned())

    world.collect(day(1))
    second = world.collect(day(1))

    assert route.call_count == 1
    assert world.sleeps == []
    assert second.nothing_to_do
    assert second.status == "partial"


def test_a_response_with_only_bad_jobs_is_not_a_suspicious_drop(world: World) -> None:
    world.add_board("acme")
    bad = {"jobs": [{"id": 666}], "meta": {"total": 1}}
    world.route(ACME_URL, ok(*range(1, 27)), httpx.Response(200, json=bad))
    world.collect(day(1))

    result = world.collect(day(2))

    assert result.sources["greenhouse"].held == 0
    assert world.spans("acme:1") == [("2026-10-01", None, None)]


def test_bad_jobs_reset_the_zero_job_count(world: World) -> None:
    # A response with jobs we couldn't parse still had jobs.
    world.add_board("acme")
    bad = {"jobs": [{"id": 666}], "meta": {"total": 1}}
    world.route(ACME_URL, ok(*range(1, 27)), ok(), httpx.Response(200, json=bad), ok(), ok(), ok())
    world.collect(day(1))
    world.collect(day(2))  # 0 jobs
    world.collect(day(3))  # 1 job, unparseable

    assert world.collect(day(4)).sources["greenhouse"].held == 1
    assert world.collect(day(5)).sources["greenhouse"].held == 1
    assert world.collect(day(6)).sources["greenhouse"].released == 1
    assert world.spans("acme:1") == [("2026-10-01", "2026-10-04", None)]


# --- crashes ---------------------------------------------------------------------------------


class Crash(BaseException):
    """Stands in for the process dying: nothing in the pipeline catches it."""


def test_a_crash_while_processing_leaves_the_raw_data_and_the_next_run_uses_it(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    world.add_board("acme")
    route = world.route(ACME_URL, ok(1, 2))

    def crash(*args: Any, **kwargs: Any) -> None:
        raise Crash

    with monkeypatch.context() as patch:
        patch.setattr(pipeline.repo, "upsert_posting", crash)
        with pytest.raises(Crash):
            world.collect(day(1))

    assert world.archive.execute("SELECT count(*) FROM raw_objects").fetchone()[0] == 2
    assert world.jobs.execute("SELECT count(*) FROM postings").fetchone()[0] == 0
    assert world.run_row(day(1))["status"] == "failed"
    world.assert_every_fetch_has_a_manifest()

    result = world.collect(day(1))

    assert route.call_count == 1  # processed from the archive, not fetched again
    assert result.status == "ok"
    assert not result.nothing_to_do
    assert result.sources["greenhouse"].new == 2
    assert world.spans("acme:1") == [("2026-10-01", None, None)]
    assert world.run_row(day(1))["status"] == "ok"


def test_a_transaction_for_one_board_rolls_back_as_a_whole(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    world.add_board("acme")
    world.add_board("other")
    world.route(ACME_URL, ok(1, 2))
    world.route(OTHER_URL, ok(9))
    real = repo.upsert_posting

    def flaky(conn: sqlite3.Connection, record: Any, **kwargs: Any) -> Any:
        if record.native_id == "acme:2":
            raise sqlite3.OperationalError("database is broken")
        return real(conn, record, **kwargs)

    monkeypatch.setattr(pipeline.repo, "upsert_posting", flaky)

    result = world.collect(day(1))

    assert result.status == "partial"
    counts = result.sources["greenhouse"]
    assert (counts.boards_ok, counts.boards_failed) == (1, 1)
    # acme:1 was upserted before the failure, and rolled back with the rest of the board.
    assert (
        world.jobs.execute(
            "SELECT count(*) FROM postings WHERE native_id LIKE 'acme:%'"
        ).fetchone()[0]
        == 0
    )
    assert world.spans("other:9") == [("2026-10-01", None, None)]
    [fetch] = world.fetches()
    assert fetch["ok"] == 0
    assert "database is broken" in fetch["error"]
    assert fetch["processed_at"] is not None
    assert world.board_row()["last_ok_date"] is None


def test_nothing_is_parsed_until_fetching_ends(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    world.add_board("acme")
    world.add_board("other")
    world.route(ACME_URL, httpx.Response(500), ok(1))
    world.route(OTHER_URL, ok(9))
    requests_at_first_upsert: list[int] = []
    real = repo.upsert_posting

    def spy(conn: sqlite3.Connection, record: Any, **kwargs: Any) -> Any:
        if not requests_at_first_upsert:
            requests_at_first_upsert.append(world.router.calls.call_count)
        return real(conn, record, **kwargs)

    monkeypatch.setattr(pipeline.repo, "upsert_posting", spy)

    world.collect(day(1))

    assert requests_at_first_upsert == [3]  # both boards, plus acme's retry


# --- seeds ---------------------------------------------------------------------------------


def test_sync_seeds_adds_active_boards_once(world: World) -> None:
    seeds = [
        SeedBoard(ats="greenhouse", slug="acme", name="Acme, Inc."),
        SeedBoard(ats="lever", slug="acme", name="Acme"),
    ]

    sync_seeds(world.jobs, seeds, day(1))
    before = world.snapshot(("companies", "boards"), ())
    sync_seeds(world.jobs, seeds, day(2))

    assert world.snapshot(("companies", "boards"), ()) == before
    boards = repo.active_boards(world.jobs)
    assert [(b.ref.ats, b.ref.slug) for b in boards] == [("greenhouse", "acme"), ("lever", "acme")]
    assert boards[0].company_id == boards[1].company_id
    row = world.jobs.execute("SELECT discovered_via, discovered_date FROM boards").fetchone()
    assert tuple(row) == ("seed", "2026-10-01")


def test_sync_seeds_does_not_reactivate_a_board(world: World) -> None:
    board_id = world.add_board("acme")
    with world.jobs:
        world.jobs.execute("UPDATE boards SET status = 'inactive' WHERE board_id = ?", (board_id,))

    sync_seeds(world.jobs, [SeedBoard(ats="greenhouse", slug="acme", name="Acme")], day(2))

    assert repo.active_boards(world.jobs) == []
