"""The `jobs` command-line interface.

Commands not built yet are stubs that fail loudly, naming the milestone that
implements them. Commands run against the project in the current directory.
"""

import asyncio
import logging
import sqlite3
import subprocess
import sys
from collections import Counter, defaultdict
from collections.abc import Iterator
from contextlib import closing, contextmanager
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from enum import StrEnum
from pathlib import Path
from typing import Annotated, Any, NoReturn

import typer

from jobinsights import schedule as schedule_files
from jobinsights.config import (
    ConfigError,
    SeedBoard,
    Settings,
    SourceConfig,
    load_contact_email,
    load_seeds,
    load_sources,
)
from jobinsights.http import PoliteClient, host_limits
from jobinsights.log import configure_logging
from jobinsights.pipeline import CollectResult, collect_boards, sync_seeds
from jobinsights.run_lock import RunInProgress, hold_run_lock
from jobinsights.sources import BOARD_ADAPTERS
from jobinsights.sources.base import BoardAdapter
from jobinsights.store import db, repo
from jobinsights.store.repo import RunStatus

logger = logging.getLogger(__name__)

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

    settings = Settings.load()
    if not settings.paths.jobs_db.exists():
        typer.echo(f"{settings.paths.jobs_db.name} not found; run `jobs db init` first.", err=True)
        raise typer.Exit(code=1)
    try:
        _rebuild_duckdb(settings)
    except duckdb.Error as exc:
        typer.echo(f"DuckDB build failed: {exc}", err=True)
        raise typer.Exit(code=1) from exc


def _rebuild_duckdb(settings: Settings) -> None:
    from jobinsights.store.duckdb_build import build_duckdb  # deferred, like duckdb itself

    counts = build_duckdb(settings.paths.jobs_db, settings.paths.duckdb)
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
    plan = _plan_collection(settings, source)
    with _exclusive_run(settings):
        result = _collect(plan, force)
    _echo_collection(result)
    raise typer.Exit(code=_EXIT_CODES[result.status])


@dataclass(frozen=True, slots=True)
class _CollectionPlan:
    settings: Settings
    sources: dict[str, SourceConfig]
    adapters: dict[str, BoardAdapter]
    contact_email: str
    seeds: list[SeedBoard]


def _plan_collection(settings: Settings, source: str) -> _CollectionPlan:
    """Check that a collection can start, and exit with a message if it can't."""
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
    return _CollectionPlan(settings, sources, adapters, contact_email, seeds)


@contextmanager
def _exclusive_run(settings: Settings) -> Iterator[None]:
    """Run the block unless another collection is running, in which case exit 0."""
    try:
        with hold_run_lock(settings.paths.jobs_db.parent / ".run.lock"):
            yield
    except RunInProgress:
        typer.echo("Another run is in progress, so this one did nothing.")
        raise typer.Exit(code=0) from None


def _collect(plan: _CollectionPlan, force: bool) -> CollectResult:
    settings = plan.settings
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
        sync_seeds(jobs_conn, plan.seeds, run_date)
        return asyncio.run(_run_collection(jobs_conn, archive_conn, plan, run_date, force))


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
    plan: _CollectionPlan,
    run_date: date,
    force: bool,
) -> CollectResult:
    limits = host_limits(plan.sources[name] for name in plan.adapters)
    async with PoliteClient(plan.settings.http, plan.contact_email, limits) as client:
        return await collect_boards(
            jobs_conn=jobs_conn,
            archive_conn=archive_conn,
            client=client,
            adapters=plan.adapters,
            sources=plan.sources,
            settings=plan.settings,
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
            f"    {counts.items:,} jobs, {counts.skipped:,} skipped as not software engineering: "
            f"{counts.new:,} new, {counts.changed:,} changed, "
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
        bool, typer.Option("--force", help="Fetch every board again, even if already done today.")
    ] = False,
) -> None:
    """Collect every company job board, then rebuild DuckDB.

    Safe to run at any time: running it again the same UTC day only retries what failed.
    """
    settings = Settings.load()
    plan = _plan_collection(settings, "boards")
    with _exclusive_run(settings):
        result = _collect(plan, force)
        _echo_collection(result)
        built = _refresh_duckdb(settings, result)
    code = _EXIT_CODES[result.status]
    raise typer.Exit(code=code if built else max(code, 1))


def _refresh_duckdb(settings: Settings, result: CollectResult) -> bool:
    """Rebuild DuckDB if it's behind SQLite. Returns False if the rebuild failed.

    The collected data is safe in SQLite, so a failure here is reported and the next
    run tries again.
    """
    if result.nothing_to_do and not _duckdb_is_stale(settings):
        return True
    try:
        _rebuild_duckdb(settings)
    except Exception as exc:
        logger.exception("DuckDB build failed", extra={"run_date": result.run_date})
        typer.echo(f"DuckDB build failed: {exc}", err=True)
        return False
    return True


def _duckdb_is_stale(settings: Settings) -> bool:
    """Whether a run has finished since DuckDB was last built."""
    with closing(db.connect(settings.paths.jobs_db)) as conn:
        finished_at = repo.last_run_finished_at(conn)
    if finished_at is None:
        return False
    if not settings.paths.duckdb.exists():
        return True
    return datetime.fromtimestamp(settings.paths.duckdb.stat().st_mtime, UTC) < finished_at


