"""Lever Postings API: https://github.com/lever/postings-api

One request returns a company's whole board as a bare array, so there's no
envelope, and no total to check it against. A posting's description is spread
over several fields, which are joined here into one HTML document.
"""

import html
from typing import Any
from urllib.parse import quote

from jobinsights.archive import ArchiveItem, canonical_json
from jobinsights.config import SourceConfig
from jobinsights.models import BoardRef, PostingRecord
from jobinsights.sources.base import ResponseShapeError, Split, epoch_ms_to_utc, job_native_id

NAME = "lever"
SNAPSHOT = True
PARSER_VERSION = "1"
KEEP_IF_NONE: tuple[str, ...] = ()


def request_url(board: BoardRef, source: SourceConfig) -> str:
    endpoints = {"default": source.endpoint, "eu": source.eu_endpoint}
    endpoint = endpoints.get(board.region)
    if endpoint is None:
        raise ValueError(f"no Lever API host for region {board.region!r}")
    return endpoint.format(slug=quote(board.slug, safe=""))


def split(payload: Any, board: BoardRef) -> Split:
    if not isinstance(payload, list):
        raise ResponseShapeError(f"expected an array, got {type(payload).__name__}")
    items = [ArchiveItem(native_id=job_native_id(job, board), body=job) for job in payload]
    return Split(envelope=None, items=items)


def parse(item: Any, envelope: Any, board: BoardRef) -> PostingRecord:
    native_id = job_native_id(item, board)
    if native_id is None:
        raise ValueError("job has no `id`")

    categories = item.get("categories") or {}
    location = categories.get("location")
    salary = item.get("salaryRange") or {}
    extra = {"team": categories.get("team"), "country": item.get("country")}
    return PostingRecord(
        source=NAME,
        native_id=native_id,
        snapshot=SNAPSHOT,
        board=board,
        title=item["text"],
        department_raw=categories.get("department"),
        locations_raw=categories.get("allLocations") or ([location] if location else []),
        workplace_raw=item.get("workplaceType"),
        employment_type_raw=categories.get("commitment"),
        salary_min=salary.get("min"),
        salary_max=salary.get("max"),
        salary_currency=salary.get("currency"),
        salary_period=salary.get("interval"),
        salary_raw=_salary_raw(item),
        description_html=_description_html(item),
        apply_url=item.get("applyUrl"),
        source_url=item.get("hostedUrl"),
        posted_at=epoch_ms_to_utc(item.get("createdAt")),
        extra={key: value for key, value in extra.items() if value},
    )


def _salary_raw(item: dict[str, Any]) -> str | None:
    # The range comes first: `salaryDescriptionPlain` rarely repeats its numbers,
    # so only the range shows up as a change in posting_versions when pay changes.
    salary = item.get("salaryRange")
    if salary:
        return canonical_json(salary)
    return (item.get("salaryDescriptionPlain") or "").strip() or None


def _description_html(item: dict[str, Any]) -> str | None:
    """Join the fields a posting's page shows: intro, lists, closing text, salary text."""
    parts = [item.get("description")]
    for entry in item.get("lists") or []:
        heading = entry.get("text")
        if heading:
            parts.append(f"<h3>{html.escape(heading)}</h3>")
        parts.append(f"<ul>{entry.get('content') or ''}</ul>")
    parts += [item.get("additional"), item.get("salaryDescription")]
    return "\n".join(part for part in parts if part) or None
