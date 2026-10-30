import shutil
import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pytest

from jobinsights.store import db

PROJECT_ROOT = Path(__file__).parent.parent


@pytest.fixture
def jobs_db(tmp_path: Path) -> Iterator[sqlite3.Connection]:
    """A migrated, empty jobs.sqlite."""
    conn = db.connect(tmp_path / "jobs.sqlite")
    db.migrate(conn, db.MIGRATIONS_DIR)
    yield conn
    conn.close()


@pytest.fixture
def archive_db(tmp_path: Path) -> Iterator[sqlite3.Connection]:
    """A migrated, empty archive.sqlite."""
    conn = db.connect(tmp_path / "archive.sqlite")
    db.migrate(conn, db.ARCHIVE_MIGRATIONS_DIR)
    yield conn
    conn.close()


@pytest.fixture
def project_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """An empty project with the real config, as the current directory."""
    shutil.copytree(PROJECT_ROOT / "config", tmp_path / "config")
    monkeypatch.chdir(tmp_path)
    return tmp_path
