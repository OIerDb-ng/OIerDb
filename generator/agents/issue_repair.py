from collections.abc import Callable
from contextlib import redirect_stdout
from dataclasses import dataclass, field
from io import StringIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Annotated, Literal, TypedDict

from agents import RunContextWrapper, function_tool
from pydantic import BaseModel, ConfigDict, Field, model_validator

from generator.agents.issue_queries import ISSUE_QUERY_TOOLS, QueryContext
from generator.tools import oier_check, school_check
from loader import DEFAULT_RAW_FILE, DEFAULT_SCHOOL_FILE, iter_data_lines

RepairSkill = Literal["merge-oier", "split-oier", "merge-school", "split-school"]
SKILL_NAMES = {
    "merge-oier": "合并选手",
    "split-oier": "拆分选手",
    "merge-school": "合并学校",
    "split-school": "拆分学校",
}
SKILL_DIR = Path(__file__).resolve().parents[2] / ".agents" / "skills"
REPAIR_INSTRUCTIONS = Path(__file__).with_suffix(".md")

LineNumber = Annotated[int, Field(gt=0)]
SchoolRow = Annotated[str, Field(min_length=3, max_length=2000, pattern=r"^[^\r\n\x00]+$")]


class RepairSection(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    skill: RepairSkill
    simulation_ids: Annotated[list[LineNumber], Field(max_length=8)]
    reason: Annotated[str, Field(min_length=1, max_length=500)] | None

    @model_validator(mode="after")
    def consistent_comparison(self):
        if bool(self.simulation_ids) == bool(self.reason):
            raise ValueError("请引用有结论的检查，或说明无法确定处理方案的原因")
        return self


class RepairPlan(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    sections: Annotated[list[RepairSection], Field(min_length=1, max_length=4)]


class ComparisonEntry(TypedDict):
    label: str
    items: list[str]


class Comparison(TypedDict):
    target: str
    before: list[ComparisonEntry]
    after: list[ComparisonEntry]
    directions: list[str]


@dataclass
class ResolvedRepair:
    comparisons: list[tuple[RepairSkill, Comparison]] = field(default_factory=list)
    already_correct: list[RepairSkill] = field(default_factory=list)
    unplanned: dict[RepairSkill, str] = field(default_factory=dict)


def _record_simulation(context: QueryContext, tool: str, simulate: Callable[..., dict], **arguments) -> str:
    trace, result = context.query(tool, simulate, **arguments)
    comparison = result.pop("comparison", None)
    if result.get("verified") and comparison:
        trace["verified_changes"] = result["changes"]
        trace["comparison"] = comparison
        result["simulation_id"] = len(context.queries)
        result["directions"] = comparison["directions"]
    elif result.get("already_correct"):
        trace["already_correct"] = True
        result["simulation_id"] = len(context.queries)
    return json.dumps(result, ensure_ascii=False)


def _operation_directions(before, after):
    directions = []
    if any(sum(bool(entry & other) for other in before) > 1 for entry in after):
        directions.append("merge")
    if any(sum(bool(entry & other) for other in after) > 1 for entry in before):
        directions.append("split")
    return directions


def _award_text(row):
    contest, award, _, grade, school, _, province, _, _ = row.raw.split(",")
    details = " · ".join(value for value in (province, school, grade) if value)
    return f"{contest} {award}（{details}）" if details else f"{contest} {award}"


def _oier_entries(groups, affected) -> list[ComparisonEntry]:
    entries = [
        {"label": group[0].identifier, "items": [_award_text(row) for row in group]}
        for group in groups
        if any(row.phys_line in affected for row in group)
    ]
    return sorted(entries, key=lambda entry: (not entry["label"], entry["label"]))


def _simulate_oier_groups(name: str, expected_groups: list[list[int]]) -> dict:
    school_check.load_table(DEFAULT_SCHOOL_FILE)
    records, malformed = oier_check.load_name(name, DEFAULT_RAW_FILE)
    lines = [line for group in expected_groups for line in group]
    if not records or malformed:
        raise ValueError("没有可模拟的同名记录，或该姓名存在格式错误")
    if (
        not all(expected_groups)
        or len(lines) != len(records)
        or set(lines) != {row.phys_line for row in records}
    ):
        raise ValueError("期望分组必须恰好包含该姓名的全部物理行，每行只出现一次")

    expected_sets = [frozenset(group) for group in expected_groups]
    expectation = oier_check.Expectation(expected_sets, records)
    current_groups = oier_check.apply_and_simulate(records, {})
    result = {"current_groups": [[row.phys_line for row in group] for group in current_groups]}
    if expectation.all_ok(current_groups):
        return dict(result, verified=True, already_correct=True, changes=[], notes="当前分组已符合期望")

    current_sets = {frozenset(group) for group in result["current_groups"]}
    changed_groups = [group for group in expected_sets if group not in current_sets]
    changed_lines = set().union(*changed_groups)
    stripped = {line: "" for line in changed_lines}
    strip_groups = oier_check.apply_and_simulate(records, stripped)
    if expectation.all_ok(strip_groups):
        changes = [
            (row.phys_line, row.identifier, "")
            for row in records
            if row.phys_line in changed_lines and row.identifier
        ]
        suggestion = stripped
        notes = "去掉标识符后，自动合并得到期望分组"
    else:
        try:
            changed = oier_check.Expectation(changed_groups, records)
            changes, notes, suggestion = oier_check.suggest_identifiers(records, changed, strip_groups)
        except SystemExit as error:
            raise ValueError(str(error)) from None
    simulated = oier_check.apply_and_simulate(records, suggestion)
    verified = expectation.all_ok(simulated)
    if verified and changes:
        affected = changed_lines | {line for line, _, _ in changes}
        result["comparison"] = {
            "target": name,
            "before": _oier_entries(current_groups, affected),
            "after": _oier_entries(simulated, affected),
            "directions": _operation_directions(current_sets, expected_sets),
        }
    return dict(result, verified=verified, changes=changes if verified else [], notes=notes)


@function_tool
async def simulate_oier_groups(
    ctx: RunContextWrapper[QueryContext],
    name: str,
    expected_groups: list[list[LineNumber]],
) -> str:
    """用生成器验证同一完整姓名的期望分组，按组传入全部物理行，返回通过模拟的标识符改动。"""
    return _record_simulation(
        ctx.context, "simulate_oier_groups", _simulate_oier_groups, name=name, expected_groups=expected_groups
    )


@function_tool
async def find_school_placeholder() -> str:
    """查找可复用的学校占位行，返回物理行号；无占位时可在末尾追加。"""
    for physical, _, text in iter_data_lines(DEFAULT_SCHOOL_FILE):
        if text == ",,":
            return str(physical)
    return "无可用占位行"


class SchoolChange(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    physical_line: LineNumber
    before: SchoolRow
    after: SchoolRow


def _check_school_groups(expected_groups: list[list[str]]) -> dict:
    names = [name for group in expected_groups for name in group]
    matches = {name: set() for name in names}
    if len(matches) < 2 or len(matches) != len(names) or not all(expected_groups):
        raise ValueError("请提供至少两个已定位的校名，每个名称只填写一次")

    for _, _, _, school in school_check.load_table(DEFAULT_SCHOOL_FILE):
        for name in matches.keys() & {school.name, *school.aliases}:
            matches[name].add(school.id)
    if any(len(ids) != 1 for ids in matches.values()):
        return {"already_correct": False, "notes": "有名称无法唯一对应学校条目"}

    groups = [set().union(*(matches[name] for name in group)) for group in expected_groups]
    already_correct = all(len(ids) == 1 for ids in groups) and len(set().union(*groups)) == len(groups)
    notes = "当前学校条目已符合期望" if already_correct else "当前学校条目与期望分组不同"
    return {"already_correct": already_correct, "notes": notes}


@function_tool
async def check_school_groups(
    ctx: RunContextWrapper[QueryContext], expected_groups: list[list[str]]
) -> str:
    """核对学校目前的分组。每组填写应属于同一条目的精确校名或别名。"""
    return _record_simulation(
        ctx.context, "check_school_groups", _check_school_groups, expected_groups=expected_groups
    )


def _school_entries(rows):
    entries = []
    names = []
    for row in rows:
        if not row or row == ",,":
            continue
        province, city, name, *aliases = row.split(",")
        location = " · ".join(value for value in (province, city) if value and value != name)
        label = f"{name}（{location}）" if location else name
        aliases = list(dict.fromkeys(alias for alias in aliases if alias and alias != name))
        entries.append({"label": label, "items": aliases})
        names.append({name, *aliases})
    return entries, names


def _simulate_school_changes(changes, append_row):
    with DEFAULT_SCHOOL_FILE.open(encoding="utf-8", newline="") as source:
        rows = source.readlines()
    lines = {change["physical_line"] for change in changes}
    if len(lines) != len(changes) or not changes:
        raise ValueError("请提供要改动的物理行，每行只能修改一次")
    verified_changes = []
    for change in changes:
        physical = change["physical_line"]
        index = physical - 1
        before, after = change["before"].strip(), change["after"].strip()
        if not 0 <= index < len(rows) or rows[index].strip() != before:
            raise ValueError(f"物理行 {physical} 与仓库原文不符")
        if before == after or any(text.startswith("#") or text.count(",") < 2 for text in (before, after)):
            raise ValueError(f"物理行 {physical} 的候选改动无效")
        rows[index] = after + "\n"
        verified_changes.append((physical, before, after))
    if append_row is not None:
        append_row = append_row.strip()
        if append_row.startswith("#") or append_row.count(",") < 2:
            raise ValueError("候选追加行格式无效")
        rows[-1] = rows[-1].rstrip("\r\n") + "\n"
        rows.append(append_row + "\n")
        verified_changes.append((len(rows), None, append_row))

    output = StringIO()
    with TemporaryDirectory(prefix="oierdb-school-plan-") as directory:
        candidate = Path(directory) / "school.txt"
        candidate.write_text("".join(rows), encoding="utf-8")
        with redirect_stdout(output):
            school_check.simulate(candidate, DEFAULT_RAW_FILE, DEFAULT_SCHOOL_FILE)
    text = output.getvalue()
    verified_changes.sort(key=lambda change: (change[1] in (None, ",,"), change[0]))
    before, before_names = _school_entries(old for _, old, _ in verified_changes)
    after, after_names = _school_entries(new for _, _, new in verified_changes)
    return {
        "verified": True,
        "changes": verified_changes,
        "comparison": {
            "target": "",
            "before": before,
            "after": after,
            "directions": _operation_directions(before_names, after_names),
        },
        "impact": text[:12000],
        "output_truncated": len(text) > 12000,
    }


@function_tool
async def simulate_school_changes(
    ctx: RunContextWrapper[QueryContext],
    changes: Annotated[list[SchoolChange], Field(min_length=1, max_length=12)],
    append_row: SchoolRow | None,
) -> str:
    """模拟候选学校表，列出学校归属与选手分组变化。append_row 仅用于没有可用占位行时。"""
    return _record_simulation(
        ctx.context,
        "simulate_school_changes",
        _simulate_school_changes,
        changes=[change.model_dump() for change in changes],
        append_row=append_row,
    )


def repair_agent_config(skills: list[RepairSkill]):
    instructions = [REPAIR_INSTRUCTIONS.read_text(encoding="utf-8")]
    for skill in skills:
        instructions.append((SKILL_DIR / skill / "SKILL.md").read_text(encoding="utf-8"))
    tools = list(ISSUE_QUERY_TOOLS)
    if any(skill.endswith("-oier") for skill in skills):
        tools.append(simulate_oier_groups)
    if any(skill.endswith("-school") for skill in skills):
        tools.extend((check_school_groups, find_school_placeholder, simulate_school_changes))
    return "\n\n".join(instructions), tools


def _select_comparisons(section: RepairSection, queries: list[dict]) -> tuple[list[Comparison], bool]:
    direction, subject = section.skill.split("-", 1)
    tools = {"simulate_oier_groups"} if subject == "oier" else {"check_school_groups", "simulate_school_changes"}
    rows = {}
    comparisons = []
    already_correct = bool(section.simulation_ids)
    for number in dict.fromkeys(section.simulation_ids):
        if number > len(queries):
            raise ValueError(f"模拟 {number} 不存在")
        query = queries[number - 1]
        comparison = query.get("comparison")
        if query["tool"] not in tools:
            raise ValueError(f"检查 {number} 与所选技能不匹配")
        if query.get("already_correct"):
            continue
        already_correct = False
        if not comparison:
            raise ValueError(f"检查 {number} 未得出结论")
        if direction not in comparison["directions"]:
            continue
        for line, before, after in query["verified_changes"]:
            if rows.setdefault(line, (before, after)) != (before, after):
                raise ValueError("拟议修改中的模拟对同一行给出了不同建议")
        comparisons.append(comparison)
    return comparisons, already_correct


def resolve_plan(plan: RepairPlan, skills: list[RepairSkill], queries: list[dict]) -> ResolvedRepair:
    if sorted(section.skill for section in plan.sections) != sorted(skills):
        raise ValueError("方案所用技能与分类结果不一致")

    result = ResolvedRepair()
    for section in plan.sections:
        comparisons, already_correct = _select_comparisons(section, queries)
        if comparisons:
            result.comparisons.extend((section.skill, comparison) for comparison in comparisons)
        elif already_correct:
            result.already_correct.append(section.skill)
        else:
            result.unplanned[section.skill] = section.reason or "模拟变更与所选技能的方向不一致"
    return result
