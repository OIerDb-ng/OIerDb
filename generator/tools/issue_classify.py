#!/usr/bin/env python3
"""整理 issue 的标题和标签，按需生成修复方案。"""

import argparse
import base64
from datetime import datetime, timedelta, timezone
from html import escape, unescape
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urljoin, urlparse

import requests
from github import GithubException
from github.Issue import Issue

GENERATOR_DIR = Path(__file__).resolve().parents[1]
# generator/agents 使用命名空间包，避免遮蔽第三方 agents SDK。
sys.path[:0] = [str(GENERATOR_DIR.parent), str(GENERATOR_DIR)]
from generator.agents.issue_classify import ClassificationResult  # noqa: E402
from generator.agents.issue_queries import QueryContext  # noqa: E402
from generator.agents.issue_repair import Comparison, ComparisonEntry, RepairSkill, SKILL_NAMES  # noqa: E402
from generator.agents.issue_runner import (  # noqa: E402
    IssueAgentError,
    IssueInput,
    log_progress,
    run_classification,
    run_repair,
)
from generator.tools.comment import github_client, upsert_bot_comment, upsert_comment  # noqa: E402

SUBJECT_LABELS = {"oier": "选手信息错误", "school": "学校信息错误"}
LABEL_COLORS = {"oier": "1d76db", "school": "0e8a16"}
MANAGED_LABELS = {label.casefold() for label in (*SUBJECT_LABELS.values(), "bug", "enhancement")}
MAX_IMAGES = 4
MAX_IMAGE_BYTES = 5 * 1024 * 1024
REPAIR_COMMENT_MARKER = "<!-- oierdb-repair-plan -->"
NO_ISSUE_MESSAGE = "经初步自动化分析发现目前 issue 中提到的问题在检查时已不存在，请检查问题描述是否正确"
MARKDOWN_ENTITIES = str.maketrans({char: f"&#{ord(char)};" for char in "\\`*_{}[]<>&@#~|!:.+-"})
WORKFLOW_ERRORS = (IssueAgentError, GithubException, requests.RequestException, OSError, ValueError)


def label_names(issue):
    return sorted(label["name"] if isinstance(label, dict) else label for label in issue.get("labels", []))


class ImageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        if tag == "img":
            source = dict(attrs).get("src")
            if source:
                self.urls.append(source)


def image_urls(body):
    urls = []
    pattern = r"!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\)|<img\b[^>]*>"
    for match in re.finditer(pattern, body or "", re.IGNORECASE):
        if match[1] or match[2]:
            urls.append(unescape(match[1] or match[2]))
        else:
            parser = ImageParser()
            parser.feed(match[0])
            urls.extend(parser.urls)
    return list(dict.fromkeys(urls))


def allowed_image_url(value, *, redirect=False):
    try:
        url = urlparse(value)
        port = url.port
    except ValueError:
        return False
    if url.scheme != "https" or url.username or url.password or port not in (None, 443):
        return False
    if url.hostname == "github.com":
        return bool(re.fullmatch(r"/user-attachments/assets/[0-9a-fA-F-]+", url.path))
    if url.hostname in {"user-images.githubusercontent.com", "private-user-images.githubusercontent.com"}:
        return True
    if redirect:
        return url.hostname in {
            "objects.githubusercontent.com",
            "release-assets.githubusercontent.com",
        } or bool(
            re.fullmatch(
                r"github-production-user-asset-[0-9a-f]+\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com", url.hostname or ""
            )
        )
    return False


def image_mime(data):
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    raise ValueError("图片格式不是 PNG、JPEG 或 WebP")


def download_image(session, url):
    for attempt in range(4):
        if not allowed_image_url(url, redirect=attempt > 0):
            raise ValueError("图片地址或重定向不在 GitHub 托管来源内")
        with session.get(url, stream=True, allow_redirects=False, timeout=(10, 15)) as response:
            if response.status_code in (301, 302, 303, 307, 308):
                url = urljoin(url, response.headers.get("Location", ""))
                continue
            if response.status_code != 200:
                raise ValueError(f"图片下载 HTTP {response.status_code}")
            if int(response.headers.get("Content-Length", "0")) > MAX_IMAGE_BYTES:
                raise ValueError("图片超过 5 MiB")
            data = bytearray()
            for chunk in response.iter_content(65536):
                data.extend(chunk)
                if len(data) > MAX_IMAGE_BYTES:
                    raise ValueError("图片超过 5 MiB")
            mime = image_mime(data)
            return {
                "type": "input_image",
                "image_url": f"data:{mime};base64,{base64.b64encode(data).decode()}",
                "detail": "auto",
            }
    raise ValueError("图片重定向次数过多")


