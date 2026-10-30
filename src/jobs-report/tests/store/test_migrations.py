import shutil
import sqlite3
from pathlib import Path

import pytest

from jobinsights.store import db

JOBS_TABLES = {
    "runs",
    "companies",
    "boards",
    "fetches",
    "descriptions",
    "postings",
    "posting_spans",
    "posting_versions",
    "hn_comments",
    "quota_usage",
}
ARCHIVE_TABLES = {"raw_objects", "manifests"}


def tables(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("SELECT name FROM sqlite_schema WHERE type = 'table'")
    return {row["name"] for row in rows} - {"schema_migrations"}


def copy_migrations(tmp_path: Path) -> Path:
    target = tmp_path / "migrations"
    target.mkdir()
    for path in db.MIGRATIONS_DIR.glob("*.sql"):
        shutil.copy(path, target)
    return target


def test_fresh_database_gets_every_migration(tmp_path: Path) -> None:
    conn = db.connect(tmp_path / "jobs.sqlite")

    assert db.migrate(conn, db.MIGRATIONS_DIR) == ["001_initial.sql"]
    assert tables(conn) == JOBS_TABLES


def test_second_run_applies_nothing(jobs_db: sqlite3.Connection) -> None:
    assert db.migrate(jobs_db, db.MIGRATIONS_DIR) == []


def test_archive_migrates_from_its_own_directory(archive_db: sqlite3.Connection) -> None:
    assert tables(archive_db) == ARCHIVE_TABLES


def test_edited_migration_is_refused(tmp_path: Path) -> None:
    migrations = copy_migrations(tmp_path)
    conn = db.connect(tmp_path / "jobs.sqlite")
    db.migrate(conn, migrations)

    with (migrations / "001_initial.sql").open("a") as f:
        f.write("\n-- an edit\n")

    with pytest.raises(db.MigrationError, match="changed after it was applied"):
        db.migrate(conn, migrations)


def test_applied_migration_missing_from_disk_is_refused(tmp_path: Path) -> None:
    migrations = copy_migrations(tmp_path)
    conn = db.connect(tmp_path / "jobs.sqlite")
    db.migrate(conn, migrations)

    (migrations / "001_initial.sql").unlink()

    with pytest.raises(db.MigrationError, match="missing"):
        db.migrate(conn, migrations)


def test_bad_file_name_is_refused(tmp_path: Path) -> None:
    (tmp_path / "1_initial.sql").write_text("SELECT 1;")
    conn = db.connect(tmp_path / "jobs.sqlite")

    with pytest.raises(db.MigrationError, match="bad migration file name"):
        db.migrate(conn, tmp_path)


def test_failed_migration_leaves_nothing_behind(tmp_path: Path) -> None:
    (tmp_path / "001_ok.sql").write_text("CREATE TABLE a (x INTEGER) STRICT;")
    (tmp_path / "002_broken.sql").write_text("CREATE TABLE b (x INTEGER) STRICT;\nNOT SQL;")
    conn = db.connect(tmp_path / "test.sqlite")

    with pytest.raises(db.MigrationError, match=r"002_broken\.sql failed"):
        db.migrate(conn, tmp_path)

    assert tables(conn) == {"a"}
    versions = [row["version"] for row in conn.execute("SELECT version FROM schema_migrations")]
    assert versions == [1]


def test_connection_pragmas(jobs_db: sqlite3.Connection) -> None:
    assert jobs_db.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    assert jobs_db.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_strict_table_rejects_wrong_type(jobs_db: sqlite3.Connection) -> None:
    with pytest.raises(sqlite3.IntegrityError, match="cannot store TEXT value in INTEGER"):
        jobs_db.execute(
            "INSERT INTO quota_usage (source, period, calls) VALUES ('adzuna', '2026-10', 'many')"
        )


def test_check_constraint_rejects_unknown_status(jobs_db: sqlite3.Connection) -> None:
    with pytest.raises(sqlite3.IntegrityError, match="CHECK constraint failed"):
        jobs_db.execute(
            "INSERT INTO runs (run_date, started_at, status) "
            "VALUES ('2026-10-29', '2026-10-29T06:00:00+00:00', 'done')"
        )


def test_foreign_key_is_enforced(jobs_db: sqlite3.Connection) -> None:
    with pytest.raises(sqlite3.IntegrityError, match="FOREIGN KEY constraint failed"):
        jobs_db.execute(
            "INSERT INTO fetches (run_id, source, target, started_at, ok) "
            "VALUES (999, 'greenhouse', 'stripe', '2026-10-29T06:00:00+00:00', 0)"
        )
