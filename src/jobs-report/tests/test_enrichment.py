"""Greenhouse pay lookups, as part of a collection."""

import json
import sqlite3
from typing import Any

import httpx
import pytest

from jobinsights import archive, pipeline
from jobinsights.sources import greenhouse, lever
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

RANGE = {"min_cents": 10000000, "max_cents": 15000000, "currency_type": "USD", "title": "US"}
NO_PAY = httpx.Response(200, json={"id": 1, "pay_input_ranges": []})
FOUND_RAW = '[{"currency_type":"USD","max_cents":15000000,"min_cents":10000000,"title":"US"}]'


def detail_url(job_id: int, slug: str = "acme") -> str:
    return f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs/{job_id}?pay_transparency=true"


def found(*ranges: dict[str, Any]) -> httpx.Response:
    return httpx.Response(200, json={"id": 1, "pay_input_ranges": list(ranges or [RANGE])})


def posting(world: World, native_id: str = "acme:1") -> sqlite3.Row:
    return world.jobs.execute("SELECT * FROM postings WHERE native_id = ?", (native_id,)).fetchone()


def versions(world: World, native_id: str = "acme:1") -> list[tuple[str, str | None]]:
    rows = world.jobs.execute(
        "SELECT v.observed_date, v.salary_raw FROM posting_versions v "
        "JOIN postings p USING (posting_id) WHERE p.native_id = ? ORDER BY v.observed_date",
        (native_id,),
    )
    return [(row[0], row[1]) for row in rows]


def pay_fetches(world: World) -> list[sqlite3.Row]:
    return world.jobs.execute(
        "SELECT * FROM fetches WHERE target LIKE 'detail:%' ORDER BY fetch_id"
    ).fetchall()


# --- what a lookup stores -----------------------------------------------------------------


def test_a_real_response_with_pay_is_stored(world: World) -> None:
    world.add_board("airbnb")
    job = gh_job(8231416)
    world.route(
        SOURCES["greenhouse"].endpoint.format(slug="airbnb"),
        httpx.Response(200, json={"jobs": [job], "meta": {"total": 1}}),
    )
    detail = json.loads((FIXTURES / "greenhouse/details/airbnb-8231416.json").read_text())
    world.route(detail_url(8231416, "airbnb"), httpx.Response(200, json=detail))

    result = world.collect(day(1), pay_cap=5)

    counts = result.sources["greenhouse"]
    assert (counts.pay_lookups, counts.pay_found, counts.pay_failed) == (1, 1, 0)
    row = posting(world, "airbnb:8231416")
    assert (row["salary_min"], row["salary_max"]) == (102000, 120000)
    assert row["salary_currency"] == "USD"
    assert row["salary_period"] is None  # Greenhouse doesn't say
    assert json.loads(row["salary_raw"]) == [
        {
            "currency_type": "USD",
            "max_cents": 12000000,
            "min_cents": 10200000,
            "title": "Pay Range",
        }
    ]


def test_a_real_response_without_pay_stores_nothing(world: World) -> None:
    world.add_board("stripe")
    world.route(
        SOURCES["greenhouse"].endpoint.format(slug="stripe"),
        httpx.Response(200, json={"jobs": [gh_job(8172510)], "meta": {"total": 1}}),
    )
    detail = json.loads((FIXTURES / "greenhouse/details/stripe-8172510.json").read_text())
    world.route(detail_url(8172510, "stripe"), httpx.Response(200, json=detail))

    result = world.collect(day(1), pay_cap=5)

    counts = result.sources["greenhouse"]
    assert (counts.pay_lookups, counts.pay_found, counts.pay_failed) == (1, 0, 0)
    assert posting(world, "stripe:8172510")["salary_raw"] is None
    assert pay_fetches(world)[0]["ok"] == 1


def test_a_lookup_is_recorded_and_archived_like_any_fetch(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1))
    world.route(detail_url(1), found())

    result = world.collect(day(1), pay_cap=5)

    [fetch] = pay_fetches(world)
    assert fetch["target"] == "detail:acme:1"
    assert fetch["board_id"] == world.board_ids["acme"]
    assert (fetch["ok"], fetch["http_status"], fetch["item_count"]) == (1, 200, 1)
    assert fetch["processed_at"] is not None
    archived = archive.read_fetch(world.archive, fetch["fetch_id"])
    assert archived is not None
    assert archived.ok
    assert archived.request_url == detail_url(1)
    [item] = archived.items
    assert (item.kind, item.native_id) == ("detail", "acme:1")
    assert item.body == {"id": 1, "pay_input_ranges": [RANGE]}
    world.assert_every_fetch_has_a_manifest()
    assert result.sources["greenhouse"].objects_stored == 2  # the job and its detail


