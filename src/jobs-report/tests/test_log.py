import json
import logging
from collections.abc import Iterator
from typing import Any

import pytest

from jobinsights.log import configure_logging


@pytest.fixture(autouse=True)
def restore_logging() -> Iterator[None]:
    root = logging.getLogger()
    httpx_logger = logging.getLogger("httpx")
    saved = (root.handlers[:], root.level, httpx_logger.level)
    yield
    root.handlers[:], root.level, httpx_logger.level = saved


def log_lines(capsys: pytest.CaptureFixture[str]) -> list[dict[str, Any]]:
    return [json.loads(line) for line in capsys.readouterr().out.splitlines()]


def test_a_line_is_json_with_its_context(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging()

    logging.getLogger("jobinsights.test").info(
        "fetched %d jobs", 3, extra={"run_id": 7, "source": "lever"}
    )

    [entry] = log_lines(capsys)
    assert entry["level"] == "info"
    assert entry["logger"] == "jobinsights.test"
    assert entry["message"] == "fetched 3 jobs"
    assert entry["run_id"] == 7
    assert entry["source"] == "lever"
    assert entry["ts"].endswith("+00:00")


def test_exceptions_are_kept_on_one_line(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging()

    try:
        raise ValueError("bad item")
    except ValueError:
        logging.getLogger("jobinsights.test").exception("parse failed")

    [entry] = log_lines(capsys)
    assert entry["level"] == "error"
    assert "ValueError: bad item" in entry["exception"]


def test_values_json_cannot_encode_fall_back_to_text(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging()

    logging.getLogger("jobinsights.test").info("x", extra={"path": ValueError("oops")})

    [entry] = log_lines(capsys)
    assert entry["path"] == "oops"


def test_configuring_twice_does_not_double_lines(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging()
    configure_logging()

    logging.getLogger("jobinsights.test").info("once")

    assert len(log_lines(capsys)) == 1


def test_httpx_request_urls_are_not_logged(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging()

    logging.getLogger("httpx").info("HTTP Request: GET https://api.test/?app_key=secret")

    assert log_lines(capsys) == []
