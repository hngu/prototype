import copy
import json
import sqlite3
from datetime import date
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from jobinsights import archive
from jobinsights.config import load_sources
from jobinsights.descriptions import html_to_text
from jobinsights.models import BoardRef
from jobinsights.sources import BOARD_ADAPTERS, greenhouse
from jobinsights.sources.base import ResponseShapeError, to_utc
from jobinsights.store import repo

FIXTURES = Path(__file__).parent.parent / "fixtures" / "greenhouse"
SLUGS = ["airbnb", "databricks", "stripe"]
STRIPE = BoardRef(ats="greenhouse", slug="stripe")
RUN_DATE = date(2026, 10, 30)


def fixture(slug: str) -> dict[str, Any]:
    return json.loads((FIXTURES / f"{slug}.json").read_text())


def board(slug: str) -> BoardRef:
    return BoardRef(ats="greenhouse", slug=slug)


def minimal_job(**overrides: Any) -> dict[str, Any]:
    return {"id": 42, "title": "Backend Engineer"} | overrides


def test_the_adapter_is_registered() -> None:
    assert BOARD_ADAPTERS["greenhouse"] is greenhouse


# --- request_url --------------------------------------------------------------


def test_request_url_comes_from_sources_yaml() -> None:
    source = load_sources(Path(__file__).parent.parent.parent)["greenhouse"]

    assert (
        greenhouse.request_url(STRIPE, source)
        == "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true"
    )


def test_request_url_escapes_the_slug() -> None:
    source = load_sources(Path(__file__).parent.parent.parent)["greenhouse"]

    url = greenhouse.request_url(board("a/../b?x=1"), source)

    assert "/boards/a%2F..%2Fb%3Fx%3D1/jobs" in url


def test_request_url_refuses_an_unverified_region() -> None:
    source = load_sources(Path(__file__).parent.parent.parent)["greenhouse"]

    with pytest.raises(ValueError, match="region"):
        greenhouse.request_url(BoardRef(ats="greenhouse", region="eu", slug="acme"), source)


# --- split --------------------------------------------------------------------


@pytest.mark.parametrize("slug", SLUGS)
def test_split_keeps_every_job_in_order_as_returned(slug: str) -> None:
    payload = fixture(slug)

    split = greenhouse.split(payload, board(slug))

    assert [item.body for item in split.items] == payload["jobs"]
    assert [item.native_id for item in split.items] == [
        f"{slug}:{job['id']}" for job in payload["jobs"]
    ]
    assert {item.kind for item in split.items} == {"item"}


def test_split_puts_everything_else_in_the_envelope() -> None:
    payload = fixture("stripe") | {"something_new": 1}
    payload["meta"]["total"] = len(payload["jobs"])

    split = greenhouse.split(payload, STRIPE)

    assert split.envelope == {"meta": {"total": 3}, "something_new": 1}


def test_an_empty_board_is_valid() -> None:
    split = greenhouse.split({"jobs": [], "meta": {"total": 0}}, STRIPE)

    assert split.items == []


@pytest.mark.parametrize(
    "payload",
    [
        [],
        "Not Found",
        None,
        {},
        {"jobs": "nope", "meta": {"total": 0}},
        {"meta": {"total": 0}},
        {"jobs": []},  # no completeness check available
        {"jobs": [], "meta": {}},
        {"jobs": [], "meta": "nope"},
        {"jobs": [{"id": 1}], "meta": {"total": 2}},  # a partial list
        {"jobs": [{"id": 1}, {"id": 2}], "meta": {"total": 1}},
    ],
)
def test_split_refuses_a_response_that_is_wrong_or_incomplete(payload: Any) -> None:
    with pytest.raises(ResponseShapeError):
        greenhouse.split(payload, STRIPE)


