"""The raw archive: what each source returned, saved before parsing (PLAN.md §5.4).

Each job object is stored once per content hash in `raw_objects`; each fetch
gets a manifest listing which objects it returned, in order, plus the rest of
the response (the envelope). Failed fetches get a manifest too, so a replay
can tell an outage from an empty board.
"""

import hashlib
import json
import sqlite3
import zlib
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

ObjectKind = Literal["item", "detail", "response"]

# Query parameters whose values are secrets (CLAUDE.md rule 11).
SECRET_PARAMS = frozenset({"app_id", "app_key", "api_key", "key", "token"})
REDACTED = "REDACTED"
ERROR_BODY_LIMIT = 64 * 1024


class ArchiveError(RuntimeError):
    """The archive is inconsistent, e.g. a manifest references a missing object."""


@dataclass(frozen=True, slots=True)
class ArchiveItem:
    """One object to archive: a job as the source returned it, or a whole body."""

    native_id: str | None
    body: Any
    kind: ObjectKind = "item"


@dataclass(frozen=True, slots=True)
class ArchivedItem:
    native_id: str | None
    hash: str
    kind: ObjectKind
    body: Any


@dataclass(frozen=True, slots=True)
class ArchivedFetch:
    fetch_id: int
    run_date: date
    source: str
    target: str
    request_url: str
    ok: bool
    http_status: int | None
    envelope: Any
    items: list[ArchivedItem]
    error_body: bytes | None


@dataclass(frozen=True, slots=True)
class ManifestSummary:
    fetch_id: int
    run_date: date
    source: str
    target: str
    ok: bool


@dataclass(frozen=True, slots=True)
class PruneResult:
    cutoff: date  # oldest run_date kept
    manifests_deleted: int
    objects_deleted: int


