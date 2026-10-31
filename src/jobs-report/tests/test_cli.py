import json
import logging
import shutil
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest
import respx
import yaml
from typer.testing import CliRunner

from jobinsights.cli import app
from jobinsights.store import db

runner = CliRunner()
ACME_URL = "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true"
OTHER_URL = "https://boards-api.greenhouse.io/v1/boards/other/jobs?content=true"
ZOOX_URL = "https://api.lever.co/v0/postings/zoox?mode=json"
GREENHOUSE_JOB = {"id": 1, "title": "Backend Engineer"}


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


# --- jobs collect -----------------------------------------------------------------


@pytest.fixture(autouse=True)
def restore_logging() -> Iterator[None]:
    root = logging.getLogger()
    saved = root.handlers[:], root.level
    yield
    root.handlers[:], root.level = saved


@pytest.fixture
def collect_project(project_dir: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A project with both databases created and a contact email set."""
    monkeypatch.setenv("CONTACT_EMAIL", "jobs@acme.test")
    assert runner.invoke(app, ["db", "init"]).exit_code == 0
    return project_dir


def write_seeds(project_dir: Path, *boards: tuple[str, str]) -> None:
    entries = [{"ats": ats, "slug": slug, "name": slug.title()} for ats, slug in boards]
    (project_dir / "config" / "seeds.yaml").write_text(yaml.safe_dump({"boards": entries}))


def greenhouse_ok() -> httpx.Response:
    return httpx.Response(200, json={"jobs": [GREENHOUSE_JOB], "meta": {"total": 1}})


def test_collect_before_init_fails(project_dir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CONTACT_EMAIL", "jobs@acme.test")

    result = runner.invoke(app, ["collect", "--source", "boards"])

    assert result.exit_code == 1
    assert "run `jobs db init` first" in result.output


def test_collect_refuses_an_unknown_source(collect_project: Path) -> None:
    result = runner.invoke(app, ["collect", "--source", "linkedin"])

    assert result.exit_code == 1
    assert "Unknown source" in result.output


def test_collect_refuses_a_disabled_source(collect_project: Path) -> None:
    result = runner.invoke(app, ["collect", "--source", "adzuna"])

    assert result.exit_code == 1
    assert "disabled" in result.output


def test_collect_refuses_an_enabled_source_with_no_board_adapter(collect_project: Path) -> None:
    path = collect_project / "config" / "sources.yaml"
    config = yaml.safe_load(path.read_text())
    config["sources"]["remoteok"]["enabled"] = True
    path.write_text(yaml.safe_dump(config))

    result = runner.invoke(app, ["collect", "--source", "remoteok"])

    assert result.exit_code == 1
    assert "no board adapter" in result.output


def test_collect_needs_a_contact_email(
    collect_project: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("CONTACT_EMAIL")

    result = runner.invoke(app, ["collect", "--source", "boards"])

    assert result.exit_code == 1
    assert "CONTACT_EMAIL" in result.output


def test_collect_asks_for_pending_migrations(
    project_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("CONTACT_EMAIL", "jobs@acme.test")
    runner.invoke(app, ["db", "init"])
    (project_dir / "data" / "jobs.sqlite").unlink()
    old_migrations = project_dir / "old_migrations"
    old_migrations.mkdir()
    shutil.copy(db.MIGRATIONS_DIR / "001_initial.sql", old_migrations)
    conn = db.connect(project_dir / "data" / "jobs.sqlite")
    db.migrate(conn, old_migrations)
    conn.close()

    result = runner.invoke(app, ["collect", "--source", "boards"])

    assert result.exit_code == 1
    assert "002_daily_run.sql" in result.output
    assert "jobs db migrate" in result.output


def test_collect_with_no_boards_says_so(collect_project: Path) -> None:
    result = runner.invoke(app, ["collect", "--source", "boards"])

    assert result.exit_code == 0
    assert "No active boards" in result.output


def test_collect_runs_and_a_second_run_has_nothing_to_do(
    collect_project: Path, respx_mock: respx.MockRouter
) -> None:
    write_seeds(collect_project, ("greenhouse", "acme"))
    route = respx_mock.get(ACME_URL).mock(return_value=greenhouse_ok())

    first = runner.invoke(app, ["collect", "--source", "boards"])
    second = runner.invoke(app, ["collect", "--source", "boards"])

    assert first.exit_code == 0, first.output
    assert ": ok" in first.output
    assert "greenhouse: 1 boards ok, 0 failed" in first.output
    assert "1 jobs: 1 new" in first.output
    assert second.exit_code == 0
    assert "nothing to do" in second.output
    assert route.call_count == 1


def test_collect_sends_the_contact_email(
    collect_project: Path, respx_mock: respx.MockRouter
) -> None:
    write_seeds(collect_project, ("greenhouse", "acme"))
    route = respx_mock.get(ACME_URL).mock(return_value=greenhouse_ok())

    runner.invoke(app, ["collect", "--source", "boards"])

    assert "jobs@acme.test" in route.calls.last.request.headers["user-agent"]


def test_collect_logs_json_lines_with_context(
    collect_project: Path, respx_mock: respx.MockRouter
) -> None:
    write_seeds(collect_project, ("greenhouse", "acme"))
    respx_mock.get(ACME_URL).mock(return_value=greenhouse_ok())

    result = runner.invoke(app, ["collect", "--source", "boards"])

    lines = [json.loads(line) for line in result.output.splitlines() if line.startswith("{")]
    [fetched] = [line for line in lines if line["message"] == "fetched"]
    assert fetched["source"] == "greenhouse"
    assert fetched["board"] == "acme"
    assert fetched["run_id"] == 1


def test_collect_force_fetches_again(collect_project: Path, respx_mock: respx.MockRouter) -> None:
    write_seeds(collect_project, ("greenhouse", "acme"))
    route = respx_mock.get(ACME_URL).mock(return_value=greenhouse_ok())
    runner.invoke(app, ["collect", "--source", "boards"])

    result = runner.invoke(app, ["collect", "--source", "boards", "--force"])

    assert result.exit_code == 0
    assert route.call_count == 2


def test_collect_one_source_leaves_the_others_alone(
    collect_project: Path, respx_mock: respx.MockRouter
) -> None:
    write_seeds(collect_project, ("greenhouse", "acme"), ("lever", "zoox"))
    respx_mock.get(ZOOX_URL).mock(return_value=httpx.Response(200, json=[]))

    result = runner.invoke(app, ["collect", "--source", "lever"])

    assert result.exit_code == 0, result.output
    assert "lever: 1 boards ok" in result.output
    assert "greenhouse:" not in result.output


def test_collect_exits_1_when_some_boards_fail(
    collect_project: Path, respx_mock: respx.MockRouter
) -> None:
    write_seeds(collect_project, ("greenhouse", "acme"), ("greenhouse", "other"))
    respx_mock.get(ACME_URL).mock(return_value=greenhouse_ok())
    respx_mock.get(OTHER_URL).mock(return_value=httpx.Response(404))

    result = runner.invoke(app, ["collect", "--source", "boards"])

    assert result.exit_code == 1
    assert ": partial" in result.output
    assert "Still failing: greenhouse/other" in result.output


def test_collect_exits_2_when_every_board_fails(
    collect_project: Path, respx_mock: respx.MockRouter
) -> None:
    write_seeds(collect_project, ("greenhouse", "acme"))
    respx_mock.get(ACME_URL).mock(return_value=httpx.Response(404))

    result = runner.invoke(app, ["collect", "--source", "boards"])

    assert result.exit_code == 2
    assert ": failed" in result.output
