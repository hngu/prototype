"""What every board adapter provides (PLAN.md §5.1).

An adapter is a module with the attributes of `BoardAdapter`. It does two jobs:

- `split` divides a response into items (one per job, as returned) and an
  envelope (everything else). That's what the archive stores, so it runs before
  anything is parsed. It only checks the response as a whole: a malformed job
  still splits, and fails later in `parse`, on its own.
- `parse` turns one archived item into a PostingRecord. It's a pure function of
  the item, its envelope and its board, so it can be re-run from the archive.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

from jobinsights.archive import ArchiveItem
from jobinsights.config import SourceConfig
from jobinsights.models import BoardRef, PostingRecord


class ResponseShapeError(ValueError):
    """The response as a whole isn't what the source promises, or is incomplete."""


@dataclass(frozen=True, slots=True)
class Split:
    envelope: Any
    items: list[ArchiveItem]


class BoardAdapter(Protocol):
    NAME: str
    SNAPSHOT: bool
    PARSER_VERSION: str  # bump whenever `parse` output changes for the same input
    # Fields filled by a later request, so a parse returning None must not erase them.
    KEEP_IF_NONE: tuple[str, ...]

    def request_url(self, board: BoardRef, source: SourceConfig) -> str: ...

    def split(self, payload: Any, board: BoardRef) -> Split: ...

    def parse(self, item: Any, envelope: Any, board: BoardRef) -> PostingRecord: ...


def job_native_id(job: Any, board: BoardRef) -> str | None:
    """`{slug}:{id}`, which is unique within a source. None if the job has no id."""
    job_id = job.get("id") if isinstance(job, dict) else None
    return f"{board.slug}:{job_id}" if job_id is not None else None


def epoch_ms_to_utc(value: Any) -> str | None:
    """Convert a timestamp in milliseconds since 1970 to UTC, keeping a bad value as text."""
    if value is None:
        return None
    try:
        parsed = datetime.fromtimestamp(value / 1000, UTC)
    except (TypeError, ValueError, OverflowError, OSError):
        return str(value)
    return parsed.isoformat(timespec="seconds")


def to_utc(value: str | None) -> str | None:
    """Convert an ISO-8601 timestamp with an offset to UTC.

    A value that can't be placed in UTC is kept as given: a job shouldn't fail
    to parse over a date, and the raw value may still be useful later.
    """
    if value is None:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return value
    if parsed.tzinfo is None:
        return value
    return parsed.astimezone(UTC).isoformat(timespec="seconds")
