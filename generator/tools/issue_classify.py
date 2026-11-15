#!/usr/bin/env python3
"""整理 issue 的标题和标签，按需生成修复方案。"""

import argparse
import base64
from html import escape, unescape
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urljoin, urlparse

import requests
from github import Auth, Github, GithubException
from github.Issue import Issue

GENERATOR_DIR = Path(__file__).resolve().parents[1]
# generator/agents 使用命名空间包，避免遮蔽第三方 agents SDK。
sys.path[:0] = [str(GENERATOR_DIR.parent), str(GENERATOR_DIR)]
from generator.agents.issue_classify import ClassificationResult  # noqa: E402
from generator.agents.issue_queries import QueryContext  # noqa: E402
from generator.agents.issue_repair import Comparison, ComparisonEntry, RepairSkill, SKILL_NAMES  # noqa: E402
from generator.agents.issue_runner import IssueAgentError, IssueInput, run_classification, run_repair  # noqa: E402

SUBJECT_LABELS = {"oier": "选手信息错误", "school": "学校信息错误"}
LABEL_COLORS = {"oier": "1d76db", "school": "0e8a16"}
MANAGED_LABELS = {label.casefold() for label in (*SUBJECT_LABELS.values(), "bug", "enhancement")}
MAX_IMAGES = 4
MAX_IMAGE_BYTES = 5 * 1024 * 1024
REPAIR_COMMENT_MARKER = "<!-- oierdb-repair-plan -->"
MARKDOWN_ENTITIES = str.maketrans({char: f"&#{ord(char)};" for char in "\\`*_{}[]<>&@#~|!:.+-"})
WORKFLOW_ERRORS = (IssueAgentError, GithubException, requests.RequestException, OSError, ValueError)


def label_names(issue):
    return sorted(label["name"] if isinstance(label, dict) else label for label in issue.get("labels", []))


def snapshot(issue):
    return (
        issue.get("title"),
        issue.get("body"),
        label_names(issue),
        issue.get("state"),
        issue.get("updated_at"),
    )


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


def collect_images(body):
    images, warnings = [], []
    urls = image_urls(body)
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
        self.client = Github(
            auth=Auth.Token(token) if token else None,
            lazy=True,
            timeout=30,
            retry=1,
            api_version="2022-11-28",
        )
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

    def upsert_repair_comment(self, number, body, expected_issue):
        issue = self.get_issue(number)
        author = (
            "github-actions[bot]" if os.environ.get("GITHUB_ACTIONS") == "true" else self.client.get_user().login
        )
        existing = next(
            (
                comment
                for comment in issue.get_comments()
                if comment.user.login == author and (comment.body or "").startswith(REPAIR_COMMENT_MARKER + "\n")
            ),
            None,
        )
        current = self.get_issue(number)
        if snapshot(current.raw_data) != snapshot(expected_issue):
            return {"status": "skipped", "summary": "生成方案期间 issue 已发生变化，跳过评论。"}
        if existing is None:
            comment = current.create_comment(body)
            return {"status": "comment_created", "comment_url": comment.html_url}
        if existing.body == body:
            return {"status": "unchanged", "comment_url": existing.html_url}
        existing.edit(body)
        return {"status": "comment_updated", "comment_url": existing.html_url}

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
    comparisons: list[tuple[RepairSkill, Comparison]], commit: str, repository: str
) -> str | None:
    if not comparisons:
        return None
    if not re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", commit):
        raise ValueError("缺少方案所基于的仓库提交")
    parts = [REPAIR_COMMENT_MARKER, "**预期处理前后对比**"]
    for skill, comparison in comparisons:
        if len(comparisons) > 1:
            target = comparison["target"]
            title = SKILL_NAMES[skill] + (f"「{_markdown_text(target)}」" if target else "")
            parts.append(f"**{title}**")
        before, after = comparison["before"], comparison["after"]
        current = "当前为单一条目：" if len(before) == 1 else f"当前为 {len(before)} 个条目："
        direction = "合并" if skill.startswith("merge-") else "拆分"
        parts.extend((current, _format_entries(before), f"应作如下{direction}：", _format_entries(after)))
    parts.extend((
        "<hr />",
        f"<small>基于提交 [`{commit[:7]}`](https://github.com/{repository}/tree/{commit})，"
        "此回复为 AI 生成，不保证准确性。</small>",
    ))
    body = "\n\n".join(parts)
    if len(body) > 60000:
        raise ValueError("修复方案超出评论长度限制")
    return body


