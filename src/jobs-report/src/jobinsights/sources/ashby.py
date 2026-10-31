"""Ashby Job Posting API: https://developers.ashbyhq.com/docs/public-job-posting-api

One request returns a company's whole board. Pay sits under each job, in tiers
(usually one per region). A summary across several tiers can mix currencies, so
only a job with exactly one salary gets the structured fields, and `salary_raw`
keeps every tier's own text.
"""

from typing import Any
from urllib.parse import quote

from jobinsights.archive import ArchiveItem
from jobinsights.config import SourceConfig
from jobinsights.models import BoardRef, PostingRecord
from jobinsights.sources.base import ResponseShapeError, Split, job_native_id, to_utc

NAME = "ashby"
SNAPSHOT = True
PARSER_VERSION = "1"
KEEP_IF_NONE: tuple[str, ...] = ()


def request_url(board: BoardRef, source: SourceConfig) -> str:
    if board.region != "default":
        raise ValueError(f"no Ashby API host for region {board.region!r}")
    assert source.endpoint is not None
    return source.endpoint.format(slug=quote(board.slug, safe=""))


def split(payload: Any, board: BoardRef) -> Split:
    if not isinstance(payload, dict):
        raise ResponseShapeError(f"expected an object, got {type(payload).__name__}")
    jobs = payload.get("jobs")
    if not isinstance(jobs, list):
        raise ResponseShapeError("response has no `jobs` list")
    envelope = {key: value for key, value in payload.items() if key != "jobs"}
    items = [ArchiveItem(native_id=job_native_id(job, board), body=job) for job in jobs]
    return Split(envelope=envelope, items=items)


def parse(item: Any, envelope: Any, board: BoardRef) -> PostingRecord:
    native_id = job_native_id(item, board)
    if native_id is None:
        raise ValueError("job has no `id`")

    compensation = item.get("compensation") or {}
    tiers = compensation.get("compensationTiers") or []
    salary = _single_salary(tiers)
    locations = [
        item.get("location"),
        *(entry.get("location") for entry in item.get("secondaryLocations") or []),
    ]
    html = item.get("descriptionHtml")
    extra = {
        "team": item.get("team"),
        "is_listed": item.get("isListed"),
        "is_remote": item.get("isRemote"),
    }
    return PostingRecord(
        source=NAME,
        native_id=native_id,
        snapshot=SNAPSHOT,
        board=board,
        title=item["title"],
        department_raw=item.get("department"),
        locations_raw=[location for location in locations if location],
        workplace_raw=item.get("workplaceType"),
        employment_type_raw=item.get("employmentType"),
        salary_min=salary.get("minValue"),
        salary_max=salary.get("maxValue"),
        salary_currency=salary.get("currencyCode"),
        salary_period=salary.get("interval"),
        salary_raw=_salary_raw(compensation, tiers),
        description_html=html or None,
        description_text=None if html else item.get("descriptionPlain") or None,
        apply_url=item.get("applyUrl"),
        source_url=item.get("jobUrl"),
        posted_at=to_utc(item.get("publishedAt")),
        # False is meaningful here, so only missing values are dropped.
        extra={key: value for key, value in extra.items() if value not in (None, "")},
    )


def _single_salary(tiers: list[dict[str, Any]]) -> dict[str, Any]:
    """The salary component if there's exactly one across all tiers, else nothing."""
    salaries = [
        component
        for tier in tiers
        for component in tier.get("components") or []
        if component.get("compensationType") == "Salary"
    ]
    return salaries[0] if len(salaries) == 1 else {}


def _salary_raw(compensation: dict[str, Any], tiers: list[dict[str, Any]]) -> str | None:
    if len(tiers) > 1:
        lines = (
            f"{tier['title']}: {tier['tierSummary']}" if tier.get("title") else tier["tierSummary"]
            for tier in tiers
            if tier.get("tierSummary")
        )
        return "\n".join(lines) or None
    return compensation.get("compensationTierSummary") or None