def test_several_ranges_are_kept_as_text_only(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1))
    second = RANGE | {"currency_type": "CAD", "title": "Canada"}
    world.route(detail_url(1), found(RANGE, second))

    world.collect(day(1), pay_cap=5)

    row = posting(world)
    assert row["salary_min"] is None
    assert row["salary_currency"] is None
    assert [entry["currency_type"] for entry in json.loads(row["salary_raw"])] == ["USD", "CAD"]


# --- which postings, and how many --------------------------------------------------------------


def test_the_cap_limits_lookups_and_the_newest_go_first(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2, 3, 4, 5))
    newest = world.route(detail_url(5), found())
    next_newest = world.route(detail_url(4), found())

    result = world.collect(day(1), pay_cap=2)

    assert result.sources["greenhouse"].pay_lookups == 2
    assert newest.call_count == 1
    assert next_newest.call_count == 1


def test_todays_new_postings_come_before_the_backlog(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2), ok(1, 2, 3))
    world.collect(day(1))
    new_today = world.route(detail_url(3), found())

    world.collect(day(2), pay_cap=1)

    assert new_today.call_count == 1


def test_the_backlog_drains_over_several_days(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2, 3, 4, 5))
    routes = [world.route(detail_url(n), found()) for n in range(1, 6)]

    lookups = [
        world.collect(day(n), pay_cap=2).sources["greenhouse"].pay_lookups for n in range(1, 5)
    ]

    assert lookups == [2, 2, 1, 0]
    assert [route.call_count for route in routes] == [1, 1, 1, 1, 1]


def test_a_posting_with_no_pay_is_not_looked_up_again(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1))
    route = world.route(detail_url(1), NO_PAY)

    world.collect(day(1), pay_cap=5)
    second = world.collect(day(2), pay_cap=5)

    assert route.call_count == 1
    assert second.sources["greenhouse"].pay_lookups == 0


def test_a_closed_posting_is_not_looked_up(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2), ok(1), ok(1))
    world.collect(day(1))
    world.collect(day(2))
    still_open = world.route(detail_url(1), found())

    result = world.collect(day(3), pay_cap=5)

    assert result.sources["greenhouse"].pay_lookups == 1
    assert still_open.call_count == 1


def test_a_board_that_failed_today_still_gets_lookups_for_its_open_postings(
    world: World,
) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1), httpx.Response(404))
    world.collect(day(1))
    route = world.route(detail_url(1), found())

    world.collect(day(2), pay_cap=5)

    assert route.call_count == 1


def test_an_inactive_boards_postings_are_not_looked_up(world: World) -> None:
    board_id = world.add_board("acme")
    world.route(ACME_URL, ok(1))
    world.collect(day(1))
    with world.jobs:
        world.jobs.execute("UPDATE boards SET status = 'inactive' WHERE board_id = ?", (board_id,))

    result = world.collect(day(2), pay_cap=5)

    assert result.nothing_to_do


def test_collecting_only_another_source_makes_no_lookups(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1))
    world.collect(day(1))
    world.add_board("zoox", ats="lever")
    world.route(SOURCES["lever"].endpoint.format(slug="zoox"), httpx.Response(200, json=[]))
    world.adapters = {"lever": lever}

    result = world.collect(day(2), pay_cap=5)

    assert set(result.sources) == {"lever"}
    assert pay_fetches(world) == []


# --- the cap is per day, and running again repeats nothing -------------------------------------


def test_running_again_changes_nothing_after_lookups(world: World) -> None:
    world.add_board("acme")
    board = world.route(ACME_URL, ok(1, 2))
    one = world.route(detail_url(1), found())
    two = world.route(detail_url(2), NO_PAY)
    world.collect(day(1), pay_cap=5)
    before = world.snapshot(ALL_JOBS_TABLES, ALL_ARCHIVE_TABLES)

    second = world.collect(day(1), pay_cap=5)

    assert second.nothing_to_do
    assert (board.call_count, one.call_count, two.call_count) == (1, 1, 1)
    assert world.snapshot(ALL_JOBS_TABLES, ALL_ARCHIVE_TABLES) == before


