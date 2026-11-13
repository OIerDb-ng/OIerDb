#!/usr/bin/env python3
"""整理 issue 的标题和标签。"""

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

GENERATOR_DIR = Path(__file__).resolve().parents[1]
# generator/agents 使用命名空间包，避免遮蔽第三方 agents SDK。
sys.path[:0] = [str(GENERATOR_DIR.parent), str(GENERATOR_DIR)]
from generator.agents.issue_classify import ClassificationError, QueryContext, infer  # noqa: E402

SUBJECT_LABELS = {"oier": "选手信息错误", "school": "学校信息错误"}
LABEL_COLORS = {"oier": "1d76db", "school": "0e8a16"}
MANAGED_LABELS = {*SUBJECT_LABELS.values(), "bug", "enhancement"}
MAX_IMAGES = 4
MAX_IMAGE_BYTES = 5 * 1024 * 1024


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
    raise ClassificationError("图片格式不是 PNG、JPEG 或 WebP")


def download_image(session, url):
    for attempt in range(4):
        if not allowed_image_url(url, redirect=attempt > 0):
            raise ClassificationError("图片地址或重定向不在 GitHub 托管来源内")
        with session.get(url, stream=True, allow_redirects=False, timeout=(10, 15)) as response:
            if response.status_code in (301, 302, 303, 307, 308):
                url = urljoin(url, response.headers.get("Location", ""))
                continue
            if response.status_code != 200:
                raise ClassificationError(f"图片下载 HTTP {response.status_code}")
            if int(response.headers.get("Content-Length", "0")) > MAX_IMAGE_BYTES:
                raise ClassificationError("图片超过 5 MiB")
            data = bytearray()
            for chunk in response.iter_content(65536):
                data.extend(chunk)
                if len(data) > MAX_IMAGE_BYTES:
                    raise ClassificationError("图片超过 5 MiB")
            mime = image_mime(data)
            return {
                "type": "input_image",
                "image_url": f"data:{mime};base64,{base64.b64encode(data).decode()}",
                "detail": "auto",
            }
    raise ClassificationError("图片重定向次数过多")


def collect_images(body):
    images, warnings = [], []
    urls = image_urls(body)
    with requests.Session() as session:
        # 附件下载不使用 .netrc 或代理配置。
        session.trust_env = False
        for index, url in enumerate(urls[:MAX_IMAGES], 1):
            try:
                images.append(download_image(session, url))
            except (requests.RequestException, ClassificationError, ValueError):
                warnings.append(f"第 {index} 张截图不可用。")
    if len(urls) > MAX_IMAGES:
        warnings.append(f"截图共 {len(urls)} 张，仅读取前 {MAX_IMAGES} 张。")
    return images, warnings


class GitHub:
    def __init__(self, repository, token=""):
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
            raise ClassificationError("请通过 --repository 或 GITHUB_REPOSITORY 指定 owner/repo")
        self.client = Github(
            auth=Auth.Token(token) if token else None,
            lazy=True,
            timeout=30,
            retry=1,
            api_version="2022-11-28",
        )
        self.repository = self.client.get_repo(repository)
        self.current_issue = None

    def get_issue(self, number):
        self.current_issue = self.repository.get_issue(number)
        return self.current_issue.raw_data

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

    def update_issue(self, number, title, labels):
        issue = self.current_issue
        if issue is None or issue.number != number:
            issue = self.repository.get_issue(number)
        issue.edit(title=title, labels=labels)

    def close(self):
        self.client.close()


def classify_issue(client, number, api_key, *, apply=False, opened_issue=None):
    issue = client.get_issue(number)
    report = {
        "issue_number": number,
        "mode": "apply" if apply else "dry_run",
        "status": "skipped",
        "warnings": [],
    }
    author = issue.get("user") or {}
    if (
        issue.get("state") != "open"
        or "pull_request" in issue
        or author.get("type") == "Bot"
        or author.get("login", "").endswith("[bot]")
    ):
        report["summary"] = "跳过已关闭的 issue、Pull Request 或机器人提交。"
        return report
    if opened_issue is not None and snapshot(issue) != snapshot(opened_issue):
        report["summary"] = "issue 自创建事件后已发生变化，保留人工修改。"
        return report
    if not api_key:
        raise ClassificationError("缺少 OPENROUTER_API_KEY")
    context = QueryContext()
    images, image_warnings = collect_images(issue.get("body"))
    context.warnings.extend(image_warnings)
    result = infer(api_key, issue, context, images)
    report.update(warnings=context.warnings, data_sources=context.data_sources, queries=context.queries)
    report["summary"] = result["summary"]
    if not result["applicable"]:
        return report
    old_labels = label_names(issue)
    preserved = [
        label for label in old_labels if label.casefold() not in {name.casefold() for name in MANAGED_LABELS}
    ]
    labels = sorted({*preserved, *(SUBJECT_LABELS[subject] for subject in result["subjects"])})
    title = result["title"] if result["title"] is not None else issue["title"]
    report.update(
        {
            "old_title": issue["title"],
            "new_title": title,
            "labels_added": sorted(set(labels) - set(old_labels)),
            "labels_removed": sorted(set(old_labels) - set(labels)),
        }
    )
    if title == issue["title"] and labels == old_labels:
        report["status"] = "unchanged"
        return report
    if snapshot(client.get_issue(number)) != snapshot(issue):
        report["summary"] = "分析期间 issue 已发生变化，跳过写回。"
        return report
    if not apply:
        report["status"] = "preview"
        return report
    for subject in result["subjects"]:
        client.ensure_label(subject)
    if snapshot(client.get_issue(number)) != snapshot(issue):
        report["summary"] = "写回前 issue 已发生变化，跳过写回。"
        return report
    client.update_issue(number, title, labels)
    report["status"] = "updated"
    return report


def emit_report(report):
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    print(rendered)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as output:
            output.write(f"## Issue classification\n\n<pre>{escape(rendered)}</pre>\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--issue-number", type=int)
    parser.add_argument("--repository", default=os.environ.get("GITHUB_REPOSITORY", "OIerDb-ng/OIerDb"))
    parser.add_argument("--apply", action="store_true", help="写回 GitHub，默认仅预览")
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
            raise ClassificationError("issue_number 必须为正整数")
        token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN", "")
        if args.apply and not token:
            raise ClassificationError("写回需要 GITHUB_TOKEN 或 GH_TOKEN")
        client = GitHub(args.repository, token)
        report = classify_issue(
            client,
            number,
            os.environ.get("OPENROUTER_API_KEY", ""),
            apply=args.apply,
            opened_issue=event.get("issue") if event.get("action") == "opened" else None,
        )
        emit_report(report)
        return 0
    except (ClassificationError, GithubException, requests.RequestException, OSError, ValueError) as error:
        # 外部异常可能包含签名 URL 或响应正文。
        message = (
            str(error)
            if isinstance(error, ClassificationError)
            else (
                f"GitHub HTTP {error.status}" if isinstance(error, GithubException) else type(error).__name__
            )
        )
        emit_report({"status": "failed", "summary": message})
        return 1
    finally:
        if client is not None:
            client.close()


if __name__ == "__main__":
    sys.exit(main())