@pytest.mark.parametrize("job", [{"title": "No id"}, "not an object", None])
def test_a_malformed_job_still_splits_and_fails_at_parse(job: Any) -> None:
    payload = {"jobs": [job, {"id": 1, "title": "Fine"}], "meta": {"total": 2}}

    split = greenhouse.split(payload, STRIPE)

    assert [item.native_id for item in split.items] == [None, "stripe:1"]
    with pytest.raises(ValueError, match="no `id`"):
        greenhouse.parse(split.items[0].body, split.envelope, STRIPE)
    assert greenhouse.parse(split.items[1].body, split.envelope, STRIPE).title == "Fine"


# --- parse --------------------------------------------------------------------


def test_parse_maps_a_real_job() -> None:
    job = fixture("stripe")["jobs"][0]

    record = greenhouse.parse(job, {"meta": {"total": 3}}, STRIPE)

    assert record.source == "greenhouse"
    assert record.native_id == "stripe:8172510"
    assert record.snapshot is True
    assert record.board == STRIPE
    assert record.company_name_raw == "Stripe"
    assert record.title == "Abuse Investigator"
    assert record.department_raw == "8611 Security Analytics"
    assert record.locations_raw == ["Seattle, San Francisco, New York City"]
    assert record.source_url == "https://stripe.com/jobs/search?gh_jid=8172510"
    assert record.apply_url == record.source_url
    assert record.posted_at == "2026-09-09T14:50:29+00:00"
    assert record.source_updated_at == "2026-10-29T14:42:09+00:00"
    assert record.extra == {"offices": ["US"], "requisition_id": "See Opening ID"}


@pytest.mark.parametrize("slug", SLUGS)
def test_every_real_job_parses_and_matches_its_split_id(slug: str) -> None:
    split = greenhouse.split(fixture(slug), board(slug))

    records = [greenhouse.parse(item.body, split.envelope, board(slug)) for item in split.items]

    assert [record.native_id for record in records] == [item.native_id for item in split.items]
    for record in records:
        assert record.description_html is not None
        assert record.description_text is None
        assert record.posted_at is not None and record.posted_at.endswith("+00:00")


@pytest.mark.parametrize("slug", SLUGS)
def test_real_descriptions_become_plain_text(slug: str) -> None:
    split = greenhouse.split(fixture(slug), board(slug))

    for item in split.items:
        record = greenhouse.parse(item.body, split.envelope, board(slug))
        text = html_to_text(record.description_html or "")
        assert text
        assert "&lt;" not in text
        assert "<p>" not in text


def test_escaped_html_is_unescaped() -> None:
    job = minimal_job(content="&lt;p&gt;Build &lt;b&gt;APIs&lt;/b&gt; &amp;amp; tools.&lt;/p&gt;")

    record = greenhouse.parse(job, {}, STRIPE)

    assert record.description_html == "<p>Build <b>APIs</b> &amp; tools.</p>"
    assert html_to_text(record.description_html) == "Build APIs & tools."


def test_text_stays_as_the_source_gave_it() -> None:
    job = minimal_job(title="Account Executive ", location={"name": "United States "})

    record = greenhouse.parse(job, {}, STRIPE)

    assert record.title == "Account Executive "
    assert record.locations_raw == ["United States "]


def test_several_departments_are_joined() -> None:
    job = minimal_job(departments=[{"name": "Engineering"}, {"name": "Platform"}])

    assert greenhouse.parse(job, {}, STRIPE).department_raw == "Engineering; Platform"


@pytest.mark.parametrize(
    "fields",
    [
        {},
        {
            "company_name": None,
            "content": None,
            "departments": None,
            "location": None,
            "offices": None,
            "absolute_url": None,
            "first_published": None,
            "updated_at": None,
            "requisition_id": None,
        },
        {"content": "", "departments": [], "location": {}, "offices": [], "requisition_id": ""},
    ],
)
def test_missing_optional_fields_become_none(fields: dict[str, Any]) -> None:
    record = greenhouse.parse(minimal_job(**fields), {}, STRIPE)

    assert record.company_name_raw is None
    assert record.department_raw is None
    assert record.locations_raw == []
    assert record.description_html is None
    assert record.apply_url is None
    assert record.source_url is None
    assert record.posted_at is None
    assert record.source_updated_at is None
    assert record.extra == {}