class SchedulePlatform(StrEnum):
    macos = "macos"
    linux = "linux"


@app.command()
def schedule(
    platform: Annotated[
        SchedulePlatform | None,
        typer.Option(help="Which scheduler to generate for. Defaults to this machine."),
    ] = None,
) -> None:
    """Write the schedule file for `jobs daily` and print how to load it. Loads nothing."""
    settings = Settings.load()
    if platform is None:
        platform = SchedulePlatform.macos if sys.platform == "darwin" else SchedulePlatform.linux
    settings.paths.schedule_dir.mkdir(parents=True, exist_ok=True)
    settings.paths.logs_dir.mkdir(parents=True, exist_ok=True)
    log_path = settings.paths.logs_dir / "daily.log"
    times = (settings.root, log_path, settings.schedule.hours, settings.schedule.minute)
    if platform is SchedulePlatform.macos:
        path = settings.paths.schedule_dir / f"{schedule_files.LAUNCHD_LABEL}.plist"
        path.write_bytes(schedule_files.launchd_plist(*times))
        commands = schedule_files.launchd_commands(path)
    else:
        path = settings.paths.schedule_dir / schedule_files.CRON_FILE_NAME
        path.write_text(schedule_files.crontab_line(*times) + "\n")
        commands = schedule_files.cron_commands(path)
    typer.echo(f"Wrote {path}")
    if not schedule_files.jobs_executable(settings.root).exists():
        typer.echo("WARNING: .venv/bin/jobs doesn't exist yet; run `uv sync` first.")
    typer.echo("To use it:")
    for command in commands:
        typer.echo(f"  {command}")


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
    """Show the last run, counts per source and active boards. Changes nothing."""
    settings = Settings.load()
    if not settings.paths.jobs_db.exists():
        typer.echo(f"{settings.paths.jobs_db.name} not found; run `jobs db init` first.", err=True)
        raise typer.Exit(code=1)
    now = datetime.now(UTC)
    with closing(db.connect_read_only(settings.paths.jobs_db)) as conn:
        run = repo.latest_run(conn)
        if run is None:
            typer.echo("Last run: none yet; run `jobs daily`.")
        else:
            _echo_last_run(conn, run, now)
        boards = Counter(board.ref.ats for board in repo.active_boards(conn))
        per_source = ", ".join(f"{ats} {count}" for ats, count in sorted(boards.items()))
        typer.echo(f"Active boards: {boards.total()}" + (f" ({per_source})" if boards else ""))
        typer.echo(f"Open postings: {repo.count_open_postings(conn):,}")
        failing = repo.failing_boards(conn)
        names = ", ".join(f"{name} ({_plural(days, 'day')})" for name, days in failing.items())
        typer.echo(f"Failing boards: {names or 'none'}")
        last_good = repo.last_good_run_finished_at(conn)
    duckdb_path = settings.paths.duckdb
    built = "never"
    if duckdb_path.exists():
        built = _ago(now - datetime.fromtimestamp(duckdb_path.stat().st_mtime, UTC))
    typer.echo(f"DuckDB built: {built}")
    if run is not None:
        _warn_if_stale(last_good, now, settings.health.freshness_warn_hours)


def _echo_last_run(conn: sqlite3.Connection, run: repo.RunRow, now: datetime) -> None:
    if run.finished_at is None:
        when = f"started {_ago(now - run.started_at)}"
    else:
        when = f"finished {_ago(now - run.finished_at)}"
    typer.echo(f"Last run: {run.run_date} ({run.status}), {when}")
    postings = _posting_counts(run.summary)
    for source, (ok, failed) in repo.board_results(conn, run.run_id).items():
        line = f"  {source}: {ok} boards ok, {failed} failed"
        if run.summary is not None:  # a run writes its summary when it finishes
            counts = postings[source]
            line += (
                f"; {counts['new']:,} new, {counts['changed']:,} changed, "
                f"{counts['reopened']:,} reposted, {counts['closed']:,} closed"
            )
        typer.echo(line)


def _posting_counts(summary: dict[str, Any] | None) -> defaultdict[str, Counter[str]]:
    """Each source's posting counts, added up over the day's collections."""
    totals: defaultdict[str, Counter[str]] = defaultdict(Counter)
    for collection in (summary or {}).get("collections", []):
        for source, counts in collection["sources"].items():
            totals[source].update(counts)
    return totals


def _warn_if_stale(last_good: datetime | None, now: datetime, warn_hours: float) -> None:
    if last_good is None:
        typer.echo("WARNING: no run has collected anything yet; run `jobs daily`.")
    elif now - last_good > timedelta(hours=warn_hours):
        typer.echo(
            f"WARNING: the last good run finished {_ago(now - last_good)}; "
            "check data/logs/daily.log and run `jobs daily`."
        )


def _ago(age: timedelta) -> str:
    minutes = int(age.total_seconds() // 60)
    if minutes < 1:
        return "just now"
    if minutes < 60:
        return f"{_plural(minutes, 'minute')} ago"
    if minutes < 48 * 60:
        return f"{_plural(minutes // 60, 'hour')} ago"
    return f"{_plural(minutes // (24 * 60), 'day')} ago"


def _plural(count: int, noun: str) -> str:
    return f"{count} {noun}" if count == 1 else f"{count} {noun}s"
