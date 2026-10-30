"""Rebuild data/jobs.duckdb and the Parquet exports from jobs.sqlite.

Both are derived copies for analysis (CLAUDE.md rule 6): they're rebuilt from
scratch every time and nothing else writes to them. DuckDB reads SQLite through
its sqlite extension, which it downloads once and caches in ~/.duckdb.
"""

import os
from contextlib import closing
from pathlib import Path

import duckdb
from duckdb.sqltypes import BLOB, VARCHAR

from jobinsights.descriptions import decompress

# Bookkeeping tables that aren't data.
_SKIPPED_TABLES = frozenset({"schema_migrations"})
# Descriptions are copied as plain text instead of zlib blobs.
_DESCRIPTION_COLUMNS = "description_hash, zlib_inflate(text_zlib) AS text"

# Open postings per day and source, from the open spans. close_date is the
# first day a posting was absent, so the span covers [open_date, close_date).
# Days run from the first span to the latest run.
_VIEWS = """
CREATE VIEW v_open_postings_by_day AS
WITH days AS (
  SELECT CAST(unnest(generate_series(
    (SELECT min(CAST(open_date AS DATE)) FROM posting_spans),
    (SELECT max(CAST(run_date AS DATE)) FROM runs),
    INTERVAL 1 DAY
  )) AS DATE) AS day
)
SELECT days.day, p.source, count(*) AS open_postings
FROM days
JOIN posting_spans AS s
  ON CAST(s.open_date AS DATE) <= days.day
 AND (s.close_date IS NULL OR days.day < CAST(s.close_date AS DATE))
JOIN postings AS p ON p.posting_id = s.posting_id
GROUP BY days.day, p.source;

CREATE VIEW v_new_postings_by_day AS
SELECT CAST(first_seen_date AS DATE) AS day, source, count(*) AS new_postings
FROM postings
GROUP BY ALL;
"""


def _sql_string(path: Path) -> str:
    return "'" + str(path).replace("'", "''") + "'"


def build_duckdb(sqlite_path: Path, duckdb_path: Path) -> dict[str, int]:
    """Rebuild `duckdb_path` from `sqlite_path` and return the row count per table.

    Builds into a temporary file and renames it into place, so readers never
    see a half-built database.
    """
    if not sqlite_path.exists():
        raise FileNotFoundError(sqlite_path)
    tmp_path = duckdb_path.with_name(duckdb_path.name + ".tmp")
    leftovers = [tmp_path, tmp_path.with_name(tmp_path.name + ".wal")]
    for path in leftovers:
        path.unlink(missing_ok=True)

    try:
        with closing(duckdb.connect(tmp_path)) as con:
            con.execute("INSTALL sqlite; LOAD sqlite;")
            con.execute(f"ATTACH {_sql_string(sqlite_path)} AS src (TYPE sqlite, READ_ONLY)")
            # DuckDB has no zlib function; inflate descriptions with the same
            # decompress() that wrote them.
            con.create_function("zlib_inflate", decompress, [BLOB], VARCHAR)
            tables = [
                name
                for (name,) in con.execute(
                    "SELECT table_name FROM duckdb_tables() WHERE database_name = 'src' "
                    "ORDER BY table_name"
                ).fetchall()
                if name not in _SKIPPED_TABLES
            ]
            for table in tables:
                columns = _DESCRIPTION_COLUMNS if table == "descriptions" else "*"
                con.execute(f'CREATE TABLE "{table}" AS SELECT {columns} FROM src."{table}"')
            con.execute(_VIEWS)
            counts = {
                table: con.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]
                for table in tables
            }
            con.execute("DETACH src")
        os.replace(tmp_path, duckdb_path)
    finally:
        for path in leftovers:
            path.unlink(missing_ok=True)
    return counts


def export_parquet(duckdb_path: Path, exports_dir: Path) -> dict[str, int]:
    """Write one Parquet file per table to `exports_dir`; return the row counts.

    Each file is written beside its target and renamed into place.
    """
    if not duckdb_path.exists():
        raise FileNotFoundError(duckdb_path)
    exports_dir.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    with closing(duckdb.connect(duckdb_path, read_only=True)) as con:
        tables = con.execute(
            "SELECT table_name FROM duckdb_tables() WHERE database_name = current_database() "
            "ORDER BY table_name"
        ).fetchall()
        for (table,) in tables:
            target = exports_dir / f"{table}.parquet"
            tmp = target.with_name(target.name + ".tmp")
            con.execute(f'COPY "{table}" TO {_sql_string(tmp)} (FORMAT parquet)')
            os.replace(tmp, target)
            counts[table] = con.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]
    return counts