def test_the_list_never_sets_pay_or_ats_ref() -> None:
    record = greenhouse.parse(fixture("stripe")["jobs"][0], {}, STRIPE)

    assert record.salary_min is None
    assert record.salary_raw is None
    assert record.ats_ref is None  # built in Milestone 3


@pytest.mark.parametrize("title", [None, ""])
def test_a_job_without_a_title_is_refused(title: str | None) -> None:
    with pytest.raises(ValidationError):
        greenhouse.parse(minimal_job(title=title), {}, STRIPE)


def test_a_job_with_no_title_field_is_refused() -> None:
    with pytest.raises(KeyError):
        greenhouse.parse({"id": 42}, {}, STRIPE)


def test_salary_fields_survive_a_parse_returning_none() -> None:
    assert set(greenhouse.KEEP_IF_NONE) == {
        "salary_min",
        "salary_max",
        "salary_currency",
        "salary_period",
        "salary_raw",
    }


# --- purity and the path through storage ------------------------------------------


def test_parse_is_pure() -> None:
    job = fixture("stripe")["jobs"][0]
    before = copy.deepcopy(job)

    first = greenhouse.parse(job, {"meta": {"total": 3}}, STRIPE)
    second = greenhouse.parse(job, {"meta": {"total": 3}}, STRIPE)

    assert first == second
    assert job == before


def test_parsing_from_the_archive_gives_the_same_record(archive_db: sqlite3.Connection) -> None:
    payload = fixture("stripe")
    split = greenhouse.split(payload, STRIPE)
    archive.write_manifest(
        archive_db,
        fetch_id=1,
        run_date=RUN_DATE,
        source="greenhouse",
        target="stripe",
        request_url="https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true",
        ok=True,
        http_status=200,
        envelope=split.envelope,
        items=split.items,
    )

    archived = archive.read_fetch(archive_db, 1)

    assert archived is not None
    fresh = [greenhouse.parse(item.body, split.envelope, STRIPE) for item in split.items]
    replayed = [greenhouse.parse(item.body, archived.envelope, STRIPE) for item in archived.items]
    assert replayed == fresh


def test_a_parsed_record_can_be_stored(jobs_db: sqlite3.Connection) -> None:
    record = greenhouse.parse(fixture("stripe")["jobs"][0], {}, STRIPE)

    with jobs_db:
        result = repo.upsert_posting(
            jobs_db, record, run_date=RUN_DATE, parser_version=greenhouse.PARSER_VERSION
        )

    row = jobs_db.execute(
        "SELECT title, description_hash, locations_raw, posted_at, parser_version "
        "FROM postings WHERE posting_id = ?",
        (result.posting_id,),
    ).fetchone()
    assert row["title"] == "Abuse Investigator"
    assert row["description_hash"] is not None
    assert json.loads(row["locations_raw"]) == ["Seattle, San Francisco, New York City"]
    assert row["posted_at"] == "2026-09-09T14:50:29+00:00"
    assert row["parser_version"] == "1"


# --- to_utc ---------------------------------------------------------------------


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("2026-09-03T13:32:53-04:00", "2026-09-03T17:32:53+00:00"),
        ("2026-04-07T17:12:35.753+00:00", "2026-04-07T17:12:35+00:00"),
        ("2026-04-07T17:12:35Z", "2026-04-07T17:12:35+00:00"),
        (None, None),
        # Can't be placed in UTC, so kept as given rather than failing the job.
        ("2026-04-07T17:12:35", "2026-04-07T17:12:35"),
        ("last Tuesday", "last Tuesday"),
    ],
)
def test_to_utc(value: str | None, expected: str | None) -> None:
    assert to_utc(value) == expected
