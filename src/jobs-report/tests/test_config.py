from pathlib import Path
from typing import Any

import pytest
import yaml

CONFIG_DIR = Path(__file__).parent.parent / "config"

REQUIRED_SOURCE_KEYS = {
    "enabled",
    "kind",
    "snapshot",
    "endpoint",
    "auth",
    "rate_limit",
    "quota",
    "terms_notes",
    "doc_url",
    "verified_at",
    "unverified",
    "hash_exclude",
}
PLAN_SOURCES = {
    "greenhouse",
    "lever",
    "ashby",
    "workable",
    "smartrecruiters",
    "recruitee",
    "adzuna",
    "themuse",
    "remotive",
    "remoteok",
    "usajobs",
    "hn",
    "jsearch",
}


def load(name: str) -> dict[str, Any]:
    with (CONFIG_DIR / name).open() as f:
        return yaml.safe_load(f)


SOURCES: dict[str, dict[str, Any]] = load("sources.yaml")["sources"]


def test_every_plan_source_is_listed() -> None:
    assert set(SOURCES) == PLAN_SOURCES


@pytest.mark.parametrize("name", sorted(SOURCES))
def test_source_entry_is_complete(name: str) -> None:
    source = SOURCES[name]

    assert source.keys() >= REQUIRED_SOURCE_KEYS
    assert source["kind"] in {"board", "feed"}
    # Closures can only be inferred from complete company boards.
    assert source["snapshot"] is (source["kind"] == "board")
    assert source["rate_limit"]["basis"] in {"documented", "self-imposed"}
    assert source["doc_url"].startswith("https://")
    assert isinstance(source["verified_at"], str)
    assert isinstance(source["unverified"], list)
    assert isinstance(source["hash_exclude"], list)


def test_paid_source_is_disabled() -> None:
    assert SOURCES["jsearch"]["enabled"] is False


def test_settings_defaults() -> None:
    settings = load("settings.yaml")

    assert settings["archive"]["retention_days"] == 90
    assert settings["backups"]["keep"] == 7


def test_seeds_is_a_list() -> None:
    assert isinstance(load("seeds.yaml")["boards"], list)
