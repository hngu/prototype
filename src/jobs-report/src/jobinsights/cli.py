"""The `jobs` command-line interface.

Milestone 0 only declares the commands and their flags; each one is a stub
that fails loudly until the milestone noted in its message implements it.
"""

from datetime import datetime
from pathlib import Path
from typing import Annotated, NoReturn

import typer

RUN_DATE_FORMAT = "%Y-%m-%d"

app = typer.Typer(no_args_is_help=True, help="Collect and store software-engineering job postings.")
db_app = typer.Typer(no_args_is_help=True, help="Manage the SQLite and DuckDB databases.")
app.add_typer(db_app, name="db")


def _not_implemented(command: str, milestone: str) -> NoReturn:
    typer.echo(f"`jobs {command}` is not implemented yet (Milestone {milestone}).", err=True)
    raise typer.Exit(code=1)


@db_app.command("init")
def db_init() -> None:
    """Create data/jobs.sqlite and data/archive.sqlite and apply all migrations."""
    _not_implemented("db init", "1")


@db_app.command("migrate")
def db_migrate() -> None:
    """Apply pending migrations to both databases."""
    _not_implemented("db migrate", "1")


@db_app.command("build-duckdb")
def db_build_duckdb() -> None:
    """Rebuild data/jobs.duckdb from SQLite."""
    _not_implemented("db build-duckdb", "1")


@db_app.command("export")
def db_export() -> None:
    """Write one Parquet file per table to data/exports/."""
    _not_implemented("db export", "1")


@app.command()
def collect(
    source: Annotated[
        str, typer.Option(help="A source name from config/sources.yaml, or `boards`.")
    ],
) -> None:
    """Fetch one source, archive every response, then parse into SQLite."""
    _not_implemented("collect", "2")


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
