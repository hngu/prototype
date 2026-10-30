from pathlib import Path

from typer.testing import CliRunner

from jobinsights.cli import app

runner = CliRunner()


def test_help_lists_every_command() -> None:
    result = runner.invoke(app, ["--help"])

    assert result.exit_code == 0
    for command in ("db", "collect", "discover", "daily", "reprocess", "status"):
        assert command in result.output


def test_db_help_lists_subcommands() -> None:
    result = runner.invoke(app, ["db", "--help"])

    assert result.exit_code == 0
    for command in ("init", "migrate", "build-duckdb", "export"):
        assert command in result.output


def test_stub_fails_with_message() -> None:
    result = runner.invoke(app, ["status"])

    assert result.exit_code == 1
    assert "not implemented yet" in result.output


def test_db_init_creates_both_databases(project_dir: Path) -> None:
    result = runner.invoke(app, ["db", "init"])

    assert result.exit_code == 0, result.output
    assert "jobs.sqlite: applied 001_initial.sql" in result.output
    assert "archive.sqlite: applied 001_initial.sql" in result.output
    assert (project_dir / "data" / "jobs.sqlite").exists()
    assert (project_dir / "data" / "archive.sqlite").exists()


def test_db_migrate_after_init_is_up_to_date(project_dir: Path) -> None:
    runner.invoke(app, ["db", "init"])

    result = runner.invoke(app, ["db", "migrate"])

    assert result.exit_code == 0, result.output
    assert "jobs.sqlite: up to date" in result.output
    assert "archive.sqlite: up to date" in result.output


def test_db_migrate_before_init_fails(project_dir: Path) -> None:
    result = runner.invoke(app, ["db", "migrate"])

    assert result.exit_code == 1
    assert "run `jobs db init` first" in result.output
