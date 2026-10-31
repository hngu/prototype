"""The `jobs` command-line interface.

Commands not built yet are stubs that fail loudly, naming the milestone that
implements them. Commands run against the project in the current directory.
"""

import asyncio
import sqlite3
import subprocess
from contextlib import closing
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Annotated, NoReturn

import typer

from jobinsights.config import (
    ConfigError,
    Settings,
    SourceConfig,
    load_contact_email,
    load_seeds,
    load_sources,
)
from jobinsights.http import PoliteClient, host_limits
from jobinsights.log import configure_logging
from jobinsights.pipeline import CollectResult, collect_boards, sync_seeds
from jobinsights.sources import BOARD_ADAPTERS
from jobinsights.sources.base import BoardAdapter
from jobinsights.store import db
from jobinsights.store.repo import RunStatus

RUN_DATE_FORMAT = "%Y-%m-%d"
_EXIT_CODES: dict[RunStatus, int] = {"ok": 0, "partial": 1, "failed": 2}

app = typer.Typer(no_args_is_help=True, help="Collect and store software-engineering job postings.")
db_app = typer.Typer(no_args_is_help=True, help="Manage the SQLite and DuckDB databases.")
app.add_typer(db_app, name="db")


def _not_implemented(command: str, milestone: str) -> NoReturn:
    typer.echo(f"`jobs {command}` is not implemented yet (Milestone {milestone}).", err=True)
    raise typer.Exit(code=1)


def _migrate_databases(settings: Settings) -> None:
    targets = [
        (settings.paths.jobs_db, db.MIGRATIONS_DIR),
        (settings.paths.archive_db, db.ARCHIVE_MIGRATIONS_DIR),
    ]
    for path, migrations_dir in targets:
        try:
            with closing(db.connect(path)) as conn:
                applied = db.migrate(conn, migrations_dir)
        except db.MigrationError as exc:
            typer.echo(f"{path.name}: {exc}", err=True)
            raise typer.Exit(code=1) from exc
        outcome = f"applied {', '.join(applied)}" if applied else "up to date"
        typer.echo(f"{path.name}: {outcome}")


@db_app.command("init")
def db_init() -> None:
    """Create data/jobs.sqlite and data/archive.sqlite and apply all migrations."""
    settings = Settings.load()
    for directory in (
        settings.paths.jobs_db.parent,
        settings.paths.archive_db.parent,
        settings.paths.exports_dir,
        settings.paths.reports_dir,
        settings.paths.backups_dir,
        settings.paths.logs_dir,
    ):
        directory.mkdir(parents=True, exist_ok=True)
    _migrate_databases(settings)


@db_app.command("migrate")
def db_migrate() -> None:
    """Apply pending migrations to both databases."""
    settings = Settings.load()
    missing = [p for p in (settings.paths.jobs_db, settings.paths.archive_db) if not p.exists()]
    if missing:
        names = ", ".join(p.name for p in missing)
        typer.echo(f"{names} not found; run `jobs db init` first.", err=True)
        raise typer.Exit(code=1)
    _migrate_databases(settings)


def _echo_counts(counts: dict[str, int]) -> None:
    width = max((len(table) for table in counts), default=0)
    for table, rows in counts.items():
        typer.echo(f"  {table:<{width}}  {rows:>9,}")


@db_app.command("build-duckdb")
def db_build_duckdb() -> None:
    """Rebuild data/jobs.duckdb from SQLite."""
    import duckdb  # deferred: only these commands need it

    from jobinsights.store.duckdb_build import build_duckdb

    settings = Settings.load()
    if not settings.paths.jobs_db.exists():
        typer.echo(f"{settings.paths.jobs_db.name} not found; run `jobs db init` first.", err=True)
        raise typer.Exit(code=1)
    try:
        counts = build_duckdb(settings.paths.jobs_db, settings.paths.duckdb)
    except duckdb.Error as exc:
        typer.echo(f"DuckDB build failed: {exc}", err=True)
        raise typer.Exit(code=1) from exc
    typer.echo(f"{settings.paths.duckdb.name}: rebuilt {len(counts)} tables")
    _echo_counts(counts)


@db_app.command("export")
def db_export() -> None:
    """Write one Parquet file per table to data/exports/."""
    from jobinsights.store.duckdb_build import export_parquet

    settings = Settings.load()
    if not settings.paths.duckdb.exists():
        typer.echo(
            f"{settings.paths.duckdb.name} not found; run `jobs db build-duckdb` first.", err=True
        )
        raise typer.Exit(code=1)
    counts = export_parquet(settings.paths.duckdb, settings.paths.exports_dir)
    typer.echo(f"{settings.paths.exports_dir}: wrote {len(counts)} Parquet files")
    _echo_counts(counts)


