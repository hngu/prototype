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
from jobinsights.sources import BOARD_ADAPTERS, ashby
from jobinsights.sources.base import ResponseShapeError
from jobinsights.store import repo

PROJECT_ROOT = Path(__file__).parent.parent.parent
FIXTURES = PROJECT_ROOT / "tests" / "fixtures" / "ashby"
SLUGS = ["cohere", "notion", "ramp"]
RAMP = BoardRef(ats="ashby", slug="ramp")
COHERE = BoardRef(ats="ashby", slug="cohere")
ENVELOPE = {"apiVersion": "1"}
RUN_DATE = date(2026, 10, 31)


def fixture(slug: str) -> dict[str, Any]:
    return json.loads((FIXTURES / f"{slug}.json").read_text())


def board(slug: str) -> BoardRef:
    return BoardRef(ats="ashby", slug=slug)


def minimal_job(**overrides: Any) -> dict[str, Any]:
    return {"id": "abc-123", "title": "Backend Engineer"} | overrides


def job_with_tiers(slug: str, count: int) -> dict[str, Any]:
    return next(
        job
        for job in fixture(slug)["jobs"]
        if len(job["compensation"]["compensationTiers"]) == count
    )


def salary_tier(minimum: int, title: str | None = None) -> dict[str, Any]:
    return {
        "title": title,
        "tierSummary": f"${minimum}",
        "components": [
            {"compensationType": "EquityPercentage", "minValue": None},
            {
                "compensationType": "Salary",
                "minValue": minimum,
                "maxValue": minimum + 1,
                "currencyCode": "USD",
                "interval": "1 YEAR",
            },
        ],
    }


def test_the_adapter_is_registered() -> None:
    assert BOARD_ADAPTERS["ashby"] is ashby


# --- request_url --------------------------------------------------------------


def test_request_url_comes_from_sources_yaml() -> None:
    source = load_sources(PROJECT_ROOT)["ashby"]

    assert (
        ashby.request_url(RAMP, source)
        == "https://api.ashbyhq.com/posting-api/job-board/ramp?includeCompensation=true"
    )


def test_request_url_escapes_the_slug() -> None:
    source = load_sources(PROJECT_ROOT)["ashby"]

    assert "/job-board/a%2Fb?" in ashby.request_url(board("a/b"), source)


def test_request_url_refuses_an_unknown_region() -> None:
    source = load_sources(PROJECT_ROOT)["ashby"]

    with pytest.raises(ValueError, match="region"):
        ashby.request_url(BoardRef(ats="ashby", region="eu", slug="ramp"), source)


# --- split --------------------------------------------------------------------


@pytest.mark.parametrize("slug", SLUGS)
def test_split_keeps_every_job_in_order_as_returned(slug: str) -> None:
    payload = fixture(slug)

    split = ashby.split(payload, board(slug))

    assert [item.body for item in split.items] == payload["jobs"]
    assert [item.native_id for item in split.items] == [
        f"{slug}:{job['id']}" for job in payload["jobs"]
    ]
    assert {item.kind for item in split.items} == {"item"}
    assert split.envelope == ENVELOPE


def test_an_empty_board_is_valid() -> None:
    assert ashby.split({"apiVersion": "1", "jobs": []}, RAMP).items == []


@pytest.mark.parametrize("payload", [[], "Not Found", None, {}, {"jobs": "nope"}])
def test_split_refuses_a_response_that_is_wrong(payload: Any) -> None:
    with pytest.raises(ResponseShapeError):
        ashby.split(payload, RAMP)


@pytest.mark.parametrize("job", [{"title": "No id"}, "not an object", None])
def test_a_malformed_job_still_splits_and_fails_at_parse(job: Any) -> None:
    split = ashby.split({"jobs": [job, {"id": "1", "title": "Fine"}]}, RAMP)

    assert [item.native_id for item in split.items] == [None, "ramp:1"]
    with pytest.raises(ValueError, match="no `id`"):
        ashby.parse(split.items[0].body, split.envelope, RAMP)
    assert ashby.parse(split.items[1].body, split.envelope, RAMP).title == "Fine"


# --- parse --------------------------------------------------------------------


def test_parse_maps_a_real_job() -> None:
    job = job_with_tiers("ramp", 1)

    record = ashby.parse(job, ENVELOPE, RAMP)

    assert record.source == "ashby"
    assert record.native_id == f"ramp:{job['id']}"
    assert record.snapshot is True
    assert record.board == RAMP
    assert record.company_name_raw is None  # Ashby doesn't send one
    assert record.title == " Security Engineer, Cloud"  # as given, leading space included
    assert record.department_raw == "Engineering"
    assert record.locations_raw == [
        "New York, NY (HQ)",
        "Remote (Canada)",
        "Remote (US)",
        "Miami, FL",
    ]
    assert record.workplace_raw == "Hybrid"
    assert record.employment_type_raw == "FullTime"
    assert record.source_url == f"https://jobs.ashbyhq.com/ramp/{job['id']}"
    assert record.apply_url == f"https://jobs.ashbyhq.com/ramp/{job['id']}/application"
    assert record.posted_at == "2026-04-07T17:12:35+00:00"
    assert record.source_updated_at is None
    assert record.extra == {"team": "Backend", "is_listed": True, "is_remote": True}


@pytest.mark.parametrize("slug", SLUGS)
def test_every_real_job_parses_and_matches_its_split_id(slug: str) -> None:
    split = ashby.split(fixture(slug), board(slug))

    records = [ashby.parse(item.body, split.envelope, board(slug)) for item in split.items]

    assert [record.native_id for record in records] == [item.native_id for item in split.items]
    for record in records:
        assert html_to_text(record.description_html or "")
        assert record.description_text is None
        assert record.posted_at is not None and record.posted_at.endswith("+00:00")


