import asyncio
from contextlib import redirect_stdout
from dataclasses import asdict, dataclass
import json
from pathlib import Path
import subprocess
import sys

from agents import Agent, ModelSettings, OpenAIChatCompletionsModel, RunConfig, Runner
from agents.exceptions import AgentsException, MaxTurnsExceeded
from openai import APIError, AsyncOpenAI
from openai.types.shared import Reasoning
from pydantic import ValidationError

if __name__ == "__main__":
    generator_dir = Path(__file__).resolve().parents[1]
    sys.path[:0] = [str(generator_dir.parent), str(generator_dir)]

from generator.agents.issue_classify import CLASSIFICATION_PROMPT, ClassificationResult  # noqa: E402
from generator.agents.issue_queries import ISSUE_QUERY_TOOLS, QueryContext  # noqa: E402
from generator.agents.issue_repair import (  # noqa: E402
    RepairPlan,
    RepairSkill,
    ResolvedRepair,
    repair_agent_config,
    resolve_plan,
)

MODEL = "openai/gpt-6-luna"
MAX_AGENT_TURNS = 16
AGENT_TIMEOUT = 240


class IssueAgentError(RuntimeError):
    pass


@dataclass
class IssueInput:
    title: str
    body: str
    labels: list[str]
    images: list[dict]


def run_classification(api_key: str, issue: IssueInput, context: QueryContext) -> ClassificationResult:
    result = _run_worker(api_key, issue, context, skills=None)
    return ClassificationResult.model_validate(result)


def run_repair(
    api_key: str, issue: IssueInput, context: QueryContext, skills: list[RepairSkill]
) -> ResolvedRepair:
    result = _run_worker(api_key, issue, context, skills)
    try:
        return resolve_plan(RepairPlan.model_validate(result), skills, context.queries)
    except ValueError as error:
        raise IssueAgentError(str(error)) from None


def _run_worker(api_key, issue, context, skills):
    request = {
        "api_key": api_key,
        "issue": asdict(issue),
        "warnings": context.warnings,
        "skills": skills,
    }
    # 数据查询是同步的，由父进程限制整个 Agent 的运行时间。
    try:
        completed = subprocess.run(
            [sys.executable, Path(__file__).resolve()],
            input=json.dumps(request),
            capture_output=True,
            encoding="utf-8",
            timeout=AGENT_TIMEOUT,
            check=True,
        )
        response = json.loads(completed.stdout)
    except subprocess.TimeoutExpired:
        raise IssueAgentError(f"Agent 超过 {AGENT_TIMEOUT} 秒") from None
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        raise IssueAgentError("Agent 进程未返回有效结果") from None

    context.warnings = response["context"]["warnings"]
    context.data_sources = response["context"]["data_sources"]
    context.queries = response["context"]["queries"]
    if "error" in response:
        raise IssueAgentError(response["error"])
    return response["result"]


async def _infer(api_key, issue, context, skills):
    details = {
        "issue": {"title": issue.title, "body": issue.body, "labels": issue.labels},
        "warnings": context.warnings,
    }
    if skills is None:
        name = "OIerDb issue classification"
        instructions = CLASSIFICATION_PROMPT
        output_type = ClassificationResult
        tools = ISSUE_QUERY_TOOLS
    else:
        name = "OIerDb issue repair plan"
        instructions, tools = repair_agent_config(skills)
        output_type = RepairPlan
        details["skills"] = skills

    content = [{"type": "input_text", "text": json.dumps(details, ensure_ascii=False)}, *issue.images]
    async with AsyncOpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        timeout=90,
        max_retries=1,
        default_headers={"X-Title": "OIerDb Issue Classification"},
    ) as client:
        agent = Agent[QueryContext](
            name=name,
            instructions=instructions,
            model=OpenAIChatCompletionsModel(model=MODEL, openai_client=client),
            model_settings=ModelSettings(
                max_tokens=4096,
                reasoning=Reasoning(effort="low"),
                extra_body={"provider": {"require_parameters": True}},
            ),
            tools=tools,
            output_type=output_type,
        )
        completed = await Runner.run(
            agent,
            [{"role": "user", "content": content}],
            context=context,
            max_turns=MAX_AGENT_TURNS,
            run_config=RunConfig(tracing_disabled=True),
        )
    return completed.final_output.model_dump()


def _worker(request):
    context = QueryContext(warnings=request["warnings"])
    issue = IssueInput(**request["issue"])
    try:
        result = asyncio.run(_infer(request["api_key"], issue, context, request["skills"]))
        outcome = {"result": result}
    except MaxTurnsExceeded:
        outcome = {"error": f"Agent 超过 {MAX_AGENT_TURNS} 轮"}
    except APIError as error:
        status = getattr(error, "status_code", None) or type(error).__name__
        outcome = {"error": f"OpenRouter 请求失败（{MODEL}）：{status}"}
    except (AgentsException, ValidationError) as error:
        outcome = {"error": f"Agent 未返回有效结果：{type(error).__name__}"}
    return dict(outcome, context=asdict(context))


if __name__ == "__main__":
    request = json.load(sys.stdin)
    with redirect_stdout(sys.stderr):
        response = _worker(request)
    json.dump(response, sys.stdout)
