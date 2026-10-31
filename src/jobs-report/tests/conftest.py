import shutil
import sqlite3
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
import respx

from jobinsights.models import BoardRef, PostingRecord
from jobinsights.store import db
from pipeline_world import World

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


@pytest.fixture
def world(tmp_path: Path, respx_mock: respx.MockRouter) -> Iterator[World]:
    """Two migrated databases and a collection with mocked HTTP; see pipeline_world.py."""
    world = World(tmp_path, respx_mock)
    yield world
    world.close()


MakeRecord = Callable[..., PostingRecord]


@pytest.fixture
def make_record() -> MakeRecord:
    """Build a realistic Greenhouse PostingRecord; keyword arguments override fields."""

    def make(**overrides: Any) -> PostingRecord:
        fields: dict[str, Any] = {
            "source": "greenhouse",
            "native_id": "stripe:123",
            "snapshot": True,
            "board": BoardRef(ats="greenhouse", slug="stripe"),
            "company_name_raw": "Stripe",
            "title": "Backend Engineer",
            "department_raw": "Engineering",
            "locations_raw": ["San Francisco, CA", "Remote (US)"],
            "salary_raw": "$180,000 - $240,000",
            "description_html": "<p>Build <b>APIs</b>.</p>",
            "apply_url": "https://boards.greenhouse.io/stripe/jobs/123",
        }
        return PostingRecord(**(fields | overrides))

    return make
