#!/usr/bin/env python3
"""根据 GitHub Actions 事件和评论首行的 HTML 标记创建或更新评论。"""

import argparse
import json
import os
import re
from pathlib import Path

from github import Auth, Github, GithubException
from github.Issue import Issue


def github_client(token=""):
    return Github(
        auth=Auth.Token(token) if token else None,
        lazy=True,
        timeout=30,
        retry=1,
        api_version="2022-11-28",
    )


def upsert_comment(issue: Issue, body: str, author: str, marker: str) -> dict:
    for comment in issue.get_comments():
        if comment.user.login == author and (comment.body or "").startswith(marker + "\n"):
            if comment.body == body:
                return {"status": "unchanged", "comment_url": comment.html_url}
            comment.edit(body)
            return {"status": "comment_updated", "comment_url": comment.html_url}
    comment = issue.create_comment(body)
    return {"status": "comment_created", "comment_url": comment.html_url}


def upsert_bot_comment(repository, number, body, marker):
    token = os.environ.get("OIERDB_BOT_TOKEN")
    slug = os.environ.get("OIERDB_BOT_SLUG")
    if not token or not slug:
        raise ValueError("需要 OIERDB_BOT_TOKEN 和 OIERDB_BOT_SLUG")
    with github_client(token) as github:
        issue = github.get_repo(repository).get_issue(number)
        return upsert_comment(issue, body, f"{slug}[bot]", marker)


def read_github_event():
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if not event_path:
        raise ValueError("需要 GITHUB_EVENT_PATH")
    return json.loads(Path(event_path).read_text(encoding="utf-8"))


def upsert_pr_comment(repository, expected_pr, body, marker):
    number = expected_pr["number"]
    with github_client(os.environ["GITHUB_TOKEN"]) as github:
        pr = github.get_repo(repository).get_pull(number)
        if (
            pr.state != "open"
            or pr.head.sha != expected_pr["head"]["sha"]
            or pr.base.ref != expected_pr["base"]["ref"]
        ):
            return None
    return upsert_bot_comment(repository, number, body, marker)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("body_file", type=Path)
    args = parser.parse_args()

    repository = os.environ["GITHUB_REPOSITORY"]
    body = args.body_file.read_text(encoding="utf-8")
    marker, newline, _ = body.partition("\n")
    if not newline or not re.fullmatch(r"<!-- [\w-]+ -->", marker):
        parser.error("评论首行需要 HTML 标记")

    try:
        event = read_github_event()
        if pr := event.get("pull_request"):
            result = upsert_pr_comment(repository, pr, body, marker)
        elif issue := event.get("issue"):
            result = upsert_bot_comment(repository, issue["number"], body, marker)
        else:
            parser.error("GitHub 事件中缺少 Issue 或 PR")
        print(result["comment_url"] if result else "PR 已更新或关闭，跳过评论。")
    except GithubException as error:
        raise SystemExit(f"GitHub HTTP {error.status}") from None
    except ValueError as error:
        raise SystemExit(str(error)) from None


if __name__ == "__main__":
    main()
