"""SQLite connections and the numbered-migration runner.

Both databases (jobs.sqlite and archive.sqlite) use the same runner, each with
its own directory of `NNN_name.sql` files. Applied migrations are recorded with
their sha256, so editing one after it ran is caught instead of silently
diverging (CLAUDE.md rule 12).
"""

import hashlib
import re
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
ARCHIVE_MIGRATIONS_DIR = MIGRATIONS_DIR / "archive"

_MIGRATION_FILE = re.compile(r"^(\d{3})_[a-z0-9_]+\.sql$")

_CREATE_BOOKKEEPING = """
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  sha256     TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT
"""


class MigrationError(RuntimeError):
    """The migrations on disk and the ones recorded in the database disagree."""


def connect(path: Path) -> sqlite3.Connection:
    """Open a SQLite database with the project's PRAGMAs."""
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


def migrate(conn: sqlite3.Connection, migrations_dir: Path) -> list[str]:
    """Apply pending migrations in order and return the file names applied."""
    conn.execute(_CREATE_BOOKKEEPING)
    conn.commit()
    rows = conn.execute("SELECT version, name, sha256 FROM schema_migrations")
    applied = {row["version"]: row for row in rows}
    on_disk = _discover(migrations_dir)

    missing = sorted(set(applied) - {version for version, _ in on_disk})
    if missing:
        names = ", ".join(applied[v]["name"] for v in missing)
        raise MigrationError(f"applied migrations are missing from {migrations_dir}: {names}")

    newly_applied: list[str] = []
    for version, path in on_disk:
        body = path.read_bytes()
        digest = hashlib.sha256(body).hexdigest()
        if version in applied:
            if applied[version]["sha256"] != digest or applied[version]["name"] != path.name:
                raise MigrationError(
                    f"{path.name} changed after it was applied; add a new migration instead"
                )
            continue
        _apply(conn, version, path.name, body.decode(), digest)
        newly_applied.append(path.name)
    return newly_applied


def pending_migrations(conn: sqlite3.Connection, migrations_dir: Path) -> list[str]:
    """The file names of migrations not yet applied."""
    conn.execute(_CREATE_BOOKKEEPING)
    conn.commit()
    applied = {row["version"] for row in conn.execute("SELECT version FROM schema_migrations")}
    return [path.name for version, path in _discover(migrations_dir) if version not in applied]


def _discover(migrations_dir: Path) -> list[tuple[int, Path]]:
    found: dict[int, Path] = {}
    for path in sorted(migrations_dir.glob("*.sql")):
        match = _MIGRATION_FILE.match(path.name)
        if match is None:
            raise MigrationError(f"bad migration file name {path.name!r}; expected NNN_name.sql")
        version = int(match.group(1))
        if version in found:
            raise MigrationError(f"two migrations share version {version:03d}")
        found[version] = path
    return sorted(found.items())


def _apply(conn: sqlite3.Connection, version: int, name: str, sql: str, digest: str) -> None:
    applied_at = datetime.now(UTC).isoformat(timespec="seconds")
    # executescript can't take parameters. The values are safe to inline: the
    # name matched _MIGRATION_FILE, the digest is hex and the timestamp is ISO.
    script = (
        f"BEGIN;\n{sql}\n;\n"
        "INSERT INTO schema_migrations (version, name, sha256, applied_at) "
        f"VALUES ({version}, '{name}', '{digest}', '{applied_at}');\n"
        "COMMIT;"
    )
    try:
        conn.executescript(script)
    except sqlite3.Error as exc:
        conn.rollback()
        raise MigrationError(f"{name} failed: {exc}") from exc
