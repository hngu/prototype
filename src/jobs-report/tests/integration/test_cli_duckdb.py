from pathlib import Path

import pytest
from typer.testing import CliRunner

from jobinsights.cli import app

pytestmark = pytest.mark.integration

runner = CliRunner()


def test_build_and_export_from_a_fresh_project(project_dir: Path) -> None:
    assert runner.invoke(app, ["db", "init"]).exit_code == 0

    build = runner.invoke(app, ["db", "build-duckdb"])
    export = runner.invoke(app, ["db", "export"])

    assert build.exit_code == 0, build.output
    assert "jobs.duckdb: rebuilt 10 tables" in build.output
    assert export.exit_code == 0, export.output
    assert (project_dir / "data" / "jobs.duckdb").exists()
    assert len(list((project_dir / "data" / "exports").glob("*.parquet"))) == 10


def test_build_before_init_fails(project_dir: Path) -> None:
    result = runner.invoke(app, ["db", "build-duckdb"])

    assert result.exit_code == 1
    assert "run `jobs db init` first" in result.output


def test_export_before_build_fails(project_dir: Path) -> None:
    runner.invoke(app, ["db", "init"])

    result = runner.invoke(app, ["db", "export"])

    assert result.exit_code == 1
    assert "run `jobs db build-duckdb` first" in result.output
