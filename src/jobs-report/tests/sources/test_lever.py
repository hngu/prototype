import copy
import json
import sqlite3
from datetime import date
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from jobinsights.config import load_sources
from jobinsights.descriptions import html_to_text
from jobinsights.models import BoardRef
from jobinsights.sources import BOARD_ADAPTERS, lever
from jobinsights.sources.base import ResponseShapeError, epoch_ms_to_utc
from jobinsights.store import repo

PROJECT_ROOT = Path(__file__).parent.parent.parent
FIXTURES = PROJECT_ROOT / "tests" / "fixtures" / "lever"
SLUGS = ["sonarsource", "spotify", "zoox"]
ZOOX = BoardRef(ats="lever", slug="zoox")
RUN_DATE = date(2026, 10, 31)


def fixture(slug: str) -> list[dict[str, Any]]:
    return json.loads((FIXTURES / f"{slug}.json").read_text())


def board(slug: str) -> BoardRef:
    return BoardRef(ats="lever", slug=slug)


def minimal_job(**overrides: Any) -> dict[str, Any]:
    return {"id": "abc-123", "text": "Backend Engineer"} | overrides


def job_with_pay() -> dict[str, Any]:
    return next(job for job in fixture("zoox") if job.get("salaryRange"))


def job_without_pay() -> dict[str, Any]:
    return next(job for job in fixture("zoox") if not job.get("salaryRange"))


def test_the_adapter_is_registered() -> None:
    assert BOARD_ADAPTERS["lever"] is lever


# --- request_url --------------------------------------------------------------


@pytest.mark.parametrize(
    ("region", "expected"),
    [
        ("default", "https://api.lever.co/v0/postings/zoox?mode=json"),
        ("eu", "https://api.eu.lever.co/v0/postings/zoox?mode=json"),
    ],
)
def test_request_url_uses_the_regions_host(region: str, expected: str) -> None:
    source = load_sources(PROJECT_ROOT)["lever"]

    assert lever.request_url(BoardRef(ats="lever", region=region, slug="zoox"), source) == expected


def test_request_url_escapes_the_slug() -> None:
    source = load_sources(PROJECT_ROOT)["lever"]

    assert "/postings/a%2Fb?" in lever.request_url(board("a/b"), source)


def test_request_url_refuses_an_unknown_region() -> None:
    source = load_sources(PROJECT_ROOT)["lever"]

    with pytest.raises(ValueError, match="region"):
        lever.request_url(BoardRef(ats="lever", region="apac", slug="zoox"), source)


# --- split --------------------------------------------------------------------


@pytest.mark.parametrize("slug", SLUGS)
def test_split_keeps_every_job_in_order_as_returned(slug: str) -> None:
    payload = fixture(slug)

    split = lever.split(payload, board(slug))

    assert [item.body for item in split.items] == payload
    assert [item.native_id for item in split.items] == [f"{slug}:{job['id']}" for job in payload]
    assert {item.kind for item in split.items} == {"item"}
    assert split.envelope is None  # a bare array has nothing else in it


def test_an_empty_board_is_valid() -> None:
    assert lever.split([], ZOOX).items == []


@pytest.mark.parametrize("payload", [{}, {"ok": False, "error": "Document not found"}, "x", None])
def test_split_refuses_a_response_that_is_not_an_array(payload: Any) -> None:
    with pytest.raises(ResponseShapeError):
        lever.split(payload, ZOOX)


@pytest.mark.parametrize("job", [{"text": "No id"}, "not an object", None])
def test_a_malformed_job_still_splits_and_fails_at_parse(job: Any) -> None:
    split = lever.split([job, {"id": "1", "text": "Fine"}], ZOOX)

    assert [item.native_id for item in split.items] == [None, "zoox:1"]
    with pytest.raises(ValueError, match="no `id`"):
        lever.parse(split.items[0].body, split.envelope, ZOOX)
    assert lever.parse(split.items[1].body, split.envelope, ZOOX).title == "Fine"


# --- parse --------------------------------------------------------------------


def test_parse_maps_a_real_job() -> None:
    job = job_with_pay()

    record = lever.parse(job, None, ZOOX)

    assert record.source == "lever"
    assert record.native_id == f"zoox:{job['id']}"
    assert record.snapshot is True
    assert record.board == ZOOX
    assert record.company_name_raw is None  # Lever doesn't send one
    assert record.title == "Administrative Business Partner, Floater"
    assert record.department_raw == "Executive Office"
    assert record.locations_raw == ["Foster City, CA"]
    assert record.workplace_raw == "hybrid"
    assert record.employment_type_raw == "Full-time"
    assert record.source_url == f"https://jobs.lever.co/zoox/{job['id']}"
    assert record.apply_url == f"https://jobs.lever.co/zoox/{job['id']}/apply"
    assert record.posted_at == "2026-10-06T17:27:44+00:00"
    assert record.source_updated_at is None
    assert record.extra == {"team": "Executive Office", "country": "US"}


@pytest.mark.parametrize("slug", SLUGS)
def test_every_real_job_parses_and_matches_its_split_id(slug: str) -> None:
    split = lever.split(fixture(slug), board(slug))

    records = [lever.parse(item.body, split.envelope, board(slug)) for item in split.items]

    assert [record.native_id for record in records] == [item.native_id for item in split.items]
    for record in records:
        assert html_to_text(record.description_html or "")
        assert record.posted_at is not None and record.posted_at.endswith("+00:00")


