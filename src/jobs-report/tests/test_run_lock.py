from pathlib import Path

import pytest

from jobinsights.run_lock import RunInProgress, hold_run_lock


def test_a_second_holder_is_refused(tmp_path: Path) -> None:
    lock = tmp_path / ".run.lock"

    with hold_run_lock(lock), pytest.raises(RunInProgress), hold_run_lock(lock):
        pass


def test_the_lock_is_released_afterwards(tmp_path: Path) -> None:
    lock = tmp_path / ".run.lock"

    with hold_run_lock(lock):
        pass

    with hold_run_lock(lock):
        pass


def test_the_lock_is_released_after_a_crash(tmp_path: Path) -> None:
    lock = tmp_path / ".run.lock"

    with pytest.raises(ValueError), hold_run_lock(lock):
        raise ValueError("crashed")

    with hold_run_lock(lock):
        pass
