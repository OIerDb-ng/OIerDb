import asyncio
from contextlib import redirect_stdout
from dataclasses import asdict, dataclass, field
import json
from pathlib import Path
import subprocess
import sys
from typing import Annotated, Literal
import unicodedata

from agents import (
    Agent,
    ModelSettings,
    OpenAIChatCompletionsModel,
    RunConfig,
    RunContextWrapper,
    Runner,
    function_tool,
)
from agents.exceptions import AgentsException, MaxTurnsExceeded
from openai import APIError, AsyncOpenAI
from openai.types.shared import Reasoning
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from query import lookup_oiers, lookup_schools, search_schools  # noqa: E402

MAX_AGENT_TURNS = 16
AGENT_TIMEOUT = 240

SYSTEM_PROMPT = Path(__file__).with_suffix(".md").read_text(encoding="utf-8")


class ClassificationError(RuntimeError):
    pass


class ClassificationResult(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    applicable: bool
    title: Annotated[str, Field(min_length=1, max_length=120)] | None
    subjects: list[Literal["oier", "school"]]
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
        if len(self.subjects) != len(set(self.subjects)):
            raise ValueError("对象分类重复")
        if not self.applicable and (self.title is not None or self.subjects):
            raise ValueError("保持原样时，title 应为 null，subjects 应为空")
        return self


@dataclass
class QueryContext:
    warnings: list[str] = field(default_factory=list)
    data_sources: dict = field(default_factory=dict)
    queries: list[dict] = field(default_factory=list)

    def lookup(self, tool, callback, **arguments):
        self.queries.append({"tool": tool, "arguments": arguments})
        try:
            result = callback(**arguments)
        except (ValueError, OSError) as error:
            message = f"{tool} 查询失败：{error}"
            self.warnings.append(message)
            result = {"error": message}
        else:
            self.data_sources["repository"] = result["source"]
        return json.dumps(result, ensure_ascii=False)


RecordLimit = Annotated[int, Field(ge=0, le=200)]


# 查询共享学校注册表，使用异步工具避免 SDK 在线程中运行查询。
@function_tool
async def get_oier(ctx: RunContextWrapper[QueryContext], uid: int, record_limit: RecordLimit = 100) -> str:
    """按 UID 查询选手及参赛记录。"""
    return ctx.context.lookup("get_oier", lookup_oiers, uids=[uid], limit=record_limit)


@function_tool
async def find_oiers(ctx: RunContextWrapper[QueryContext], name: str, record_limit: RecordLimit = 100) -> str:
    """按完整姓名查询全部同名选手分组。"""
    return ctx.context.lookup("find_oiers", lookup_oiers, names=[name], limit=record_limit)


@function_tool
async def get_school(
    ctx: RunContextWrapper[QueryContext], school_id: int, record_limit: RecordLimit = 20
) -> str:
    """按学校 ID 查询学校及关联记录。"""
    return ctx.context.lookup("get_school", lookup_schools, ids=[school_id], limit=record_limit)


@function_tool(name_override="search_schools")
async def find_schools(
    ctx: RunContextWrapper[QueryContext], keyword: str, province: str | None = None
) -> str:
    """按校名或别名片段搜索学校 ID，可限定省份。"""
    return ctx.context.lookup("search_schools", search_schools, keyword=keyword, province=province)


async def _infer(api_key, issue, context, images):
    content = [
        {
            "type": "input_text",
            "text": json.dumps(
                {
                    "issue": {
                        "title": issue["title"],
                        "body": issue.get("body") or "",
                        "labels": issue.get("labels", []),
                    },
                    "warnings": context.warnings,
                },
                ensure_ascii=False,
            ),
        },
        *images,
    ]
    async with AsyncOpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        timeout=90,
        max_retries=1,
        default_headers={"X-Title": "OIerDb Issue Classification"},
    ) as client:
        agent = Agent[QueryContext](
            name="OIerDb issue classification",
            instructions=SYSTEM_PROMPT,
            model=OpenAIChatCompletionsModel(model="openai/gpt-6-luna", openai_client=client),
            model_settings=ModelSettings(
                parallel_tool_calls=False,
                max_tokens=4096,
                reasoning=Reasoning(effort="low"),
                extra_body={"provider": {"require_parameters": True}},
            ),
            tools=[get_oier, find_oiers, get_school, find_schools],
            output_type=ClassificationResult,
        )
        completed = await Runner.run(
            agent,
            [{"role": "user", "content": content}],
            context=context,
            max_turns=MAX_AGENT_TURNS,
            run_config=RunConfig(tracing_disabled=True),
        )
        return completed.final_output.model_dump()


def _run_inference(api_key, issue, context, images):
    try:
        return asyncio.run(_infer(api_key, issue, context, images))
    except MaxTurnsExceeded:
        raise ClassificationError(f"Agent 超过 {MAX_AGENT_TURNS} 轮") from None
    except APIError as error:
        raise ClassificationError(
            f"OpenRouter 请求失败：{getattr(error, 'status_code', None) or type(error).__name__}"
        ) from None
    except (AgentsException, ValidationError) as error:
        raise ClassificationError(f"Agent 未返回有效结果：{type(error).__name__}") from None


def infer(api_key, issue, context, images):
    if not api_key:
        raise ClassificationError("缺少 OPENROUTER_API_KEY")
    payload = {"api_key": api_key, "issue": issue, "context": asdict(context), "images": images}
    # 同步查询可能阻塞事件循环，由父进程执行超时限制。
    try:
        completed = subprocess.run(
            [sys.executable, Path(__file__).resolve()],
            input=json.dumps(payload),
            capture_output=True,
            encoding="utf-8",
            timeout=AGENT_TIMEOUT,
            check=True,
        )
        outcome = json.loads(completed.stdout)
    except subprocess.TimeoutExpired:
        raise ClassificationError(f"Agent 超过 {AGENT_TIMEOUT} 秒") from None
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        raise ClassificationError("Agent 进程未返回有效结果") from None
    if "error" in outcome:
        raise ClassificationError(outcome["error"])
    context.warnings = outcome["context"]["warnings"]
    context.data_sources = outcome["context"]["data_sources"]
    context.queries = outcome["context"]["queries"]
    return outcome["result"]


def _worker():
    payload = json.load(sys.stdin)
    context = QueryContext(**payload["context"])
    try:
        with redirect_stdout(sys.stderr):
            result = _run_inference(payload["api_key"], payload["issue"], context, payload["images"])
    except ClassificationError as error:
        return {"error": str(error)}
    return {"result": result, "context": asdict(context)}


if __name__ == "__main__":
    json.dump(_worker(), sys.stdout)
