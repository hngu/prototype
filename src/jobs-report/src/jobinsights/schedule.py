"""Generate the local schedule for `jobs daily`: launchd on macOS, cron on Linux.

Nothing here touches the system. `jobs schedule` writes the result under data/ and
prints the commands that load it.

Both schedulers use the machine's local time and have no time zone setting, so the
schedule fires several times a day rather than at one fixed UTC time. `jobs daily` is
safe to repeat: once the UTC day has a good run, later firings find nothing to do. A
firing that failed gets another chance the same day.
"""

import plistlib
import shlex
from collections.abc import Sequence
from pathlib import Path

LAUNCHD_LABEL = "com.jobinsights.daily"
CRON_FILE_NAME = "jobs-daily.cron"


def jobs_executable(root: Path) -> Path:
    """The virtual environment's script. Schedulers have a bare PATH, so `uv` may not resolve."""
    return root / ".venv" / "bin" / "jobs"


def launchd_plist(root: Path, log_path: Path, hours: Sequence[int], minute: int) -> bytes:
    """A launchd job.

    launchd starts a firing missed during sleep on wake, and `RunAtLoad` covers the Mac
    having been off. `caffeinate -i` stops idle sleep from pausing a run. There's no
    `KeepAlive`, so a failed run waits for the next firing.
    """
    return plistlib.dumps(
        {
            "Label": LAUNCHD_LABEL,
            "ProgramArguments": ["/usr/bin/caffeinate", "-i", str(jobs_executable(root)), "daily"],
            "WorkingDirectory": str(root),
            "StandardOutPath": str(log_path),
            "StandardErrorPath": str(log_path),
            "RunAtLoad": True,
            "StartCalendarInterval": [{"Hour": hour, "Minute": minute} for hour in hours],
        }
    )


def launchd_commands(plist_path: Path) -> list[str]:
    installed = f"~/Library/LaunchAgents/{LAUNCHD_LABEL}.plist"
    service = f"gui/$(id -u)/{LAUNCHD_LABEL}"
    return [
        f"cp {shlex.quote(str(plist_path))} ~/Library/LaunchAgents/",
        f"launchctl bootstrap gui/$(id -u) {installed}",
        f"launchctl print {service}      # confirm it's loaded",
        f"launchctl kickstart {service}  # run it now",
        f"launchctl bootout {service}    # stop the schedule",
    ]


def crontab_line(root: Path, log_path: Path, hours: Sequence[int], minute: int) -> str:
    """A crontab entry. Unlike launchd, cron skips firings missed while the machine was off."""
    hour_field = ",".join(str(hour) for hour in hours)
    command = (
        f"cd {shlex.quote(str(root))} && {shlex.quote(str(jobs_executable(root)))} daily "
        f">> {shlex.quote(str(log_path))} 2>&1"
    )
    # An unescaped % ends a cron command.
    return f"{minute} {hour_field} * * * {command.replace('%', r'\%')}"


def cron_commands(cron_path: Path) -> list[str]:
    return [
        f"(crontab -l 2>/dev/null; cat {shlex.quote(str(cron_path))}) | crontab -",
        "crontab -l                                # confirm it's loaded",
        "crontab -l | grep -v 'jobs daily' | crontab -  # stop the schedule",
    ]
