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
