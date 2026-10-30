from pathlib import Path
from typing import Any

import pytest
import yaml
from pydantic import ValidationError

from jobinsights.config import ConfigError, Settings, load_contact_email, load_seeds, load_sources
from jobinsights.models import BoardRef

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


def test_settings_load_the_collection_sections(project_dir: Path) -> None:
    settings = Settings.load()

    assert settings.http.max_retries == 2
    assert settings.collect.retries == 3
    assert settings.collect.retry_backoff_seconds == 30
    assert settings.caps.greenhouse_pay_enrichment_per_run == 200
    assert settings.reconcile.absences_to_close == 2
    assert settings.reconcile.suspicious_drop_min_open == 20
    assert settings.reconcile.zero_job_runs_to_release == 3


def test_settings_refuse_other_absences_to_close(project_dir: Path) -> None:
    path = project_dir / "config" / "settings.yaml"
    path.write_text(path.read_text().replace("absences_to_close: 2", "absences_to_close: 3"))

    with pytest.raises(ValidationError, match="absences_to_close"):
        Settings.load()


def test_load_sources_reads_every_source(project_dir: Path) -> None:
    sources = load_sources()

    assert set(sources) == PLAN_SOURCES
    assert sources["lever"].eu_endpoint == "https://api.eu.lever.co/v0/postings/{slug}?mode=json"
    assert sources["greenhouse"].rate_limit.requests_per_minute == 60
    assert sources["greenhouse"].rate_limit.concurrency == 4
    # Not every source states a per-minute limit.
    assert sources["themuse"].rate_limit.requests_per_minute is None


def write_seeds(project_dir: Path, boards: list[dict[str, str]]) -> None:
    (project_dir / "config" / "seeds.yaml").write_text(yaml.safe_dump({"boards": boards}))


def test_load_seeds_defaults_the_region(project_dir: Path) -> None:
    write_seeds(project_dir, [{"ats": "lever", "slug": "acme", "name": "Acme"}])

    [seed] = load_seeds()

    assert seed.name == "Acme"
    assert seed.ref == BoardRef(ats="lever", region="default", slug="acme")


def test_load_seeds_allows_one_slug_in_two_regions(project_dir: Path) -> None:
    write_seeds(
        project_dir,
        [
            {"ats": "lever", "slug": "acme", "name": "Acme"},
            {"ats": "lever", "region": "eu", "slug": "acme", "name": "Acme"},
        ],
    )

    assert len(load_seeds()) == 2


def test_load_seeds_refuses_a_duplicate_board(project_dir: Path) -> None:
    board = {"ats": "lever", "slug": "acme", "name": "Acme"}
    write_seeds(project_dir, [board, board])

    with pytest.raises(ConfigError, match="lever/default/acme"):
        load_seeds()


def test_contact_email_comes_from_dotenv(
    project_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("CONTACT_EMAIL", raising=False)
    (project_dir / ".env").write_text("CONTACT_EMAIL=jobs@acme.test\n")

    assert load_contact_email() == "jobs@acme.test"


def test_contact_email_prefers_the_environment(
    project_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("CONTACT_EMAIL", "ci@acme.test")
    (project_dir / ".env").write_text("CONTACT_EMAIL=jobs@acme.test\n")

    assert load_contact_email() == "ci@acme.test"


def test_contact_email_missing_is_refused(
    project_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("CONTACT_EMAIL", raising=False)

    with pytest.raises(ConfigError, match="not set"):
        load_contact_email()


@pytest.mark.parametrize("value", ["you@example.com", "not-an-email", "a b@acme.test", "a@b@c"])
def test_contact_email_placeholder_or_invalid_is_refused(
    project_dir: Path, monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    monkeypatch.setenv("CONTACT_EMAIL", value)

    with pytest.raises(ConfigError, match="isn't a real email"):
        load_contact_email()
