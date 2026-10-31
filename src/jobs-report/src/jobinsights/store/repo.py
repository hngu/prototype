"""Writes and reads against jobs.sqlite.

Every function takes a connection plus explicit dates and timestamps; none
reads the clock. Callers own the transaction (`with conn:`), so one fetch's
upserts commit or roll back together.
"""

import json
import re
import sqlite3
import unicodedata
from dataclasses import dataclass
from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Any, Literal

from jobinsights.descriptions import compress, description_hash, html_to_text, normalize_text
from jobinsights.models import BoardRef, PostingRecord

RunStatus = Literal["ok", "partial", "failed"]
BoardStatus = Literal["candidate", "active", "inactive", "invalid"]


def _timestamp(value: datetime) -> str:
    if value.tzinfo is None:
        raise ValueError(f"timestamp {value!r} has no timezone; use UTC")
    return value.astimezone(UTC).isoformat(timespec="seconds")


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


# --- runs and fetches -------------------------------------------------------


def find_run(conn: sqlite3.Connection, run_date: date) -> int | None:
    row = conn.execute(
        "SELECT run_id FROM runs WHERE run_date = ?", (run_date.isoformat(),)
    ).fetchone()
    return row["run_id"] if row is not None else None


def get_or_start_run(
    conn: sqlite3.Connection, run_date: date, started_at: datetime, git_sha: str | None = None
) -> int:
    """Start the run for this UTC date, or continue it if it already exists.

    A continued run is `running` again and keeps its original `started_at`.
    """
    row = conn.execute(
        "INSERT INTO runs (run_date, started_at, status, git_sha) VALUES (?, ?, 'running', ?) "
        "ON CONFLICT (run_date) DO UPDATE SET status = 'running', finished_at = NULL, "
        "git_sha = excluded.git_sha "
        "RETURNING run_id",
        (run_date.isoformat(), _timestamp(started_at), git_sha),
    ).fetchone()
    return row["run_id"]


def finish_run(
    conn: sqlite3.Connection,
    run_id: int,
    status: RunStatus,
    finished_at: datetime,
    summary: dict[str, Any] | None = None,
) -> None:
    conn.execute(
        "UPDATE runs SET status = ?, finished_at = ?, summary_json = ? WHERE run_id = ?",
        (status, _timestamp(finished_at), _json(summary) if summary is not None else None, run_id),
    )


def start_fetch(
    conn: sqlite3.Connection,
    run_id: int,
    source: str,
    target: str,
    started_at: datetime,
    board_id: int | None = None,
) -> int:
    """Create the fetch row first, so its id can key the archive manifest (§5.4)."""
    row = conn.execute(
        "INSERT INTO fetches (run_id, source, target, board_id, started_at, ok) "
        "VALUES (?, ?, ?, ?, ?, 0) RETURNING fetch_id",
        (run_id, source, target, board_id, _timestamp(started_at)),
    ).fetchone()
    return row["fetch_id"]


def finish_fetch(
    conn: sqlite3.Connection,
    fetch_id: int,
    *,
    ok: bool,
    http_status: int | None,
    item_count: int | None,
    duration_ms: int | None,
    error: str | None = None,
) -> None:
    conn.execute(
        "UPDATE fetches SET ok = ?, http_status = ?, item_count = ?, duration_ms = ?, error = ? "
        "WHERE fetch_id = ?",
        (int(ok), http_status, item_count, duration_ms, error, fetch_id),
    )


def mark_fetch_processed(
    conn: sqlite3.Connection,
    fetch_id: int,
    *,
    ok: bool,
    item_count: int | None,
    processed_at: datetime,
    error: str | None = None,
) -> None:
    """A saved response has been parsed into postings; ok means complete and parsed."""
    conn.execute(
        "UPDATE fetches SET ok = ?, item_count = ?, error = ?, processed_at = ? WHERE fetch_id = ?",
        (int(ok), item_count, error, _timestamp(processed_at), fetch_id),
    )


@dataclass(frozen=True, slots=True)
class BoardFetch:
    fetch_id: int
    board_id: int
    ok: bool
    processed_at: str | None


def board_fetches(conn: sqlite3.Connection, run_id: int) -> list[BoardFetch]:
    """This run's fetches of whole boards (target is the slug), not requests for one job."""
    rows = conn.execute(
        "SELECT f.fetch_id, f.board_id, f.ok, f.processed_at FROM fetches f "
        "JOIN boards b ON b.board_id = f.board_id AND b.slug = f.target "
        "WHERE f.run_id = ? ORDER BY f.fetch_id",
        (run_id,),
    )
    return [
        BoardFetch(
            fetch_id=row["fetch_id"],
            board_id=row["board_id"],
            ok=bool(row["ok"]),
            processed_at=row["processed_at"],
        )
        for row in rows
    ]


