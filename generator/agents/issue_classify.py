from pathlib import Path
from typing import Annotated, Literal
import unicodedata

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from generator.agents.issue_repair import RepairSkill

CLASSIFICATION_PROMPT = Path(__file__).with_suffix(".md").read_text(encoding="utf-8")


class ClassificationResult(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    applicable: bool
    subjects: list[Literal["oier", "school"]]
    skills: list[RepairSkill]
    title: Annotated[str, Field(min_length=1, max_length=120)] | None
    summary: str = Field(max_length=1000)

    @field_validator("title")
    @classmethod
    def single_line_title(cls, value):
        if value is not None:
            if not value.strip() or any(
                unicodedata.category(char) in {"Cc", "Cf", "Zl", "Zp"} for char in value
            ):
                raise ValueError("标题应为一行可读的文字")
            return value.strip()
        return value

    @model_validator(mode="after")
    def consistent_classification(self):
        if any(skill.rsplit("-", 1)[1] not in self.subjects for skill in self.skills):
            raise ValueError("修复技能必须与对象分类对应")
        if not self.applicable and (self.title is not None or self.subjects or self.skills):
            raise ValueError("保持原样时，title 应为 null，subjects 和 skills 应为空")
        self.subjects = list(dict.fromkeys(self.subjects))
        self.skills = list(dict.fromkeys(self.skills))
        return self
