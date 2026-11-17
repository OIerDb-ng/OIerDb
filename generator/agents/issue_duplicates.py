from pathlib import Path
from typing import TypedDict

from pydantic import BaseModel, ConfigDict, Field

DUPLICATES_PROMPT = Path(__file__).with_suffix(".md").read_text(encoding="utf-8")


class IssueForComparison(TypedDict):
    number: int
    title: str
    body: str
    state: str
    state_reason: str | None


class DuplicateResult(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    duplicate_numbers: list[int] = Field(max_length=3)