# --- companies and boards ---------------------------------------------------

# Trailing legal-entity words dropped from the company identity key.
_LEGAL_SUFFIXES = frozenset(
    {"inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation", "co"}
    | {"gmbh", "ag", "sa", "plc", "bv", "pbc", "lp", "llp", "pty"}
)
_NON_WORD = re.compile(r"[\W_]+")


def normalize_company_name(name: str) -> str:
    """The identity key for `companies.name_norm`: 'Stripe, Inc.' → 'stripe'.

    Only an identity key so the same company isn't stored twice; real company
    normalization is Phase 2.
    """
    text = unicodedata.normalize("NFKC", name).casefold().replace(".", "").replace("'", "")
    tokens = _NON_WORD.sub(" ", text).split()
    while len(tokens) > 1 and tokens[-1] in _LEGAL_SUFFIXES:
        tokens.pop()
    if not tokens:
        raise ValueError(f"company name {name!r} has no letters or digits")
    return " ".join(tokens)


def upsert_company(
    conn: sqlite3.Connection, name: str, run_date: date, website: str | None = None
) -> int:
    """Insert a company, or return the existing one with the same identity key.

    The first name and tracking date win; a website is filled in if missing.
    """
    row = conn.execute(
        "INSERT INTO companies (name, name_norm, website, first_tracked_date) "
        "VALUES (?, ?, ?, ?) "
        "ON CONFLICT (name_norm) DO UPDATE SET website = COALESCE(website, excluded.website) "
        "RETURNING company_id",
        (name, normalize_company_name(name), website, run_date.isoformat()),
    ).fetchone()
    return row["company_id"]


def upsert_board(
    conn: sqlite3.Connection,
    board: BoardRef,
    *,
    status: BoardStatus,
    discovered_via: str,
    discovered_date: date,
    company_id: int | None = None,
) -> int:
    """Insert a board, or return the existing one.

    An existing board keeps its status and discovery fields (later milestones
    change status explicitly); only a missing company_id is filled in.
    """
    row = conn.execute(
        "INSERT INTO boards (company_id, ats, region, slug, status, discovered_via, "
        "discovered_date) VALUES (?, ?, ?, ?, ?, ?, ?) "
        "ON CONFLICT (ats, region, slug) DO UPDATE "
        "SET company_id = COALESCE(company_id, excluded.company_id) "
        "RETURNING board_id",
        (
            company_id,
            board.ats,
            board.region,
            board.slug,
            status,
            discovered_via,
            discovered_date.isoformat(),
        ),
    ).fetchone()
    return row["board_id"]


@dataclass(frozen=True, slots=True)
class ActiveBoard:
    board_id: int
    company_id: int | None
    ref: BoardRef


def active_boards(conn: sqlite3.Connection, ats: str | None = None) -> list[ActiveBoard]:
    """Boards to fetch, optionally for one ATS, in a stable order."""
    query = "SELECT board_id, company_id, ats, region, slug FROM boards WHERE status = 'active'"
    params: list[str] = []
    if ats is not None:
        query += " AND ats = ?"
        params.append(ats)
    return [
        ActiveBoard(
            board_id=row["board_id"],
            company_id=row["company_id"],
            ref=BoardRef(ats=row["ats"], region=row["region"], slug=row["slug"]),
        )
        for row in conn.execute(query + " ORDER BY ats, region, slug", params)
    ]


def record_board_success(conn: sqlite3.Connection, board_id: int, run_date: date) -> None:
    """The board answered with a complete response. The first one starts its tracking."""
    day = run_date.isoformat()
    conn.execute(
        "UPDATE boards SET last_ok_date = ?, first_tracked_date = COALESCE(first_tracked_date, ?), "
        "consecutive_failures = 0 WHERE board_id = ?",
        (day, day, board_id),
    )


def record_board_failure(conn: sqlite3.Connection, board_id: int) -> None:
    conn.execute(
        "UPDATE boards SET consecutive_failures = consecutive_failures + 1 WHERE board_id = ?",
        (board_id,),
    )