def plan_issue_repair(
    client: GitHub,
    expected_issue: dict,
    api_key: str,
    issue: IssueInput,
    skills: list[RepairSkill],
    *,
    apply: bool,
    warnings: list[str],
) -> dict:
    context = QueryContext(warnings=warnings.copy())
    try:
        plan = run_repair(api_key, issue, context, skills)
        source = context.data_sources.get("repository", {})
        commit = source.get("commit") or os.environ.get("GITHUB_SHA", "")
        body = format_repair_comment(plan.comparisons, commit, client.repository_name)
        if body is None:
            result = {"status": "skipped", "summary": "没有可展示的处理前后对比。"}
        elif apply:
            result = client.upsert_repair_comment(expected_issue["number"], body, expected_issue)
        else:
            result = {"status": "preview", "comment_body": body}
        if plan.unplanned:
            result["unplanned"] = plan.unplanned
    except WORKFLOW_ERRORS as error:
        result = {"status": "failed", "summary": error_summary(error)}
    return dict(result, warnings=context.warnings, data_sources=context.data_sources, queries=context.queries)


def classified_issue(issue: dict, classification: ClassificationResult) -> dict:
    labels = sorted({
        *(label for label in label_names(issue) if label.casefold() not in MANAGED_LABELS),
        *(SUBJECT_LABELS[subject] for subject in classification.subjects),
    })
    return dict(issue, title=classification.title or issue["title"], labels=labels)


def update_classification(
    client: GitHub, issue: dict, desired: dict, subjects: list[str], *, apply: bool
) -> dict:
    old_title, title = issue["title"], desired["title"]
    old_labels, labels = label_names(issue), desired["labels"]
    report = {
        "old_title": old_title,
        "new_title": title,
        "labels_added": sorted(set(labels) - set(old_labels)),
        "labels_removed": sorted(set(old_labels) - set(labels)),
    }

    if title == old_title and labels == old_labels:
        return dict(report, status="unchanged")

    number = issue["number"]
    current = client.get_issue(number)
    if snapshot(current.raw_data) != snapshot(issue):
        return dict(report, status="skipped", summary="分析期间 issue 已发生变化，跳过写回。")
    if not apply:
        return dict(report, status="preview")

    if subjects:
        for subject in subjects:
            client.ensure_label(subject)
        current = client.get_issue(number)
        if snapshot(current.raw_data) != snapshot(issue):
            return dict(report, status="skipped", summary="写回前 issue 已发生变化，跳过写回。")

    current.edit(title=title, labels=labels)
    return dict(report, status="updated")


def classify_issue(
    client: GitHub, number: int, api_key: str, *, apply=False, opened_issue: dict | None = None, plan_repair=False
) -> dict:
    issue = client.get_issue(number).raw_data
    report = {
        "issue_number": number,
        "mode": "apply" if apply else "dry_run",
        "status": "skipped",
        "warnings": [],
    }
    author = issue.get("user") or {}
    if (
        issue["state"] != "open"
        or "pull_request" in issue
        or author.get("type") == "Bot"
        or author.get("login", "").endswith("[bot]")
    ):
        return dict(report, summary="跳过已关闭的 issue、Pull Request 或机器人提交。")
    if opened_issue is not None and snapshot(issue) != snapshot(opened_issue):
        return dict(report, summary="issue 自创建事件后已发生变化，保留人工修改。")
    if not api_key:
        raise ValueError("缺少 OPENROUTER_API_KEY")

    body = issue.get("body") or ""
    images, image_warnings = collect_images(body)
    agent_input = IssueInput(issue["title"], body, label_names(issue), images)
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
    desired = classified_issue(issue, classification)
    report.update(update_classification(client, issue, desired, classification.subjects, apply=apply))
    if not plan_repair or not classification.skills or report["status"] == "skipped":
        return report

    expected_issue = issue
    if report["status"] == "updated":
        expected_issue = client.get_issue(number).raw_data
        edited_issue = dict(desired, updated_at=expected_issue["updated_at"])
        if snapshot(expected_issue) != snapshot(edited_issue):
            report["repair_plan"] = {"status": "skipped", "summary": "分类后 issue 已发生变化，跳过方案。"}
            return report

    report["repair_plan"] = plan_issue_repair(
        client, expected_issue, api_key, agent_input, classification.skills, apply=apply, warnings=image_warnings,
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
    parser.add_argument("--apply", action="store_true", help="写回 GitHub，默认仅预览")
    parser.add_argument("--plan-repair", action="store_true", help="分类后为匹配的修复技能生成方案")
    args = parser.parse_args()
    client = None
    try:
        event = {}
        if os.environ.get("GITHUB_EVENT_PATH"):
            event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
        if os.environ.get("GITHUB_EVENT_NAME") == "issues" and event.get("action") != "opened":
            emit_report({"status": "skipped", "summary": "仅处理 issues.opened 事件。"})
            return 0
        number = args.issue_number if args.issue_number is not None else event.get("issue", {}).get("number")
        if type(number) is not int or number < 1:
            raise ValueError("issue_number 必须为正整数")
        token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN", "")
        if args.apply and not token:
            raise ValueError("写回需要 GITHUB_TOKEN 或 GH_TOKEN")
        client = GitHub(args.repository, token)
        report = classify_issue(
            client,
            number,
            os.environ.get("OPENROUTER_API_KEY", ""),
            apply=args.apply,
            opened_issue=event.get("issue") if event.get("action") == "opened" else None,
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