def test_running_again_does_not_spend_more_of_the_backlog(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2, 3, 4, 5))
    world.route(detail_url(5), found())
    world.route(detail_url(4), found())
    world.collect(day(1), pay_cap=2)

    again = world.collect(day(1), pay_cap=2)
    forced = world.collect(day(1), pay_cap=2, force=True)

    assert again.nothing_to_do
    assert forced.sources["greenhouse"].pay_lookups == 0


def test_a_later_collection_only_uses_what_is_left_of_the_cap(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2))
    world.route(detail_url(1), found())
    world.route(detail_url(2), found())
    world.collect(day(1), pay_cap=3)
    world.add_board("other")
    world.route(OTHER_URL, ok(8, 9))
    last = world.route(detail_url(9, "other"), found())

    result = world.collect(day(1), pay_cap=3)

    assert result.sources["greenhouse"].pay_lookups == 1
    assert last.call_count == 1


def test_lowering_the_cap_during_the_day_stops_lookups(world: World) -> None:
    # Already over the new cap: this must not turn into an unlimited query.
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2, 3, 4, 5))
    world.route(detail_url(5), found())
    world.route(detail_url(4), found())
    world.collect(day(1), pay_cap=2)

    result = world.collect(day(1), pay_cap=1, force=True)

    assert result.sources["greenhouse"].pay_lookups == 0


def test_lookups_still_waiting_are_not_nothing_to_do(world: World) -> None:
    # Every board is done, but raising the cap leaves room for one more lookup.
    world.add_board("acme")
    board = world.route(ACME_URL, ok(1, 2))
    world.route(detail_url(2), found())
    world.collect(day(1), pay_cap=1)
    waiting = world.route(detail_url(1), found())

    result = world.collect(day(1), pay_cap=2)

    assert not result.nothing_to_do
    assert result.sources["greenhouse"].pay_lookups == 1
    assert result.sources["greenhouse"].boards_already_done == 1
    assert board.call_count == 1
    assert waiting.call_count == 1


# --- failures ------------------------------------------------------------------------------------


FAILURES: list[tuple[str, httpx.Response | Exception]] = [
    ("server error", httpx.Response(500)),
    ("not found", httpx.Response(404)),
    ("timeout", httpx.ReadTimeout("too slow")),
    ("not json", httpx.Response(200, content=b"<html>down</html>")),
    ("wrong shape", httpx.Response(200, json=["nope"])),
    ("no ranges field", httpx.Response(200, json={"id": 1})),
    ("ranges not a list", httpx.Response(200, json={"id": 1, "pay_input_ranges": "soon"})),
]


@pytest.mark.parametrize(("name", "failure"), FAILURES, ids=[name for name, _ in FAILURES])
def test_a_failed_lookup_is_counted_and_tried_again_the_next_day(
    world: World, name: str, failure: httpx.Response | Exception
) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1))
    route = world.route(detail_url(1), failure, found())

    first = world.collect(day(1), pay_cap=5)

    counts = first.sources["greenhouse"]
    assert (counts.pay_lookups, counts.pay_found, counts.pay_failed) == (1, 0, 1)
    assert posting(world)["salary_raw"] is None
    assert pay_fetches(world)[0]["ok"] == 0
    assert pay_fetches(world)[0]["error"]
    world.assert_every_fetch_has_a_manifest()

    # It's an extra: nothing else about the day is affected.
    assert first.status == "ok"
    assert first.failed_boards == []
    assert world.run_row(day(1))["status"] == "ok"
    assert world.board_row()["consecutive_failures"] == 0
    assert world.spans("acme:1") == [("2026-10-01", None, None)]

    # Not again today, even though it failed.
    assert world.collect(day(1), pay_cap=5).nothing_to_do
    assert route.call_count == 1

    second = world.collect(day(2), pay_cap=5)

    assert route.call_count == 2
    assert second.sources["greenhouse"].pay_found == 1
    assert posting(world)["salary_raw"] == FOUND_RAW


