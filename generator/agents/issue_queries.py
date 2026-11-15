from collections.abc import Callable
from dataclasses import dataclass, field
import json
from typing import Annotated

from agents import RunContextWrapper, function_tool
from pydantic import Field

from query import lookup_oiers, lookup_schools, search_schools


@dataclass
class QueryContext:
    warnings: list[str] = field(default_factory=list)
    data_sources: dict = field(default_factory=dict)
    queries: list[dict] = field(default_factory=list)

    def query(self, tool: str, callback: Callable[..., dict], **arguments) -> tuple[dict, dict]:
        query = {"tool": tool, "arguments": arguments}
        self.queries.append(query)
        try:
            result = callback(**arguments)
        except (ValueError, OSError) as error:
            message = f"{tool} 查询失败：{error}"
            self.warnings.append(message)
            result = {"error": message}
        if "source" in result:
            self.data_sources["repository"] = result["source"]
        return query, result

    def lookup(self, tool: str, callback: Callable[..., dict], **arguments) -> str:
        _, result = self.query(tool, callback, **arguments)
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


ISSUE_QUERY_TOOLS = [get_oier, find_oiers, get_school, find_schools]
