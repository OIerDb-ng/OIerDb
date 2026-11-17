#!/usr/bin/env python3
"""检查 issue 是否重复，并同步 oierdb-bot 的提示评论。"""

import argparse
from collections import Counter
from collections.abc import Iterator
from html import escape
import json
from math import fsum
import os
from pathlib import Path
import re
import sys
import unicodedata

from github import GithubException
from github.Repository import Repository
from requests import RequestException
from requests.utils import parse_header_links

GENERATOR_DIR = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(GENERATOR_DIR.parent), str(GENERATOR_DIR)]
from generator.agents.issue_duplicates import IssueForComparison  # noqa: E402
from generator.agents.issue_runner import IssueAgentError, log_progress, run_duplicate_check  # noqa: E402
from generator.tools.comment import github_client, upsert_bot_comment  # noqa: E402

MARKER = "<!-- oierdb-issue-duplicates -->"
MAX_CANDIDATES = 16
MAX_ISSUE_BODY = 8000
MAX_CANDIDATE_BODY = 2000
FORM_CONFIRMATION = re.compile(
    r"(?m)^### 承诺[ \t]*\n+^- \[[ xX]\] 在提交这个 issue 前，我已确认我提交的信息是真实有效的。[ \t]*$"
)
SEARCH_TERMS = re.compile(r"(?:oier|school)/[0-9]+|[\u3400-\u9fff]+|[a-z0-9]+")


def comparison_issue(data: dict, body_limit: int) -> IssueForComparison:
    body = FORM_CONFIRMATION.sub("", data.get("body") or "").strip()
    if len(body) > body_limit:
        body = body[:body_limit] + "\n[正文已截断]"
    return {
        "number": data["number"],
        "title": data["title"],
        "body": body,
        "state": data["state"],
        "state_reason": data.get("state_reason"),
    }


def search_terms(issue: IssueForComparison) -> set[str]:
    body = re.sub(r"(?m)^### .*\n?", "", issue["body"].removesuffix("\n[正文已截断]"))
    text = unicodedata.normalize("NFKC", f"{issue['title']}\n{body}").casefold()
    terms = set()
    for word in SEARCH_TERMS.findall(text):
        if "\u3400" <= word[0] <= "\u9fff" and len(word) > 1:
            terms.update(word[index:index + 2] for index in range(len(word) - 1))
        else:
            terms.add(word)
    return terms


def repository_issues(repository: Repository) -> Iterator[dict]:
    # PyGithub 的 Issue.raw_data 会逐条补抓详情，列表接口已包含所需字段。
    url: str | None = f"{repository.url}/issues"
    parameters: dict[str, str | int] | None = {"state": "all", "per_page": 100}
    while url:
        headers, issues = repository.requester.requestJsonAndCheck("GET", url, parameters=parameters)
        yield from issues
        links = parse_header_links(headers.get("link", ""))
        url = next((link["url"] for link in links if link.get("rel") == "next"), None)
        parameters = None


def select_candidates(repository: Repository, issue: IssueForComparison) -> list[IssueForComparison]:
    query = search_terms(issue)
    if not query:
        return []

    matches = []
    frequencies = Counter()
    for data in repository_issues(repository):
        if data["number"] >= issue["number"] or "pull_request" in data:
            continue
        candidate = comparison_issue(data, MAX_CANDIDATE_BODY)
        overlap = query & search_terms(candidate)
        if overlap:
            matches.append((candidate, overlap))
            frequencies.update(overlap)

    # 降低分类标题和模板用语的权重，保留姓名、校名和记录 ID 等区分度较高的词。
    matches.sort(key=lambda item: (
        -fsum(1 / frequencies[term] for term in item[1]),
        item[0]["state"] != "open",
        item[0]["number"],
    ))
    return [candidate for candidate, _ in matches[:MAX_CANDIDATES]]


def format_comment(numbers: list[int]) -> str | None:
    if not numbers:
        return None
    links = "\n".join(f"- #{number}" for number in numbers)
    return (
        f"{MARKER}\n\n"
        f"**可能重复的 issue**\n\n{links}\n\n"
        "<sub>此提示由 AI 生成。</sub>"
    )


def check_issue(repository: Repository, number: int, api_key: str) -> dict:
    report = {"issue_number": number}
    data = repository.get_issue(number).raw_data
    for _ in range(2):
        author = data.get("user") or {}
        if (
            data["state"] != "open"
            or "pull_request" in data
            or author.get("type") == "Bot"
            or author.get("login", "").endswith("[bot]")
        ):
            return dict(report, status="skipped", summary="跳过已关闭的 issue、Pull Request 或机器人提交。")

        issue = comparison_issue(data, MAX_ISSUE_BODY)
        candidates = select_candidates(repository, issue)
        log_progress(f"Issue #{number} 筛选出 {len(candidates)} 个候选")
        if candidates and not api_key:
            raise ValueError("缺少 OPENROUTER_API_KEY")
        duplicates = run_duplicate_check(api_key, issue, candidates) if candidates else []

        current = repository.get_issue(number).raw_data
        fields = ("state", "title", "body")
        if all(current.get(field) == data.get(field) for field in fields):
            comment = upsert_bot_comment(repository.full_name, number, format_comment(duplicates), MARKER)
            return dict(report, status="checked", duplicate_numbers=duplicates, comment=comment)
        data = current
        log_progress(f"Issue #{number} 在检查期间发生变更")

    return dict(report, status="skipped", summary="Issue 在检查期间发生变更，跳过本次评论写入。")


def emit_report(report: dict) -> None:
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    print(rendered)
    if summary_path := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(summary_path, "a", encoding="utf-8") as output:
            output.write(f"## Issue duplicate check\n\n<pre>{escape(rendered)}</pre>\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--issue-number", type=int, required=True)
    parser.add_argument("--repository", default=os.environ.get("GITHUB_REPOSITORY", "OIerDb-ng/OIerDb"))
    args = parser.parse_args()
    if args.issue_number < 1:
        parser.error("--issue-number 必须为正整数")

    try:
        token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
        if not token:
            raise ValueError("缺少 GITHUB_TOKEN 或 GH_TOKEN")
        with github_client(token) as github:
            report = check_issue(
                github.get_repo(args.repository), args.issue_number, os.environ.get("OPENROUTER_API_KEY", "")
            )
    except GithubException as error:
        report = {"status": "failed", "summary": f"GitHub HTTP {error.status}"}
    except (IssueAgentError, ValueError) as error:
        report = {"status": "failed", "summary": str(error)}
    except (OSError, RequestException) as error:
        report = {"status": "failed", "summary": type(error).__name__}

    emit_report(report)
    return int(report["status"] == "failed")


if __name__ == "__main__":
    sys.exit(main())
