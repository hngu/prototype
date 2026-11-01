"""Keep two collections from running at once.

A manual `jobs daily` can start just as the schedule fires. Both would see the same
unfetched boards, so the second one steps aside. The operating system releases the
lock when the process ends, even after a crash, so a stale lock can't block a run.
"""

import fcntl
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path


class RunInProgress(RuntimeError):
    """Another process holds the lock."""


@contextmanager
def hold_run_lock(path: Path) -> Iterator[None]:
    """Hold the lock for the `with` block, or raise `RunInProgress` straight away."""
    with path.open("a") as lock_file:
        try:
            fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise RunInProgress(str(path)) from exc
        yield
