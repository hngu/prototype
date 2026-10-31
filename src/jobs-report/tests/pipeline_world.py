"""A harness for testing collections: two real databases, mocked HTTP and fake sleeping."""

import asyncio
import random
import sqlite3
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import httpx
import respx

from jobinsights.config import Settings, load_sources
from jobinsights.http import PoliteClient, host_limits
from jobinsights.models import BoardRef
from jobinsights.pipeline import CollectResult, collect_boards
from jobinsights.sources import BOARD_ADAPTERS
from jobinsights.store import db, repo

PROJECT_ROOT = Path(__file__).parent.parent
FIXTURES = PROJECT_ROOT / "tests" / "fixtures"
SETTINGS = Settings.load(PROJECT_ROOT)
SOURCES = load_sources(PROJECT_ROOT)
ACME_URL = "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true"
OTHER_URL = "https://boards-api.greenhouse.io/v1/boards/other/jobs?content=true"
ALL_JOBS_TABLES = (
    "runs",
    "companies",
    "boards",
    "fetches",
    "descriptions",
    "postings",
    "posting_spans",
    "posting_versions",
)
ALL_ARCHIVE_TABLES = ("raw_objects", "manifests")


def day(n: int) -> date:
    return date(2026, 10, n)


def gh_job(job_id: int, title: str = "Backend Engineer") -> dict[str, Any]:
    return {
        "id": job_id,
        "title": title,
        "company_name": "Acme",
        "content": f"&lt;p&gt;Job {job_id}&lt;/p&gt;",
        "absolute_url": f"https://acme.test/jobs?gh_jid={job_id}",
        "location": {"name": "Remote"},
        "first_published": "2026-09-01T10:00:00-04:00",
        "updated_at": "2026-09-02T10:00:00-04:00",
    }


def gh_body(*job_ids: int) -> dict[str, Any]:
    return {"jobs": [gh_job(n) for n in job_ids], "meta": {"total": len(job_ids)}}


def ok(*job_ids: int) -> httpx.Response:
    return httpx.Response(200, json=gh_body(*job_ids))


class World:
    """Two real databases and the collection, with time and sleeping faked."""

    def __init__(self, tmp_path: Path, respx_mock: respx.MockRouter) -> None:
        self.jobs = db.connect(tmp_path / "jobs.sqlite")
        db.migrate(self.jobs, db.MIGRATIONS_DIR)
        self.archive = db.connect(tmp_path / "archive.sqlite")
        db.migrate(self.archive, db.ARCHIVE_MIGRATIONS_DIR)
        self.router = respx_mock
        self.sleeps: list[float] = []
        self.board_ids: dict[str, int] = {}
        self.adapters: dict[str, Any] = dict(BOARD_ADAPTERS)

    def close(self) -> None:
        self.jobs.close()
        self.archive.close()

    def add_board(self, slug: str, ats: str = "greenhouse", region: str = "default") -> int:
        with self.jobs:
            company_id = repo.upsert_company(self.jobs, slug.title(), day(1))
            board_id = repo.upsert_board(
                self.jobs,
                BoardRef(ats=ats, region=region, slug=slug),
                status="active",
                discovered_via="seed",
                discovered_date=day(1),
                company_id=company_id,
            )
        self.board_ids[slug] = board_id
        return board_id

    def route(self, url: str, *responses: httpx.Response | Exception) -> respx.Route:
        """Mock `url`. One response repeats forever; several are used in order."""
        route = self.router.get(url)
        if len(responses) == 1 and isinstance(responses[0], httpx.Response):
            return route.mock(return_value=responses[0])
        return route.mock(side_effect=list(responses))

    def collect(
        self, on: date, *, force: bool = False, retries: int | None = None, pay_cap: int = 0
    ) -> CollectResult:
        """One collection. Pay lookups are off unless a test asks, via `pay_cap`."""
        caps = SETTINGS.caps.model_copy(update={"greenhouse_pay_enrichment_per_run": pay_cap})
        settings = SETTINGS.model_copy(update={"caps": caps})

        def now() -> datetime:
            return datetime(on.year, on.month, on.day, 6, tzinfo=UTC)

        if retries is not None:
            collect_settings = SETTINGS.collect.model_copy(update={"retries": retries})
            settings = settings.model_copy(update={"collect": collect_settings})

        async def fake_sleep(seconds: float) -> None:
            self.sleeps.append(seconds)

        async def go() -> CollectResult:
            # No retries inside the client unless a test asks: each request is one attempt.
            http = SETTINGS.http.model_copy(update={"max_retries": 0})
            limits = host_limits(SOURCES[name] for name in BOARD_ADAPTERS)
            for limit in limits:
                limits[limit] = limits[limit].model_copy(update={"requests_per_minute": None})
            async with PoliteClient(
                http, "jobs@acme.test", limits, now=now, sleep=fake_sleep
            ) as client:
                return await collect_boards(
                    jobs_conn=self.jobs,
                    archive_conn=self.archive,
                    client=client,
                    adapters=self.adapters,
                    sources=SOURCES,
                    settings=settings,
                    run_date=on,
                    now=now,
                    force=force,
                    sleep=fake_sleep,
                    rng=random.Random(0),
                )

        return asyncio.run(go())

    def spans(self, native_id: str, source: str = "greenhouse") -> list[tuple[Any, ...]]:
        rows = self.jobs.execute(
            "SELECT s.open_date, s.close_date, s.pending_absent_date FROM posting_spans s "
            "JOIN postings p USING (posting_id) WHERE p.source = ? AND p.native_id = ? "
            "ORDER BY s.open_date",
            (source, native_id),
        )
        return [tuple(row) for row in rows]

    def fetches(self, slug: str = "acme") -> list[sqlite3.Row]:
        return self.jobs.execute(
            "SELECT * FROM fetches WHERE target = ? ORDER BY fetch_id", (slug,)
        ).fetchall()

    def manifest(self, fetch_id: int) -> sqlite3.Row:
        return self.archive.execute(
            "SELECT * FROM manifests WHERE fetch_id = ?", (fetch_id,)
        ).fetchone()

    def run_row(self, on: date) -> sqlite3.Row:
        return self.jobs.execute(
            "SELECT * FROM runs WHERE run_date = ?", (on.isoformat(),)
        ).fetchone()

    def board_row(self, slug: str = "acme") -> sqlite3.Row:
        return self.jobs.execute(
            "SELECT * FROM boards WHERE board_id = ?", (self.board_ids[slug],)
        ).fetchone()

    def assert_every_fetch_has_a_manifest(self) -> None:
        fetch_ids = {row[0] for row in self.jobs.execute("SELECT fetch_id FROM fetches")}
        manifest_ids = {row[0] for row in self.archive.execute("SELECT fetch_id FROM manifests")}
        assert fetch_ids == manifest_ids

    def snapshot(self, jobs_tables: tuple[str, ...], archive_tables: tuple[str, ...]) -> list[Any]:
        rows: list[Any] = []
        for conn, tables in ((self.jobs, jobs_tables), (self.archive, archive_tables)):
            for table in tables:
                rows.append([tuple(row) for row in conn.execute(f"SELECT * FROM {table}")])
        return rows
