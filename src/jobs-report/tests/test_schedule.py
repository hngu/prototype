import plistlib
import subprocess
from pathlib import Path
from typing import Any

import pytest
from typer.testing import CliRunner

from jobinsights.cli import app
from jobinsights.schedule import cron_commands, crontab_line, launchd_commands, launchd_plist

runner = CliRunner()
ROOT = Path("/Users/me/job insights & more")
LOG = ROOT / "data" / "logs" / "daily.log"
HOURS = [0, 4, 8, 12, 16, 20]


def test_plist_runs_jobs_daily_from_the_project_root() -> None:
    plist = plistlib.loads(launchd_plist(ROOT, LOG, HOURS, 17))

    assert plist["Label"] == "com.jobinsights.daily"
    assert plist["ProgramArguments"] == [
        "/usr/bin/caffeinate",
        "-i",
        f"{ROOT}/.venv/bin/jobs",
        "daily",
    ]
    assert plist["WorkingDirectory"] == str(ROOT)  # survives the space and the &
    assert plist["StandardOutPath"] == str(LOG)
    assert plist["StandardErrorPath"] == str(LOG)


def test_plist_fires_at_each_time_and_at_login_without_restarting() -> None:
    plist = plistlib.loads(launchd_plist(ROOT, LOG, HOURS, 17))

    assert plist["StartCalendarInterval"] == [{"Hour": hour, "Minute": 17} for hour in HOURS]
    assert plist["RunAtLoad"] is True
    assert "KeepAlive" not in plist


def test_launchd_commands_load_and_stop_the_job() -> None:
    commands = "\n".join(launchd_commands(Path("/tmp/a b/job.plist")))

    assert "cp '/tmp/a b/job.plist' ~/Library/LaunchAgents/" in commands
    assert "launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/" in commands
    assert "launchctl bootout gui/$(id -u)/com.jobinsights.daily" in commands


def test_crontab_line_has_the_times_and_appends_to_the_log() -> None:
    line = crontab_line(Path("/home/me/jobs"), Path("/home/me/jobs/data/logs/daily.log"), HOURS, 17)

    assert line == (
        "17 0,4,8,12,16,20 * * * cd /home/me/jobs && /home/me/jobs/.venv/bin/jobs daily "
        ">> /home/me/jobs/data/logs/daily.log 2>&1"
    )


def test_crontab_line_quotes_paths_and_escapes_percent() -> None:
    root = Path("/home/me/100% jobs")

    line = crontab_line(root, root / "daily.log", [3], 5)

    assert line.startswith("5 3 * * * cd '/home/me/100\\% jobs' && ")
    assert "%" not in line.replace("\\%", "")


def test_cron_commands_install_from_the_file() -> None:
    assert cron_commands(Path("/tmp/x.cron"))[0] == (
        "(crontab -l 2>/dev/null; cat /tmp/x.cron) | crontab -"
    )


@pytest.fixture
def no_subprocesses(monkeypatch: pytest.MonkeyPatch) -> None:
    """Prove the command only writes a file: it must never call launchctl or crontab."""

    def refuse(*args: Any, **kwargs: Any) -> None:
        raise AssertionError(f"ran a command: {args}")

    monkeypatch.setattr(subprocess, "run", refuse)


def files_under(root: Path) -> set[str]:
    return {str(path.relative_to(root)) for path in root.rglob("*") if path.is_file()}


def test_schedule_macos_writes_the_plist_and_prints_the_commands(
    project_dir: Path, no_subprocesses: None
) -> None:
    before = files_under(project_dir)

    result = runner.invoke(app, ["schedule", "--platform", "macos"])

    assert result.exit_code == 0, result.output
    assert files_under(project_dir) - before == {"data/schedule/com.jobinsights.daily.plist"}
    assert (project_dir / "data" / "logs").is_dir()  # launchd can't create the log's folder
    assert "launchctl bootstrap" in result.output
    plist = plistlib.loads((project_dir / "data/schedule/com.jobinsights.daily.plist").read_bytes())
    assert plist["WorkingDirectory"] == str(project_dir.resolve())
    assert plist["StandardOutPath"] == str(project_dir.resolve() / "data/logs/daily.log")
    assert plist["StartCalendarInterval"] == [{"Hour": hour, "Minute": 17} for hour in HOURS]


def test_schedule_linux_writes_the_cron_file(project_dir: Path, no_subprocesses: None) -> None:
    before = files_under(project_dir)

    result = runner.invoke(app, ["schedule", "--platform", "linux"])

    assert result.exit_code == 0, result.output
    assert files_under(project_dir) - before == {"data/schedule/jobs-daily.cron"}
    line = (project_dir / "data/schedule/jobs-daily.cron").read_text()
    assert line.startswith("17 0,4,8,12,16,20 * * * cd ")
    assert line.endswith("2>&1\n")
    assert "crontab -" in result.output


def test_schedule_warns_when_the_virtual_environment_is_missing(project_dir: Path) -> None:
    result = runner.invoke(app, ["schedule", "--platform", "macos"])

    assert "run `uv sync` first" in result.output


def test_schedule_is_quiet_when_the_virtual_environment_exists(project_dir: Path) -> None:
    jobs = project_dir / ".venv" / "bin" / "jobs"
    jobs.parent.mkdir(parents=True)
    jobs.touch()

    result = runner.invoke(app, ["schedule", "--platform", "macos"])

    assert "WARNING" not in result.output


def test_schedule_refuses_an_unknown_platform(project_dir: Path) -> None:
    assert runner.invoke(app, ["schedule", "--platform", "windows"]).exit_code != 0