def canonical_json(obj: Any) -> str:
    """Sorted keys, no whitespace: the same content always gives the same text."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def object_hash(obj: Any, hash_exclude: Iterable[str] = ()) -> str:
    """sha256 of the canonical JSON, ignoring the top-level `hash_exclude` keys.

    Excluded keys are volatile fields a source changes on every request; they're
    left out of the hash only (sources.yaml `hash_exclude`).
    """
    excluded = frozenset(hash_exclude)
    if excluded and isinstance(obj, dict):
        obj = {key: value for key, value in obj.items() if key not in excluded}
    return hashlib.sha256(canonical_json(obj).encode("utf-8")).hexdigest()


def redact_url(url: str) -> str:
    """Replace the values of secret query parameters with REDACTED."""
    parts = urlsplit(url)
    if not parts.query:
        return url
    query = [
        (name, REDACTED if name.lower() in SECRET_PARAMS else value)
        for name, value in parse_qsl(parts.query, keep_blank_values=True)
    ]
    return urlunsplit(parts._replace(query=urlencode(query)))


def _pack(obj: Any) -> bytes:
    return zlib.compress(canonical_json(obj).encode("utf-8"), level=9)


def _unpack(blob: bytes) -> Any:
    return json.loads(zlib.decompress(blob))


def write_manifest(
    conn: sqlite3.Connection,
    *,
    fetch_id: int,
    run_date: date,
    source: str,
    target: str,
    request_url: str,
    ok: bool,
    http_status: int | None,
    envelope: Any = None,
    items: Sequence[ArchiveItem] = (),
    error_body: bytes | str | None = None,
    hash_exclude: Iterable[str] = (),
) -> list[str]:
    """Archive one fetch and commit, before anything is parsed (CLAUDE.md rule 6).

    Returns the object hashes in item order. An object already stored keeps its
    first body and has its `last_referenced_date` moved forward.
    """
    day = run_date.isoformat()
    excluded = frozenset(hash_exclude)
    if isinstance(error_body, str):
        error_body = error_body.encode("utf-8")

    hashes: list[str] = []
    with conn:
        for item in items:
            digest = object_hash(item.body, excluded)
            updated = conn.execute(
                "UPDATE raw_objects SET last_referenced_date = max(last_referenced_date, ?) "
                "WHERE hash = ?",
                (day, digest),
            )
            if updated.rowcount == 0:
                conn.execute(
                    "INSERT INTO raw_objects (hash, source, kind, body_zlib, first_stored_date, "
                    "last_referenced_date) VALUES (?, ?, ?, ?, ?, ?)",
                    (digest, source, item.kind, _pack(item.body), day, day),
                )
            hashes.append(digest)

        refs = [[item.native_id, digest] for item, digest in zip(items, hashes, strict=True)]
        conn.execute(
            "INSERT INTO manifests (fetch_id, run_date, source, target, request_url, ok, "
            "http_status, envelope_zlib, items_zlib, error_body_zlib) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                fetch_id,
                day,
                source,
                target,
                redact_url(request_url),
                int(ok),
                http_status,
                _pack(envelope) if envelope is not None else None,
                _pack(refs),
                zlib.compress(error_body[:ERROR_BODY_LIMIT]) if error_body is not None else None,
            ),
        )
    return hashes


def read_fetch(conn: sqlite3.Connection, fetch_id: int) -> ArchivedFetch | None:
    """Read a fetch back as envelope + items, in response order; None if not archived."""
    manifest = conn.execute("SELECT * FROM manifests WHERE fetch_id = ?", (fetch_id,)).fetchone()
    if manifest is None:
        return None

    refs: list[list[str | None]] = _unpack(manifest["items_zlib"])
    hashes = [digest for _, digest in refs]
    objects = {
        row["hash"]: row
        for row in conn.execute(
            "SELECT hash, kind, body_zlib FROM raw_objects "
            "WHERE hash IN (SELECT value FROM json_each(?))",
            (json.dumps(hashes),),
        )
    }
    missing = sorted(set(hashes) - objects.keys())
    if missing:
        raise ArchiveError(f"fetch {fetch_id} references {len(missing)} missing objects")

    items = [
        ArchivedItem(
            native_id=native_id,
            hash=digest,
            kind=objects[digest]["kind"],
            body=_unpack(objects[digest]["body_zlib"]),
        )
        for native_id, digest in refs
    ]
    error_blob = manifest["error_body_zlib"]
    return ArchivedFetch(
        fetch_id=manifest["fetch_id"],
        run_date=date.fromisoformat(manifest["run_date"]),
        source=manifest["source"],
        target=manifest["target"],
        request_url=manifest["request_url"],
        ok=bool(manifest["ok"]),
        http_status=manifest["http_status"],
        envelope=_unpack(manifest["envelope_zlib"]) if manifest["envelope_zlib"] else None,
        items=items,
        error_body=zlib.decompress(error_blob) if error_blob is not None else None,
    )


def iter_manifests(
    conn: sqlite3.Connection, date_from: date, date_to: date, source: str | None = None
) -> Iterator[ManifestSummary]:
    """Manifests with date_from <= run_date <= date_to, oldest first."""
    query = (
        "SELECT fetch_id, run_date, source, target, ok FROM manifests "
        "WHERE run_date BETWEEN ? AND ?"
    )
    params: list[Any] = [date_from.isoformat(), date_to.isoformat()]
    if source is not None:
        query += " AND source = ?"
        params.append(source)
    for row in conn.execute(query + " ORDER BY run_date, fetch_id", params):
        yield ManifestSummary(
            fetch_id=row["fetch_id"],
            run_date=date.fromisoformat(row["run_date"]),
            source=row["source"],
            target=row["target"],
            ok=bool(row["ok"]),
        )


def count_objects(conn: sqlite3.Connection, source: str) -> int:
    row = conn.execute("SELECT count(*) FROM raw_objects WHERE source = ?", (source,)).fetchone()
    return row[0]


def prune(conn: sqlite3.Connection, today: date, retention_days: int) -> PruneResult:
    """Keep the last `retention_days` run dates, today included, and commit.

    Deletes manifests older than the window, then objects no manifest in the
    window references. An object first stored long ago survives as long as a
    manifest inside the window still points to it.
    """
    if retention_days < 1:
        raise ValueError("retention_days must be at least 1")
    cutoff = today - timedelta(days=retention_days - 1)
    with conn:
        manifests = conn.execute(
            "DELETE FROM manifests WHERE run_date < ?", (cutoff.isoformat(),)
        ).rowcount
        objects = conn.execute(
            "DELETE FROM raw_objects WHERE last_referenced_date < ?", (cutoff.isoformat(),)
        ).rowcount
    return PruneResult(cutoff=cutoff, manifests_deleted=manifests, objects_deleted=objects)
