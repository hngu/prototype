"""Runtime configuration: config/*.yaml, plus the contact email from .env.

Only the fields that code uses so far are modeled; later milestones add theirs.
Data paths in settings.yaml are relative to the project root and are resolved here.
"""

import os
import re
from pathlib import Path
from typing import Any, Literal, Self

import yaml
from dotenv import dotenv_values
from pydantic import BaseModel, ConfigDict, Field

from jobinsights.models import BoardRef

_PLACEHOLDER_EMAIL = "you@example.com"  # the value in .env.example
_EMAIL = re.compile(r"[^@\s]+@[^@\s]+")


class ConfigError(RuntimeError):
    """A required setting is missing or invalid."""


class Paths(BaseModel):
    jobs_db: Path
    archive_db: Path
    duckdb: Path
    exports_dir: Path
    reports_dir: Path
    backups_dir: Path
    logs_dir: Path


class ArchiveSettings(BaseModel):
    retention_days: int = Field(ge=1)
    vacuum_weekday: str


class HttpSettings(BaseModel):
    timeout_seconds: float = Field(gt=0)
    max_retries: int = Field(ge=0)  # per request, inside the shared client
    backoff_base_seconds: float = Field(gt=0)
    backoff_max_seconds: float = Field(gt=0)


class CollectSettings(BaseModel):
    retries: int = Field(ge=0)  # rounds of re-fetching failed boards, per collection
    retry_backoff_seconds: float = Field(gt=0)  # wait before the first round; doubles each round


class CapsSettings(BaseModel):
    greenhouse_pay_enrichment_per_run: int = Field(ge=0)


class ReconcileSettings(BaseModel):
    # `posting_spans.pending_absent_date` can only count to 2, so any other value
    # is refused rather than silently ignored.
    absences_to_close: Literal[2]
    suspicious_drop_min_open: int = Field(ge=0)
    zero_job_runs_to_release: int = Field(ge=1)


class Settings(BaseModel):
    root: Path
    paths: Paths
    archive: ArchiveSettings
    http: HttpSettings
    collect: CollectSettings
    caps: CapsSettings
    reconcile: ReconcileSettings

    @classmethod
    def load(cls, root: Path | None = None) -> Self:
        """Load `<root>/config/settings.yaml`; `root` defaults to the current directory."""
        root = _resolve(root)
        raw = _read_yaml(root, "settings.yaml")
        raw["paths"] = {name: root / path for name, path in raw["paths"].items()}
        return cls.model_validate({"root": root, **raw})


class RateLimit(BaseModel):
    requests_per_minute: float | None = Field(default=None, gt=0)
    concurrency: int = Field(ge=1)


class SourceConfig(BaseModel):
    enabled: bool
    kind: Literal["board", "feed"]
    snapshot: bool
    endpoint: str | None
    eu_endpoint: str | None = None
    detail_endpoint: str | None = None
    rate_limit: RateLimit
    hash_exclude: list[str]


class SeedBoard(BaseModel):
    """One hand-picked company job board from config/seeds.yaml."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    ats: str = Field(min_length=1)
    region: str = Field(default="default", min_length=1)
    slug: str = Field(min_length=1)
    name: str = Field(min_length=1)

    @property
    def ref(self) -> BoardRef:
        return BoardRef(ats=self.ats, region=self.region, slug=self.slug)


def load_sources(root: Path | None = None) -> dict[str, SourceConfig]:
    """Load `<root>/config/sources.yaml`, keyed by source name."""
    raw = _read_yaml(_resolve(root), "sources.yaml")
    return {name: SourceConfig.model_validate(entry) for name, entry in raw["sources"].items()}


def load_seeds(root: Path | None = None) -> list[SeedBoard]:
    """Load `<root>/config/seeds.yaml`, refusing a board listed twice."""
    raw = _read_yaml(_resolve(root), "seeds.yaml")
    seeds = [SeedBoard.model_validate(entry) for entry in raw["boards"]]
    refs = [seed.ref for seed in seeds]
    duplicates = sorted({f"{r.ats}/{r.region}/{r.slug}" for r in refs if refs.count(r) > 1})
    if duplicates:
        raise ConfigError(f"seeds.yaml lists these boards twice: {', '.join(duplicates)}")
    return seeds


def load_contact_email(root: Path | None = None) -> str:
    """The email sent in every User-Agent (CLAUDE.md rule 4): environment first, then .env."""
    value = os.environ.get("CONTACT_EMAIL") or dotenv_values(_resolve(root) / ".env").get(
        "CONTACT_EMAIL"
    )
    email = (value or "").strip()
    if not email:
        raise ConfigError("CONTACT_EMAIL is not set; copy .env.example to .env and set it.")
    if email == _PLACEHOLDER_EMAIL or _EMAIL.fullmatch(email) is None:
        raise ConfigError(f"CONTACT_EMAIL {email!r} isn't a real email address; set it in .env.")
    return email


def _resolve(root: Path | None) -> Path:
    return (root or Path.cwd()).resolve()


def _read_yaml(root: Path, name: str) -> dict[str, Any]:
    with (root / "config" / name).open() as f:
        return yaml.safe_load(f)