def test_a_failed_lookups_response_is_archived(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1))
    world.route(detail_url(1), httpx.Response(200, content=b"<html>down</html>"))

    world.collect(day(1), pay_cap=5)

    [fetch] = pay_fetches(world)
    archived = archive.read_fetch(world.archive, fetch["fetch_id"])
    assert archived is not None
    assert not archived.ok
    [item] = archived.items
    assert (item.kind, item.body) == ("response", "<html>down</html>")


def test_a_lookup_that_cannot_be_parsed_keeps_its_raw_response(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1))
    world.route(detail_url(1), httpx.Response(200, json={"id": 1}))

    world.collect(day(1), pay_cap=5)

    [fetch] = pay_fetches(world)
    assert fetch["ok"] == 0
    assert "KeyError" in fetch["error"]
    archived = archive.read_fetch(world.archive, fetch["fetch_id"])
    assert archived is not None
    assert archived.ok  # the response was fine and a fixed parser can replay it
    assert archived.items[0].body == {"id": 1}


def test_an_unexpected_error_in_one_lookup_does_not_stop_the_others(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1, 2))
    other = world.route(detail_url(2), found())
    real = greenhouse.detail_url

    def flaky(board: Any, job_id: str, source: Any) -> str:
        if job_id == "1":
            raise RuntimeError("a bug")
        return real(board, job_id, source)

    monkeypatch.setattr(pipeline.greenhouse, "detail_url", flaky)

    result = world.collect(day(1), pay_cap=5)

    assert result.status == "ok"
    counts = result.sources["greenhouse"]
    assert (counts.pay_lookups, counts.pay_found, counts.pay_failed) == (2, 1, 1)
    assert other.call_count == 1


class Crash(BaseException):
    """Stands in for the process dying: nothing in the pipeline catches it."""


def test_a_crash_after_a_lookup_leaves_the_raw_response_and_tries_again(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1))
    route = world.route(detail_url(1), found())

    def crash(*args: Any, **kwargs: Any) -> None:
        raise Crash

    with monkeypatch.context() as patch:
        patch.setattr(pipeline.repo, "set_posting_pay", crash)
        with pytest.raises(Crash):
            world.collect(day(1), pay_cap=5)

    [fetch] = pay_fetches(world)
    assert world.manifest(fetch["fetch_id"])["ok"] == 1
    assert posting(world)["salary_raw"] is None

    world.collect(day(2), pay_cap=5)

    assert route.call_count == 2
    assert posting(world)["salary_raw"] == FOUND_RAW


# --- pay surviving the next day's list ---------------------------------------------------------


def test_the_next_days_list_does_not_erase_pay(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1))
    world.route(detail_url(1), found())
    world.collect(day(1), pay_cap=5)

    result = world.collect(day(2), pay_cap=5)

    row = posting(world)
    assert (row["salary_min"], row["salary_max"]) == (100000, 150000)
    assert row["salary_currency"] == "USD"
    assert row["salary_raw"] == FOUND_RAW
    assert result.sources["greenhouse"].changed == 0


def test_pay_found_on_the_first_day_adds_no_extra_version(world: World) -> None:
    world.add_board("acme")
    world.route(ACME_URL, ok(1))
    world.route(detail_url(1), found())

    for n in (1, 2, 3):
        world.collect(day(n), pay_cap=5)

    assert versions(world) == [("2026-10-01", FOUND_RAW)]


def test_pay_found_later_is_logged_on_the_lookup_date(world: World) -> None:
    # A known quirk: this looks like pay changing that day, though we only learned it then.
    world.add_board("acme")
    world.route(ACME_URL, ok(1))
    world.collect(day(1))
    world.route(detail_url(1), found())

    world.collect(day(2), pay_cap=5)
    world.collect(day(3), pay_cap=5)

    assert versions(world) == [("2026-10-01", None), ("2026-10-02", FOUND_RAW)]


def test_other_changes_keep_the_pay_and_log_it_in_the_new_version(world: World) -> None:
    world.add_board("acme")
    retitled = {"jobs": [gh_job(1, "Staff Engineer")], "meta": {"total": 1}}
    world.route(ACME_URL, ok(1), httpx.Response(200, json=retitled))
    world.route(detail_url(1), found())
    world.collect(day(1), pay_cap=5)

    result = world.collect(day(2), pay_cap=5)

    assert result.sources["greenhouse"].changed == 1
    assert versions(world) == [("2026-10-01", FOUND_RAW), ("2026-10-02", FOUND_RAW)]