def zero_job_streak(conn: sqlite3.Connection, board_id: int, before: date) -> list[date]:
    """The run dates before `before` on which this board last returned no jobs, oldest first.

    Walks back from `before` and stops at the latest date the board returned
    jobs. A failed fetch has no item_count, so it neither adds to the streak nor
    ends it. If a date has several fetches, its latest answer counts. Only fetches
    of the board itself count (their target is the slug), not requests for one job.
    """
    rows = conn.execute(
        "SELECT r.run_date, f.item_count FROM fetches f "
        "JOIN runs r ON r.run_id = f.run_id "
        "JOIN boards b ON b.board_id = f.board_id AND b.slug = f.target "
        "WHERE f.board_id = ? AND f.item_count IS NOT NULL AND r.run_date < ? "
        "ORDER BY r.run_date DESC, f.fetch_id DESC",
        (board_id, before.isoformat()),
    )
    streak: list[date] = []
    seen_dates: set[str] = set()
    for row in rows:
        if row["run_date"] in seen_dates:
            continue
        seen_dates.add(row["run_date"])
        if row["item_count"] > 0:
            break
        streak.append(date.fromisoformat(row["run_date"]))
    streak.reverse()
    return streak


# --- descriptions and postings ------------------------------------------------


def store_description(conn: sqlite3.Connection, text: str) -> str:
    """Store plain text once per normalized content and return its hash."""
    text = normalize_text(text)
    digest = description_hash(text)
    conn.execute(
        "INSERT OR IGNORE INTO descriptions (description_hash, text_zlib) VALUES (?, ?)",
        (digest, compress(text)),
    )
    return digest


def _plain_description(record: PostingRecord) -> str | None:
    if record.description_html is not None:
        text = html_to_text(record.description_html)
    elif record.description_text is not None:
        text = normalize_text(record.description_text)
    else:
        return None
    return text or None


@dataclass(frozen=True, slots=True)
class UpsertResult:
    posting_id: int
    is_new: bool
    # The tracked fields (title, description, locations, salary text) differ
    # from what was stored before this call. Always False for a new posting.
    changed: bool


# Fields whose changes are logged in posting_versions.
_VERSIONED = ("title", "description_hash", "locations_raw", "salary_raw")


def upsert_posting(
    conn: sqlite3.Connection,
    record: PostingRecord,
    *,
    run_date: date,
    parser_version: str,
    archive_hash: str | None = None,
    board_id: int | None = None,
    company_id: int | None = None,
) -> UpsertResult:
    """Insert or update a posting, its description, and its change log.

    Re-running the same record on the same day changes nothing. Upserts for a
    posting must arrive in run_date order.
    """
    day = run_date.isoformat()
    existing = conn.execute(
        "SELECT posting_id, last_seen_date FROM postings WHERE source = ? AND native_id = ?",
        (record.source, record.native_id),
    ).fetchone()
    if existing is not None and day < existing["last_seen_date"]:
        raise ValueError(
            f"posting {record.source}/{record.native_id} was last seen on "
            f"{existing['last_seen_date']}; can't upsert an older run_date {day}"
        )

    description = _plain_description(record)
    fields: dict[str, Any] = {
        "snapshot": int(record.snapshot),
        "board_id": board_id,
        "company_id": company_id,
        "company_name_raw": record.company_name_raw,
        "title": record.title,
        "department_raw": record.department_raw,
        "locations_raw": _json(record.locations_raw),
        "workplace_raw": record.workplace_raw,
        "employment_type_raw": record.employment_type_raw,
        "salary_min": record.salary_min,
        "salary_max": record.salary_max,
        "salary_currency": record.salary_currency,
        "salary_period": record.salary_period,
        "salary_raw": record.salary_raw,
        "description_hash": store_description(conn, description) if description else None,
        "apply_url": record.apply_url,
        "source_url": record.source_url,
        "ats_ref": record.ats_ref,
        "extra_json": _json(record.extra) if record.extra else None,
        "parser_version": parser_version,
        "archive_hash": archive_hash,
        "posted_at": record.posted_at,
        "source_updated_at": record.source_updated_at,
    }
    if existing is None:
        columns = ["source", "native_id", *fields, "first_seen_date", "last_seen_date"]
        values = [record.source, record.native_id, *fields.values(), day, day]
        row = conn.execute(
            f"INSERT INTO postings ({', '.join(columns)}) "
            f"VALUES ({', '.join('?' * len(columns))}) RETURNING posting_id",
            values,
        ).fetchone()
        posting_id = row["posting_id"]
    else:
        posting_id = existing["posting_id"]
        assignments = ", ".join(f"{column} = ?" for column in fields)
        conn.execute(
            f"UPDATE postings SET {assignments}, last_seen_date = ? WHERE posting_id = ?",
            [*fields.values(), day, posting_id],
        )

    changed = _record_version(conn, posting_id, day, tuple(fields[f] for f in _VERSIONED))
    return UpsertResult(
        posting_id, is_new=existing is None, changed=changed and existing is not None
    )


