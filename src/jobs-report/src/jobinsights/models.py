"""Records that adapters produce (PLAN.md §5.1).

Fields stay as the source gave them (`*_raw`); normalization is Phase 2.
"""

from typing import Any, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class BoardRef(BaseModel):
    """A company job board on an ATS, e.g. ('greenhouse', 'default', 'stripe')."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    ats: str = Field(min_length=1)
    region: str = Field(default="default", min_length=1)
    slug: str = Field(min_length=1)


class PostingRecord(BaseModel):
    """One job posting as parsed from one archived item."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    source: str = Field(min_length=1)
    native_id: str = Field(min_length=1)  # "{slug}:{job_id}" for board sources
    snapshot: bool
    board: BoardRef | None = None

    company_name_raw: str | None = None
    title: str = Field(min_length=1)
    department_raw: str | None = None
    locations_raw: list[str] = Field(default_factory=list)
    workplace_raw: str | None = None
    employment_type_raw: str | None = None

    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str | None = None
    salary_period: str | None = None
    salary_raw: str | None = None

    description_html: str | None = None
    description_text: str | None = None

    apply_url: str | None = None
    source_url: str | None = None
    ats_ref: str | None = None  # 'greenhouse:stripe:12345', parsed from a URL (Milestone 2)

    posted_at: str | None = None  # as reported by the source
    source_updated_at: str | None = None

    extra: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _check(self) -> Self:
        if self.description_html is not None and self.description_text is not None:
            raise ValueError("set description_html or description_text, not both")
        return self