@app.command()
def collect(
    source: Annotated[
        str, typer.Option(help="A board source from config/sources.yaml, or `boards` for all.")
    ],
    force: Annotated[
        bool, typer.Option("--force", help="Fetch every board again, even if already done today.")
    ] = False,
) -> None:
    """Fetch company job boards, archive every response, then parse into SQLite.

    Running it again the same day only retries the boards that failed.
    """
    settings = Settings.load()
    sources = load_sources(settings.root)
    adapters = _adapters_for(source, sources)
    missing = [p for p in (settings.paths.jobs_db, settings.paths.archive_db) if not p.exists()]
    if missing:
        names = ", ".join(p.name for p in missing)
        typer.echo(f"{names} not found; run `jobs db init` first.", err=True)
        raise typer.Exit(code=1)
    try:
        contact_email = load_contact_email(settings.root)
        seeds = load_seeds(settings.root)
    except ConfigError as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(code=1) from exc

    configure_logging()
    run_date = datetime.now(UTC).date()
    with (
        closing(db.connect(settings.paths.jobs_db)) as jobs_conn,
        closing(db.connect(settings.paths.archive_db)) as archive_conn,
    ):
        pending = [
            *db.pending_migrations(jobs_conn, db.MIGRATIONS_DIR),
            *db.pending_migrations(archive_conn, db.ARCHIVE_MIGRATIONS_DIR),
        ]
        if pending:
            typer.echo(
                f"Pending migrations ({', '.join(pending)}); run `jobs db migrate` first.", err=True
            )
            raise typer.Exit(code=1)
        sync_seeds(jobs_conn, seeds, run_date)
        result = asyncio.run(
            _run_collection(
                jobs_conn, archive_conn, settings, sources, adapters, contact_email, run_date, force
            )
        )
    _echo_collection(result)
    raise typer.Exit(code=_EXIT_CODES[result.status])


def _adapters_for(source: str, sources: dict[str, SourceConfig]) -> dict[str, BoardAdapter]:
    """The enabled board adapters a `--source` value selects. Exits if there are none."""
    if source == "boards":
        return {name: a for name, a in BOARD_ADAPTERS.items() if sources[name].enabled}
    if source not in sources:
        typer.echo(f"Unknown source {source!r}; see config/sources.yaml.", err=True)
        raise typer.Exit(code=1)
    if not sources[source].enabled:
        typer.echo(f"Source {source!r} is disabled in config/sources.yaml.", err=True)
        raise typer.Exit(code=1)
    if source not in BOARD_ADAPTERS:
        typer.echo(f"Source {source!r} has no board adapter yet.", err=True)
        raise typer.Exit(code=1)
    return {source: BOARD_ADAPTERS[source]}


async def _run_collection(
    jobs_conn: sqlite3.Connection,
    archive_conn: sqlite3.Connection,
    settings: Settings,
    sources: dict[str, SourceConfig],
    adapters: dict[str, BoardAdapter],
    contact_email: str,
    run_date: date,
    force: bool,
) -> CollectResult:
    limits = host_limits(sources[name] for name in adapters)
    async with PoliteClient(settings.http, contact_email, limits) as client:
        return await collect_boards(
            jobs_conn=jobs_conn,
            archive_conn=archive_conn,
            client=client,
            adapters=adapters,
            sources=sources,
            settings=settings,
            run_date=run_date,
            now=lambda: datetime.now(UTC),
            force=force,
            git_sha=_git_sha(),
        )


def _git_sha() -> str | None:
    try:
        output = subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    return output.stdout.strip()


def _echo_collection(result: CollectResult) -> None:
    if result.nothing_to_do:
        if not any(counts.boards_already_done for counts in result.sources.values()):
            typer.echo("No active boards; add some to config/seeds.yaml.")
            return
        typer.echo(f"{result.run_date}: nothing to do; every board already has a response today.")
    typer.echo(f"Run {result.run_date}: {result.status}")
    for name, counts in result.sources.items():
        typer.echo(
            f"  {name}: {counts.boards_ok} boards ok, {counts.boards_failed} failed, "
            f"{counts.boards_already_done} already done, {counts.retries} retries"
        )
        typer.echo(
            f"    {counts.items:,} jobs: {counts.new:,} new, {counts.changed:,} changed, "
            f"{counts.reopened:,} reposted, {counts.pending:,} missing, {counts.closed:,} closed"
        )
        typer.echo(f"    {counts.objects_stored:,} new archive objects")
        if counts.pay_lookups:
            typer.echo(
                f"    {counts.pay_lookups:,} pay lookups: {counts.pay_found:,} found pay, "
                f"{counts.pay_failed:,} failed"
            )
        if counts.parse_errors or counts.held or counts.released:
            typer.echo(
                f"    {counts.parse_errors:,} parse errors, {counts.held:,} boards held, "
                f"{counts.released:,} holds released"
            )
    if result.failed_boards:
        typer.echo(f"  Still failing: {', '.join(result.failed_boards)}")


@app.command()
def discover(
    from_db: Annotated[
        bool, typer.Option("--from-db", help="Scan stored URLs and HN text for ATS boards.")
    ] = False,
    from_file: Annotated[
        Path | None, typer.Option("--from-file", help="A file of URLs, one per line.")
    ] = None,
) -> None:
    """Find and validate new company job boards."""
    _not_implemented("discover", "3")


@app.command()
def daily(
    force: Annotated[
        bool, typer.Option("--force", help="Run again even if today's run already finished.")
    ] = False,
) -> None:
    """Run the full daily pipeline."""
    _not_implemented("daily", "2.5")


@app.command()
def reprocess(
    from_date: Annotated[
        datetime, typer.Option("--from", formats=[RUN_DATE_FORMAT], help="First run_date.")
    ],
    to_date: Annotated[
        datetime, typer.Option("--to", formats=[RUN_DATE_FORMAT], help="Last run_date.")
    ],
    rebuild_spans: Annotated[
        bool, typer.Option("--rebuild-spans", help="Replay manifests to rebuild open spans.")
    ] = False,
    apply: Annotated[
        bool, typer.Option("--apply", help="Write the result; the default is a dry-run diff.")
    ] = False,
) -> None:
    """Re-parse archived responses with the current parsers (dry run by default)."""
    _not_implemented("reprocess", "5")


@app.command()
def status() -> None:
    """Show the last run, counts per source and active boards."""
    _not_implemented("status", "2.5")