def _record_version(
    conn: sqlite3.Connection, posting_id: int, day: str, content: tuple[Any, ...]
) -> bool:
    """Log `content` as of `day` if it differs from the last version.

    Returns whether it differed. A second change on the same day rewrites that
    day's row; a change back to the previous version removes it.
    """
    rows = conn.execute(
        f"SELECT observed_date, {', '.join(_VERSIONED)} FROM posting_versions "
        "WHERE posting_id = ? ORDER BY observed_date DESC LIMIT 2",
        (posting_id,),
    ).fetchall()
    latest = rows[0] if rows else None
    if latest is not None and tuple(latest[f] for f in _VERSIONED) == content:
        return False

    if latest is not None and latest["observed_date"] == day:
        previous = rows[1] if len(rows) > 1 else None
        if previous is not None and tuple(previous[f] for f in _VERSIONED) == content:
            conn.execute(
                "DELETE FROM posting_versions WHERE posting_id = ? AND observed_date = ?",
                (posting_id, day),
            )
            return True
        assignments = ", ".join(f"{f} = ?" for f in _VERSIONED)
        conn.execute(
            f"UPDATE posting_versions SET {assignments} WHERE posting_id = ? AND observed_date = ?",
            (*content, posting_id, day),
        )
        return True

    conn.execute(
        f"INSERT INTO posting_versions (posting_id, observed_date, {', '.join(_VERSIONED)}) "
        f"VALUES (?, ?, {', '.join('?' * len(_VERSIONED))})",
        (posting_id, day, *content),
    )
    return True


# --- spans (PLAN.md §5.3) -----------------------------------------------------
#
# The per-posting state machine. `reconcile.py` decides when to call these: only
# for snapshot boards whose fetch succeeded this run, and not while a board's
# drop to 0 postings is on hold. A posting closes after 2 absences on different
# run_dates; settings.yaml `reconcile.absences_to_close` documents that number,
# and pending_absent_date can only count to 2.


class SpanEvent(StrEnum):
    OPENED = "opened"  # first span for this posting
    REOPENED = "reopened"  # new span after a closed one: a repost
    SEEN = "seen"  # open span confirmed; any pending absence cleared
    PENDING = "pending"  # first absence recorded, awaiting confirmation
    CLOSED = "closed"  # second absence on a later run_date closed the span
    UNCHANGED = "unchanged"  # same-day re-run, or absent with no open span


def _open_span(conn: sqlite3.Connection, posting_id: int) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT open_date, pending_absent_date FROM posting_spans "
        "WHERE posting_id = ? AND close_date IS NULL",
        (posting_id,),
    ).fetchone()


def open_posting_ids(conn: sqlite3.Connection, board_id: int) -> set[int]:
    """The board's postings that have an open span."""
    rows = conn.execute(
        "SELECT p.posting_id FROM postings p "
        "JOIN posting_spans s ON s.posting_id = p.posting_id "
        "WHERE p.board_id = ? AND s.close_date IS NULL",
        (board_id,),
    )
    return {row["posting_id"] for row in rows}


def mark_present(conn: sqlite3.Connection, posting_id: int, run_date: date) -> SpanEvent:
    """Record that a successful fetch on `run_date` included the posting."""
    span = _open_span(conn, posting_id)
    if span is not None:
        if span["pending_absent_date"] is not None:
            conn.execute(
                "UPDATE posting_spans SET pending_absent_date = NULL "
                "WHERE posting_id = ? AND open_date = ?",
                (posting_id, span["open_date"]),
            )
        return SpanEvent.SEEN

    had_spans = conn.execute(
        "SELECT 1 FROM posting_spans WHERE posting_id = ? LIMIT 1", (posting_id,)
    ).fetchone()
    conn.execute(
        "INSERT INTO posting_spans (posting_id, open_date) VALUES (?, ?)",
        (posting_id, run_date.isoformat()),
    )
    return SpanEvent.REOPENED if had_spans else SpanEvent.OPENED


def mark_absent(conn: sqlite3.Connection, posting_id: int, run_date: date) -> SpanEvent:
    """Record that a successful fetch on `run_date` did not include the posting.

    The first absence is only pending. A second absence on a later run_date
    closes the span as of the first absent date. A same-day re-run never
    confirms a closure.
    """
    span = _open_span(conn, posting_id)
    if span is None:
        return SpanEvent.UNCHANGED

    day = run_date.isoformat()
    pending = span["pending_absent_date"]
    if pending is None:
        conn.execute(
            "UPDATE posting_spans SET pending_absent_date = ? "
            "WHERE posting_id = ? AND open_date = ?",
            (day, posting_id, span["open_date"]),
        )
        return SpanEvent.PENDING
    if day > pending:
        conn.execute(
            "UPDATE posting_spans SET close_date = pending_absent_date, pending_absent_date = NULL "
            "WHERE posting_id = ? AND open_date = ?",
            (posting_id, span["open_date"]),
        )
        return SpanEvent.CLOSED
    return SpanEvent.UNCHANGED
