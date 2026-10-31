"""DuckDB build and Parquet export against a real DuckDB with its sqlite extension.

Opt in with `uv run pytest -m integration`. The first run downloads the sqlite
extension into ~/.duckdb.
"""

import sqlite3
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import duckdb
import pytest

from jobinsights.descriptions import decompress
from jobinsights.models import BoardRef, PostingRecord
from jobinsights.store import repo
from jobinsights.store.duckdb_build import build_duckdb, export_parquet

pytestmark = pytest.mark.integration

MakeRecord = Callable[..., PostingRecord]


def day(n: int) -> date:
    """Run date n: day(1) is 2026-10-01."""
    return date(2026, 10, 1) + timedelta(days=n - 1)


@pytest.fixture
def populated(jobs_db: sqlite3.Connection, make_record: MakeRecord, tmp_path: Path) -> Path:
    """A jobs.sqlite with four daily runs:

    - greenhouse posting A: open from day 1, absent days 3 and 4 → closed as of day 3
    - greenhouse posting B: open from day 2, still open
    - remotive feed posting C: first seen day 2, no spans (feeds can't close)
    """
    for n in range(1, 5):
        run_id = repo.get_or_start_run(jobs_db, day(n), datetime(2026, 10, n, 6, tzinfo=UTC))
        repo.start_fetch(
            jobs_db, run_id, "greenhouse", "stripe", datetime(2026, 10, n, 6, tzinfo=UTC)
        )
    company_id = repo.upsert_company(jobs_db, "Stripe", day(1))
    board_id = repo.upsert_board(
        jobs_db,
        BoardRef(ats="greenhouse", slug="stripe"),
        status="active",
        discovered_via="seed",
        discovered_date=day(1),
        company_id=company_id,
    )

    def upsert(record: PostingRecord, n: int) -> int:
        return repo.upsert_posting(
            jobs_db, record, run_date=day(n), parser_version="1", board_id=board_id
        ).posting_id

    a = upsert(make_record(native_id="stripe:1"), 1)
    repo.mark_present(jobs_db, a, day(1))
    upsert(make_record(native_id="stripe:1"), 2)
    repo.mark_present(jobs_db, a, day(2))
    repo.mark_absent(jobs_db, a, day(3))
    repo.mark_absent(jobs_db, a, day(4))

    b_record = make_record(
        native_id="stripe:2", title="Data Engineer", description_html="<p>SQL</p>"
    )
    for n in range(2, 5):
        b = upsert(b_record, n)
        repo.mark_present(jobs_db, b, day(n))

    repo.upsert_posting(
        jobs_db,
        make_record(source="remotive", native_id="9001", snapshot=False, board=None),
        run_date=day(2),
        parser_version="1",
    )
    jobs_db.commit()
    return tmp_path / "jobs.sqlite"


def sqlite_counts(path: Path) -> dict[str, int]:
    with sqlite3.connect(path) as conn:
        tables = [
            name
            for (name,) in conn.execute(
                "SELECT name FROM sqlite_schema "
                "WHERE type = 'table' AND name != 'schema_migrations'"
            )
        ]
        return {t: conn.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0] for t in tables}


def test_row_counts_match(populated: Path, tmp_path: Path) -> None:
    duckdb_path = tmp_path / "jobs.duckdb"

    counts = build_duckdb(populated, duckdb_path)

    expected = sqlite_counts(populated)
    assert counts == expected
    with duckdb.connect(duckdb_path, read_only=True) as con:
        for table, rows in expected.items():
            assert con.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0] == rows, table
    assert expected["postings"] == 3  # the fixture really has data


def test_descriptions_are_decompressed(populated: Path, tmp_path: Path) -> None:
    duckdb_path = tmp_path / "jobs.duckdb"
    build_duckdb(populated, duckdb_path)

    with sqlite3.connect(populated) as conn:
        expected = {
            digest: decompress(blob) for digest, blob in conn.execute("SELECT * FROM descriptions")
        }
    with duckdb.connect(duckdb_path, read_only=True) as con:
        actual = dict(con.execute("SELECT description_hash, text FROM descriptions").fetchall())

    assert actual == expected
    assert sorted(actual.values()) == ["Build APIs.", "SQL"]


def test_open_postings_by_day(populated: Path, tmp_path: Path) -> None:
    duckdb_path = tmp_path / "jobs.duckdb"
    build_duckdb(populated, duckdb_path)

    with duckdb.connect(duckdb_path, read_only=True) as con:
        rows = con.execute(
            "SELECT day, source, open_postings FROM v_open_postings_by_day ORDER BY day, source"
        ).fetchall()

    # A counts on days 1-2 and not from day 3 (its close_date); B from day 2 on.
    assert rows == [
        (day(1), "greenhouse", 1),
        (day(2), "greenhouse", 2),
        (day(3), "greenhouse", 1),
        (day(4), "greenhouse", 1),
    ]


def test_new_postings_by_day(populated: Path, tmp_path: Path) -> None:
    duckdb_path = tmp_path / "jobs.duckdb"
    build_duckdb(populated, duckdb_path)

    with duckdb.connect(duckdb_path, read_only=True) as con:
        rows = con.execute(
            "SELECT day, source, new_postings FROM v_new_postings_by_day ORDER BY day, source"
        ).fetchall()

    assert rows == [
        (day(1), "greenhouse", 1),
        (day(2), "greenhouse", 1),
        (day(2), "remotive", 1),
    ]


def test_rebuild_replaces_the_file_and_leaves_no_temp_files(
    populated: Path, tmp_path: Path
) -> None:
    duckdb_path = tmp_path / "jobs.duckdb"
    first = build_duckdb(populated, duckdb_path)

    second = build_duckdb(populated, duckdb_path)

    assert first == second
    assert sorted(p.name for p in tmp_path.glob("jobs.duckdb*")) == ["jobs.duckdb"]


def test_empty_database_builds(jobs_db: sqlite3.Connection, tmp_path: Path) -> None:
    counts = build_duckdb(tmp_path / "jobs.sqlite", tmp_path / "jobs.duckdb")

    assert set(counts.values()) == {0}
    with duckdb.connect(tmp_path / "jobs.duckdb", read_only=True) as con:
        assert con.execute("SELECT count(*) FROM v_open_postings_by_day").fetchone()[0] == 0


def test_export_writes_one_parquet_file_per_table(populated: Path, tmp_path: Path) -> None:
    duckdb_path = tmp_path / "jobs.duckdb"
    built = build_duckdb(populated, duckdb_path)
    exports = tmp_path / "exports"

    exported = export_parquet(duckdb_path, exports)

    assert exported == built
    assert sorted(p.name for p in exports.iterdir()) == sorted(f"{t}.parquet" for t in built)
    with duckdb.connect() as con:
        for table, rows in built.items():
            path = str(exports / f"{table}.parquet")
            assert con.execute("SELECT count(*) FROM read_parquet(?)", [path]).fetchone()[0] == rows
