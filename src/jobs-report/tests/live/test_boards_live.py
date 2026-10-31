"""Live checks against the real ATS APIs. Opt in with `uv run pytest -m live`."""

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from jobinsights.config import SeedBoard, Settings, load_contact_email, load_seeds, load_sources
from jobinsights.http import PoliteClient, host_limits
from jobinsights.pipeline import CollectResult, collect_boards, sync_seeds
from jobinsights.sources import BOARD_ADAPTERS
from jobinsights.store import db

pytestmark = pytest.mark.live

PROJECT_ROOT = Path(__file__).parent.parent.parent
SETTINGS = Settings.load(PROJECT_ROOT)
SOURCES = load_sources(PROJECT_ROOT)
# Small boards, so an end-to-end check asks little of each API.
SMALL_BOARDS = [
    SeedBoard(ats="greenhouse", slug="dropbox", name="Dropbox"),
    SeedBoard(ats="lever", slug="outreach", name="Outreach"),
    SeedBoard(ats="ashby", slug="posthog", name="PostHog"),
]


def client() -> PoliteClient:
    limits = host_limits(SOURCES[name] for name in BOARD_ADAPTERS)
    return PoliteClient(SETTINGS.http, load_contact_email(PROJECT_ROOT), limits)


async def check_seed(http: PoliteClient, seed: SeedBoard) -> str | None:
    """A description of what's wrong with this seed, or None if it's fine."""
    adapter = BOARD_ADAPTERS[seed.ats]
    response = await http.get(adapter.request_url(seed.ref, SOURCES[seed.ats]))
    if not response.ok or response.body is None:
        return f"{seed.ats}/{seed.slug}: {response.error}"
    split = adapter.split(json.loads(response.body), seed.ref)
    if not split.items:
        return f"{seed.ats}/{seed.slug}: no jobs"
    for item in split.items:
        try:
            adapter.parse(item.body, split.envelope, seed.ref)
        except Exception as exc:
            return f"{seed.ats}/{seed.slug}: {item.native_id}: {type(exc).__name__}: {exc}"
    return None


def test_every_seed_returns_jobs_that_parse() -> None:
    async def go() -> list[str | None]:
        async with client() as http:
            seeds = load_seeds(PROJECT_ROOT)
            return await asyncio.gather(*(check_seed(http, seed) for seed in seeds))

    assert [problem for problem in asyncio.run(go()) if problem] == []


def test_a_large_lever_board_comes_back_whole_without_paging() -> None:
    async def go() -> tuple[int, int]:
        base = SOURCES["lever"].endpoint.format(slug="shieldai")
        async with client() as http:
            whole = await http.get(base)
            whole_jobs = json.loads(whole.body or b"[]")
            past_the_end = await http.get(f"{base}&skip={len(whole_jobs)}&limit=50")
            return len(whole_jobs), len(json.loads(past_the_end.body or b"[]"))

    count, beyond = asyncio.run(go())

    assert count > 100
    assert beyond == 0


def test_a_collection_works_end_to_end_for_each_ats(tmp_path: Path) -> None:
    jobs_conn = db.connect(tmp_path / "jobs.sqlite")
    archive_conn = db.connect(tmp_path / "archive.sqlite")
    db.migrate(jobs_conn, db.MIGRATIONS_DIR)
    db.migrate(archive_conn, db.ARCHIVE_MIGRATIONS_DIR)
    today = datetime.now(UTC).date()
    sync_seeds(jobs_conn, SMALL_BOARDS, today)
    caps = SETTINGS.caps.model_copy(update={"greenhouse_pay_enrichment_per_run": 2})
    settings = SETTINGS.model_copy(update={"caps": caps})

    async def go() -> CollectResult:
        async with client() as http:
            return await collect_boards(
                jobs_conn=jobs_conn,
                archive_conn=archive_conn,
                client=http,
                adapters=BOARD_ADAPTERS,
                sources=SOURCES,
                settings=settings,
                run_date=today,
                now=lambda: datetime.now(UTC),
            )

    first = asyncio.run(go())
    second = asyncio.run(go())
    fetch_ids = {row[0] for row in jobs_conn.execute("SELECT fetch_id FROM fetches")}
    manifest_ids = {row[0] for row in archive_conn.execute("SELECT fetch_id FROM manifests")}
    postings = jobs_conn.execute("SELECT count(*) FROM postings").fetchone()[0]
    spans = jobs_conn.execute(
        "SELECT count(*) FROM posting_spans WHERE close_date IS NULL"
    ).fetchone()[0]
    jobs_conn.close()
    archive_conn.close()

    assert first.status == "ok"
    for name in BOARD_ADAPTERS:
        assert first.sources[name].boards_ok == 1
        assert first.sources[name].parse_errors == 0
    assert first.sources["greenhouse"].pay_lookups == 2
    assert first.sources["greenhouse"].pay_failed == 0
    assert postings == spans > 0
    assert fetch_ids == manifest_ids
    assert second.nothing_to_do