def test_one_salary_fills_the_structured_fields() -> None:
    record = ashby.parse(job_with_tiers("ramp", 1), ENVELOPE, RAMP)

    assert record.salary_min == 211400
    assert record.salary_max == 290600
    assert record.salary_currency == "USD"
    assert record.salary_period == "1 YEAR"
    assert record.salary_raw == "$211.4K \u2013 $290.6K • Offers Equity"


def test_several_tiers_keep_every_range_as_text_only() -> None:
    record = ashby.parse(job_with_tiers("cohere", 4), ENVELOPE, COHERE)

    assert record.salary_min is None
    assert record.salary_max is None
    assert record.salary_currency is None
    assert record.salary_period is None
    # Ashby's own summary flattens these into one CAD range, which hides the USD tiers.
    assert record.salary_raw == (
        "Canada - Toronto (GTA), Montreal: Base Salary CA$295K \u2013 CA$535K • Offers Equity\n"
        "Canada: Base Salary CA$250K \u2013 CA$460K • Offers Equity\n"
        "USA - California, New York and Washington: "
        "Base Salary $205K \u2013 $380K • Offers Equity\n"
        "USA - All Other States: Base Salary $175K \u2013 $325K • Offers Equity"
    )


def test_a_job_without_pay_has_no_pay_fields() -> None:
    record = ashby.parse(job_with_tiers("notion", 0), ENVELOPE, board("notion"))

    assert record.salary_min is None
    assert record.salary_raw is None


def test_tiers_without_titles_or_summaries_are_handled() -> None:
    tiers = [
        salary_tier(100),
        salary_tier(200, title="NYC"),
        {"title": "No summary", "tierSummary": None, "components": []},
    ]
    job = minimal_job(compensation={"compensationTiers": tiers})

    assert ashby.parse(job, ENVELOPE, RAMP).salary_raw == "$100\nNYC: $200"


def test_a_tier_with_only_non_salary_pay_fills_no_salary_fields() -> None:
    tier = {"tierSummary": "Offers Equity", "components": [{"compensationType": "Bonus"}]}
    compensation = {"compensationTiers": [tier], "compensationTierSummary": "Offers Equity"}

    record = ashby.parse(minimal_job(compensation=compensation), ENVELOPE, RAMP)

    assert record.salary_min is None
    assert record.salary_currency is None
    assert record.salary_raw == "Offers Equity"


def test_false_flags_are_kept() -> None:
    record = ashby.parse(minimal_job(isListed=False, isRemote=False, team=""), ENVELOPE, RAMP)

    assert record.extra == {"is_listed": False, "is_remote": False}


def test_plain_text_is_used_when_there_is_no_html() -> None:
    record = ashby.parse(minimal_job(descriptionHtml="", descriptionPlain="Hello"), ENVELOPE, RAMP)

    assert record.description_html is None
    assert record.description_text == "Hello"


def test_html_wins_over_plain_text() -> None:
    record = ashby.parse(
        minimal_job(descriptionHtml="<p>Hi</p>", descriptionPlain="Hi"), ENVELOPE, RAMP
    )

    assert record.description_html == "<p>Hi</p>"
    assert record.description_text is None


@pytest.mark.parametrize(
    "fields",
    [
        {},
        {
            "compensation": None,
            "department": None,
            "location": None,
            "secondaryLocations": None,
            "descriptionHtml": None,
            "descriptionPlain": None,
            "applyUrl": None,
            "jobUrl": None,
            "publishedAt": None,
            "team": None,
            "isListed": None,
            "isRemote": None,
        },
        {"compensation": {}, "location": "", "secondaryLocations": [], "descriptionHtml": ""},
    ],
)
def test_missing_optional_fields_become_none(fields: dict[str, Any]) -> None:
    record = ashby.parse(minimal_job(**fields), ENVELOPE, RAMP)

    assert record.department_raw is None
    assert record.locations_raw == []
    assert record.salary_raw is None
    assert record.description_html is None
    assert record.description_text is None
    assert record.apply_url is None
    assert record.source_url is None
    assert record.posted_at is None
    assert record.extra == {}


def test_a_job_with_no_title_is_refused() -> None:
    with pytest.raises(KeyError):
        ashby.parse({"id": "1"}, ENVELOPE, RAMP)
    with pytest.raises(ValidationError):
        ashby.parse(minimal_job(title=""), ENVELOPE, RAMP)


def test_salary_is_not_protected_from_a_parse_returning_none() -> None:
    # Ashby's pay is in the list itself, so a removed salary is a real change.
    assert ashby.KEEP_IF_NONE == ()


# --- purity and storage -------------------------------------------------------------


def test_parse_is_pure() -> None:
    job = job_with_tiers("cohere", 4)
    before = copy.deepcopy(job)

    assert ashby.parse(job, ENVELOPE, COHERE) == ashby.parse(job, ENVELOPE, COHERE)
    assert job == before


def test_a_parsed_record_can_be_stored(jobs_db: sqlite3.Connection) -> None:
    record = ashby.parse(job_with_tiers("ramp", 1), ENVELOPE, RAMP)

    with jobs_db:
        result = repo.upsert_posting(
            jobs_db, record, run_date=RUN_DATE, parser_version=ashby.PARSER_VERSION
        )

    row = jobs_db.execute(
        "SELECT salary_min, salary_raw, locations_raw, description_hash FROM postings "
        "WHERE posting_id = ?",
        (result.posting_id,),
    ).fetchone()
    assert row["salary_min"] == 211400
    assert row["salary_raw"] == "$211.4K \u2013 $290.6K • Offers Equity"
    assert len(json.loads(row["locations_raw"])) == 4
    assert row["description_hash"] is not None
