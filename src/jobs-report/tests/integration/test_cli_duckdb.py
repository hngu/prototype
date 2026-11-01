from pathlib import Path

import duckdb
import httpx
import pytest
import respx
import yaml
from typer.testing import CliRunner

from jobinsights.cli import app
from jobinsights.store import db

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


def test_daily_collects_and_builds_a_matching_duckdb(
    project_dir: Path, monkeypatch: pytest.MonkeyPatch, respx_mock: respx.MockRouter
) -> None:
    monkeypatch.setenv("CONTACT_EMAIL", "jobs@acme.test")
    assert runner.invoke(app, ["db", "init"]).exit_code == 0
    settings_path = project_dir / "config" / "settings.yaml"
    settings = yaml.safe_load(settings_path.read_text())
    settings["caps"]["greenhouse_pay_enrichment_per_run"] = 0
    settings_path.write_text(yaml.safe_dump(settings))
    seeds = {"boards": [{"ats": "greenhouse", "slug": "acme", "name": "Acme"}]}
    (project_dir / "config" / "seeds.yaml").write_text(yaml.safe_dump(seeds))
    job = {"id": 1, "title": "Backend Engineer"}
    respx_mock.get("https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true").mock(
        return_value=httpx.Response(200, json={"jobs": [job], "meta": {"total": 1}})
    )

    result = runner.invoke(app, ["daily"])

    assert result.exit_code == 0, result.output
    conn = db.connect(project_dir / "data" / "jobs.sqlite")
    sqlite_counts = [
        conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        for table in ("runs", "postings", "posting_spans")
    ]
    conn.close()
    con = duckdb.connect(project_dir / "data" / "jobs.duckdb", read_only=True)
    duckdb_counts = [
        con.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        for table in ("runs", "postings", "posting_spans")
    ]
    con.close()
    assert sqlite_counts == [1, 1, 1]
    assert duckdb_counts == sqlite_counts