def collect_images(*bodies: str):
    images, warnings = [], []
    urls = list(dict.fromkeys(url for body in bodies for url in image_urls(body)))
    with requests.Session() as session:
        # 附件下载不使用 .netrc 或代理配置。
        session.trust_env = False
        for index, url in enumerate(urls[:MAX_IMAGES], 1):
            try:
                images.append(download_image(session, url))
            except (requests.RequestException, ValueError):
                warnings.append(f"第 {index} 张截图不可用。")
    if len(urls) > MAX_IMAGES:
        warnings.append(f"截图共 {len(urls)} 张，仅读取前 {MAX_IMAGES} 张。")
    return images, warnings


class GitHub:
    def __init__(self, repository, token=""):
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
            raise ValueError("请通过 --repository 或 GITHUB_REPOSITORY 指定 owner/repo")
        self.client = github_client(token)
        self.repository_name = repository
        self.repository = self.client.get_repo(repository)

    def get_issue(self, number: int) -> Issue:
        return self.repository.get_issue(number)

    def ensure_label(self, subject):
        name = SUBJECT_LABELS[subject]
        try:
            self.repository.get_label(name)
            return
        except GithubException as error:
            if error.status != 404:
                raise
        try:
            self.repository.create_label(name, LABEL_COLORS[subject])
        except GithubException as error:
            if error.status != 422:
                raise
            # 并发创建同名标签时，确认标签已存在。
            self.repository.get_label(name)

    def close(self):
        self.client.close()


def _markdown_text(value: str) -> str:
    return " ".join(value.splitlines()).translate(MARKDOWN_ENTITIES)


def _format_entries(entries: list[ComparisonEntry]) -> str:
    lines = []
    for entry in entries:
        lines.append(f"- {_markdown_text(entry['label'] or '(空)')}")
        lines.extend(f"  - {_markdown_text(item)}" for item in entry["items"])
    return "\n".join(lines)


def format_repair_comment(
    comparisons: list[tuple[RepairSkill, Comparison]], commit: str, repository: str, *, already_correct: bool = False
) -> str | None:
    if not comparisons and not already_correct:
        return None
    if not re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", commit):
        raise ValueError("缺少方案所基于的仓库提交")
    parts = [REPAIR_COMMENT_MARKER, "**预期处理前后对比**" if comparisons else NO_ISSUE_MESSAGE]
    for skill, comparison in comparisons:
        if len(comparisons) > 1:
            target = comparison["target"]
            title = SKILL_NAMES[skill] + (f"「{_markdown_text(target)}」" if target else "")
            parts.append(f"**{title}**")
        before, after = comparison["before"], comparison["after"]
        current = "当前为单一条目：" if len(before) == 1 else f"当前为 {len(before)} 个条目："
        direction = "合并" if skill.startswith("merge-") else "拆分"
        parts.extend((current, _format_entries(before), f"应作如下{direction}：", _format_entries(after)))
    generated_at = datetime.now(timezone(timedelta(hours=8))).isoformat(sep=" ", timespec="seconds")
    parts.extend((
        "<hr />",
        "<sub>此建议由 AI 生成，采纳前请检查准确性。</sub><br />"
        f"<sub>基于 [`{commit[:7]}`](https://github.com/{repository}/tree/{commit}) 时的仓库生成。</sub><br />"
        f"<sub>最后更新于：{generated_at}</sub>",
    ))
    body = "\n\n".join(parts)
    if len(body) > 60000:
        raise ValueError("修复方案超出评论长度限制")
    return body


def plan_issue_repair(
    client: GitHub,
    issue: Issue,
    api_key: str,
    agent_input: IssueInput,
    skills: list[RepairSkill],
    *,
    warnings: list[str],
) -> dict:
    context = QueryContext(warnings=warnings.copy())
    try:
        plan = run_repair(api_key, agent_input, context, skills)
        source = context.data_sources.get("repository", {})
        commit = source.get("commit") or os.environ.get("GITHUB_SHA", "")
        body = format_repair_comment(
            plan.comparisons, commit, client.repository_name,
            already_correct=bool(plan.already_correct) and not plan.unplanned,
        )
        if body is None:
            result = {"status": "skipped", "summary": "没有可展示的处理前后对比。"}
        else:
            log_progress("写入修复方案评论")
            if os.environ.get("OIERDB_BOT_TOKEN"):
                result = upsert_bot_comment(client.repository_name, issue.number, body, REPAIR_COMMENT_MARKER)
            else:
                if os.environ.get("GITHUB_ACTIONS") == "true":
                    author = "github-actions[bot]"
                else:
                    author = client.client.get_user().login
                result = upsert_comment(issue, body, author, REPAIR_COMMENT_MARKER)
        if plan.unplanned:
            result["unplanned"] = plan.unplanned
        if plan.already_correct:
            result["already_correct"] = plan.already_correct
    except WORKFLOW_ERRORS as error:
        result = {"status": "failed", "summary": error_summary(error)}
    return dict(result, warnings=context.warnings, data_sources=context.data_sources, queries=context.queries)


