"""Record trimmed test fixtures from real boards, through the shared polite client.

    uv run python scripts/record_fixtures.py greenhouse stripe airbnb --jobs 3

Each board is first checked in full: its whole response must split and every job
must parse, so a recording doubles as a check of the adapter against real data.
Only then is it trimmed to a few jobs with short descriptions, and written to
tests/fixtures/<source>/<slug>.json.
"""

import asyncio
import json
from collections.abc import Callable
from pathlib import Path
from typing import Annotated, Any

import typer

from jobinsights.config import Settings, SourceConfig, load_contact_email, load_sources
from jobinsights.http import PoliteClient, host_limits
from jobinsights.models import BoardRef
from jobinsights.sources import BOARD_ADAPTERS
from jobinsights.sources.base import BoardAdapter

FIXTURES_DIR = Path(__file__).parent.parent / "tests" / "fixtures"
DESCRIPTION_CHARS = 1200


def _trim_greenhouse(payload: dict[str, Any], jobs: int) -> dict[str, Any]:
    kept = payload["jobs"][:jobs]
    for job in kept:
        job["content"] = _shorten(job["content"])
    return {**payload, "jobs": kept, "meta": {**payload["meta"], "total": len(kept)}}


def _shorten(text: str) -> str:
    return text[:DESCRIPTION_CHARS]


TRIMMERS: dict[str, Callable[[Any, int], Any]] = {"greenhouse": _trim_greenhouse}


def _check_in_full(adapter: BoardAdapter, payload: Any, board: BoardRef) -> None:
    split = adapter.split(payload, board)
    failures = []
    for item in split.items:
        try:
            adapter.parse(item.body, split.envelope, board)
        except Exception as exc:
            failures.append(f"{item.native_id}: {type(exc).__name__}: {exc}")
    typer.echo(f"{board.slug}: {len(split.items) - len(failures)}/{len(split.items)} jobs parsed")
    for failure in failures[:10]:
        typer.echo(f"  {failure}", err=True)
    if failures:
        raise typer.Exit(code=1)


async def _record(
    adapter: BoardAdapter,
    source: SourceConfig,
    trim: Callable[[Any, int], Any],
    slugs: list[str],
    jobs: int,
) -> None:
    settings = Settings.load()
    async with PoliteClient(settings.http, load_contact_email(), host_limits([source])) as client:
        for slug in slugs:
            board = BoardRef(ats=adapter.NAME, slug=slug)
            response = await client.get(adapter.request_url(board, source))
            if not response.ok or response.body is None:
                typer.echo(f"{slug}: {response.error}", err=True)
                raise typer.Exit(code=1)
            payload = json.loads(response.body)
            _check_in_full(adapter, payload, board)

            path = FIXTURES_DIR / adapter.NAME / f"{slug}.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            text = json.dumps(trim(payload, jobs), indent=2, ensure_ascii=False, sort_keys=True)
            path.write_text(text + "\n")
            typer.echo(f"  wrote {path.relative_to(FIXTURES_DIR.parent.parent)}")


def main(
    source: Annotated[str, typer.Argument(help="A board source, e.g. greenhouse.")],
    slugs: Annotated[list[str], typer.Argument(help="Board slugs to record.")],
    jobs: Annotated[int, typer.Option(help="Jobs to keep per board.")] = 3,
) -> None:
    asyncio.run(
        _record(BOARD_ADAPTERS[source], load_sources()[source], TRIMMERS[source], slugs, jobs)
    )


if __name__ == "__main__":
    typer.run(main)