def test_structured_pay_is_mapped_and_kept_in_salary_raw() -> None:
    record = lever.parse(job_with_pay(), None, ZOOX)

    assert record.salary_min == 123000
    assert record.salary_max == 168000
    assert record.salary_currency == "USD"
    assert record.salary_period == "per-year-salary"
    assert record.salary_raw == (
        '{"currency":"USD","interval":"per-year-salary","max":168000,"min":123000}'
    )


def test_a_pay_change_changes_salary_raw_even_when_the_text_does_not() -> None:
    before = job_with_pay()
    after = copy.deepcopy(before)
    after["salaryRange"]["max"] = 200000

    assert lever.parse(before, None, ZOOX).salary_raw != lever.parse(after, None, ZOOX).salary_raw
    assert before["salaryDescriptionPlain"] == after["salaryDescriptionPlain"]


def test_salary_text_is_used_when_there_is_no_range() -> None:
    record = lever.parse(minimal_job(salaryDescriptionPlain="\n Up to $100k \n"), None, ZOOX)

    assert record.salary_raw == "Up to $100k"
    assert record.salary_min is None


def test_a_job_without_pay_has_no_pay_fields() -> None:
    record = lever.parse(job_without_pay(), None, ZOOX)

    assert record.salary_min is None
    assert record.salary_max is None
    assert record.salary_currency is None
    assert record.salary_period is None
    assert record.salary_raw is None


def test_the_description_joins_every_part_of_the_page() -> None:
    job = minimal_job(
        description="<p>Intro</p>",
        lists=[
            {"text": "You'll do", "content": "<li>Build</li><li>Ship</li>"},
            {"text": "R&D with <Python>", "content": "<li>Python</li>"},
        ],
        additional="<p>Closing</p>",
        salaryDescription="<p>Pay text</p>",
    )

    record = lever.parse(job, None, ZOOX)

    assert html_to_text(record.description_html or "") == (
        "Intro\n\nYou'll do\n\nBuild\nShip\n\nR&D with <Python>\n\nPython\n\nClosing\n\nPay text"
    )


def test_a_real_description_includes_the_lists_and_salary_text() -> None:
    job = job_with_pay()

    text = html_to_text(lever.parse(job, None, ZOOX).description_html or "")

    assert job["lists"][0]["text"].strip() in text
    assert "Base Salary Range" in text


def test_all_locations_are_preferred_over_the_main_one() -> None:
    job = minimal_job(categories={"location": "NYC", "allLocations": ["NYC", "London"]})

    assert lever.parse(job, None, ZOOX).locations_raw == ["NYC", "London"]


def test_the_main_location_is_used_when_all_locations_is_missing() -> None:
    job = minimal_job(categories={"location": "NYC"})

    assert lever.parse(job, None, ZOOX).locations_raw == ["NYC"]


@pytest.mark.parametrize(
    "fields",
    [
        {},
        {
            "categories": None,
            "lists": None,
            "description": None,
            "additional": None,
            "salaryRange": None,
            "salaryDescription": None,
            "salaryDescriptionPlain": None,
            "hostedUrl": None,
            "applyUrl": None,
            "createdAt": None,
            "country": None,
        },
        {"categories": {}, "lists": [], "description": "", "salaryRange": {}, "country": ""},
    ],
)
def test_missing_optional_fields_become_none(fields: dict[str, Any]) -> None:
    record = lever.parse(minimal_job(**fields), None, ZOOX)

    assert record.department_raw is None
    assert record.locations_raw == []
    assert record.workplace_raw is None
    assert record.employment_type_raw is None
    assert record.salary_raw is None
    assert record.description_html is None
    assert record.apply_url is None
    assert record.source_url is None
    assert record.posted_at is None
    assert record.extra == {}


def test_a_job_with_no_title_is_refused() -> None:
    with pytest.raises(KeyError):
        lever.parse({"id": "1"}, None, ZOOX)
    with pytest.raises(ValidationError):
        lever.parse(minimal_job(text=""), None, ZOOX)


def test_salary_is_not_protected_from_a_parse_returning_none() -> None:
    # Lever's pay is in the list itself, so a removed salary is a real change.
    assert lever.KEEP_IF_NONE == ()


# --- purity and storage -------------------------------------------------------------


def test_parse_is_pure() -> None:
    job = job_with_pay()
    before = copy.deepcopy(job)

    assert lever.parse(job, None, ZOOX) == lever.parse(job, None, ZOOX)
    assert job == before


def test_a_parsed_record_can_be_stored(jobs_db: sqlite3.Connection) -> None:
    record = lever.parse(job_with_pay(), None, ZOOX)

    with jobs_db:
        result = repo.upsert_posting(
            jobs_db, record, run_date=RUN_DATE, parser_version=lever.PARSER_VERSION
        )

    row = jobs_db.execute(
        "SELECT salary_min, salary_max, salary_period, description_hash FROM postings "
        "WHERE posting_id = ?",
        (result.posting_id,),
    ).fetchone()
    assert (row["salary_min"], row["salary_max"]) == (123000, 168000)
    assert row["salary_period"] == "per-year-salary"
    assert row["description_hash"] is not None


# --- epoch_ms_to_utc -------------------------------------------------------------


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (1757318342596, "2025-09-08T07:59:02+00:00"),
        (0, "1970-01-01T00:00:00+00:00"),
        (None, None),
        # Can't be converted, so kept as text rather than failing the job.
        ("soon", "soon"),
        (10**30, str(10**30)),
    ],
)
def test_epoch_ms_to_utc(value: Any, expected: str | None) -> None:
    assert epoch_ms_to_utc(value) == expected
