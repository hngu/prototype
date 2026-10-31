"""Greenhouse Job Board API: https://docs.greenhouse.io/job-board.html

One request returns a company's whole board, with `meta.total` as a completeness
check. The list has no pay data; that comes from a request per job, which fills
the salary fields later, so they're kept when a parse returns None.
"""

import html
from typing import Any
from urllib.parse import quote

from jobinsights.archive import ArchiveItem
from jobinsights.config import SourceConfig
from jobinsights.models import BoardRef, PostingRecord
from jobinsights.sources.base import ResponseShapeError, Split, to_utc

NAME = "greenhouse"
SNAPSHOT = True
PARSER_VERSION = "1"
KEEP_IF_NONE = ("salary_min", "salary_max", "salary_currency", "salary_period", "salary_raw")


def request_url(board: BoardRef, source: SourceConfig) -> str:
    if board.region != "default":
        # job-boards.eu.greenhouse.io exists, but its API host isn't documented (Milestone 3).
        raise ValueError(f"no verified Greenhouse API host for region {board.region!r}")
    assert source.endpoint is not None
    return source.endpoint.format(slug=quote(board.slug, safe=""))


def split(payload: Any, board: BoardRef) -> Split:
    if not isinstance(payload, dict):
        raise ResponseShapeError(f"expected an object, got {type(payload).__name__}")
    jobs = payload.get("jobs")
    if not isinstance(jobs, list):
        raise ResponseShapeError("response has no `jobs` list")
    meta = payload.get("meta")
    total = meta.get("total") if isinstance(meta, dict) else None
    if total != len(jobs):
        # A partial list would look like closures, so it must not count as a snapshot.
        raise ResponseShapeError(f"`meta.total` is {total!r} but the response has {len(jobs)} jobs")
    envelope = {key: value for key, value in payload.items() if key != "jobs"}
    items = [ArchiveItem(native_id=_native_id(job, board), body=job) for job in jobs]
    return Split(envelope=envelope, items=items)


def parse(item: Any, envelope: Any, board: BoardRef) -> PostingRecord:
    native_id = _native_id(item, board)
    if native_id is None:
        raise ValueError("job has no `id`")

    location = (item.get("location") or {}).get("name")
    content = item.get("content")
    url = item.get("absolute_url")
    extra = {
        "offices": _names(item.get("offices")),
        "requisition_id": item.get("requisition_id"),
    }
    return PostingRecord(
        source=NAME,
        native_id=native_id,
        snapshot=SNAPSHOT,
        board=board,
        company_name_raw=item.get("company_name"),
        title=item["title"],
        department_raw="; ".join(_names(item.get("departments"))) or None,
        locations_raw=[location] if location else [],
        # `content` arrives entity-escaped (&lt;p&gt;).
        description_html=html.unescape(content) if content else None,
        apply_url=url,
        source_url=url,
        posted_at=to_utc(item.get("first_published")),
        source_updated_at=to_utc(item.get("updated_at")),
        extra={key: value for key, value in extra.items() if value},
    )


def _native_id(job: Any, board: BoardRef) -> str | None:
    job_id = job.get("id") if isinstance(job, dict) else None
    return f"{board.slug}:{job_id}" if job_id is not None else None


def _names(entries: Any) -> list[str]:
    return [entry["name"] for entry in entries or [] if entry.get("name")]
