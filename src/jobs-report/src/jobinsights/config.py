"""Runtime settings, loaded from config/settings.yaml.

Only the sections that code uses so far are modeled; later milestones add theirs.
Data paths in the file are relative to the project root and are resolved here.
"""

from pathlib import Path
from typing import Any, Self

import yaml
from pydantic import BaseModel, Field


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


class Settings(BaseModel):
    root: Path
    paths: Paths
    archive: ArchiveSettings

    @classmethod
    def load(cls, root: Path | None = None) -> Self:
        """Load `<root>/config/settings.yaml`; `root` defaults to the current directory."""
        root = (root or Path.cwd()).resolve()
        with (root / "config" / "settings.yaml").open() as f:
            raw: dict[str, Any] = yaml.safe_load(f)
        raw["paths"] = {name: root / path for name, path in raw["paths"].items()}
        return cls.model_validate({"root": root, **raw})