def update_classification(client: GitHub, issue: Issue, classification: ClassificationResult) -> dict:
    data = issue.raw_data
    old_title = data["title"]
    old_labels = label_names(data)
    title = classification.title or old_title
    labels = sorted({
        *(label for label in old_labels if label.casefold() not in MANAGED_LABELS),
        *(SUBJECT_LABELS[subject] for subject in classification.subjects),
    })
    report = {
        "old_title": old_title,
        "new_title": title,
        "labels_added": sorted(set(labels) - set(old_labels)),
        "labels_removed": sorted(set(old_labels) - set(labels)),
    }

    if title == old_title and labels == old_labels:
        return dict(report, status="unchanged")

    log_progress("更新 issue 标题和标签")
    for subject in classification.subjects:
        client.ensure_label(subject)
    issue.edit(title=title, labels=labels)
    return dict(report, status="updated")


def classify_issue(client: GitHub, number: int, api_key: str, *, plan_repair=False) -> dict:
    issue = client.get_issue(number)
    data = issue.raw_data
    report = {
        "issue_number": number,
        "status": "skipped",
        "warnings": [],
    }
    author = data.get("user") or {}
    if (
        data["state"] != "open"
        or "pull_request" in data
        or author.get("type") == "Bot"
        or author.get("login", "").endswith("[bot]")
    ):
        return dict(report, summary="跳过已关闭的 issue、Pull Request 或机器人提交。")
    if not api_key:
        raise ValueError("缺少 OPENROUTER_API_KEY")

    body = data.get("body") or ""
    comments = [
        {"author": comment.user.login, "body": comment.body}
        for comment in issue.get_comments()
        if comment.user and comment.user.type == "User" and (comment.body or "").strip()
    ]
    images, image_warnings = collect_images(body, *(comment["body"] for comment in comments))
    log_progress(f"已读取 {len(comments)} 条评论和 {len(images)} 张截图")
    agent_input = IssueInput(data["title"], body, label_names(data), images, comments=comments)
    context = QueryContext(warnings=image_warnings.copy())
    classification = run_classification(api_key, agent_input, context)
    report.update(
        summary=classification.summary,
        warnings=context.warnings,
        data_sources=context.data_sources,
        queries=context.queries,
    )
    if not classification.applicable:
        return report

    report["skills"] = classification.skills
    report.update(update_classification(client, issue, classification))
    if plan_repair and classification.skills:
        report["repair_plan"] = plan_issue_repair(
            client, issue, api_key, agent_input, classification.skills, warnings=image_warnings,
        )
    return report


def emit_report(report):
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    print(rendered)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as output:
            output.write(f"## Issue classification\n\n<pre>{escape(rendered)}</pre>\n")


def error_summary(error):
    # 外部异常可能包含签名 URL 或响应正文。
    if isinstance(error, (IssueAgentError, ValueError)):
        return str(error)
    if isinstance(error, GithubException):
        return f"GitHub HTTP {error.status}"
    return type(error).__name__


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--issue-number", type=int)
    parser.add_argument("--repository", default=os.environ.get("GITHUB_REPOSITORY", "OIerDb-ng/OIerDb"))
    parser.add_argument("--plan-repair", action="store_true", help="分类后为匹配的修复技能生成方案")
    args = parser.parse_args()
    client = None
    try:
        event = {}
        if os.environ.get("GITHUB_EVENT_PATH"):
            event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
        event_name = os.environ.get("GITHUB_EVENT_NAME")
        expected_action = {"issues": "opened", "issue_comment": "created"}.get(event_name)
        if expected_action and event.get("action") != expected_action:
            emit_report({"status": "skipped", "summary": f"仅处理 {event_name}.{expected_action} 事件。"})
            return 0
        number = args.issue_number if args.issue_number is not None else event.get("issue", {}).get("number")
        if type(number) is not int or number < 1:
            raise ValueError("issue_number 必须为正整数")
        token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN", "")
        if not token:
            raise ValueError("写回需要 GITHUB_TOKEN 或 GH_TOKEN")
        log_progress(f"开始处理 issue #{number}")
        client = GitHub(args.repository, token)
        report = classify_issue(
            client,
            number,
            os.environ.get("OPENROUTER_API_KEY", ""),
            plan_repair=args.plan_repair,
        )
        emit_report(report)
        return int(report.get("repair_plan", {}).get("status") == "failed")
    except WORKFLOW_ERRORS as error:
        emit_report({"status": "failed", "summary": error_summary(error)})
        return 1
    finally:
        if client is not None:
            client.close()


if __name__ == "__main__":
    sys.exit(main())
