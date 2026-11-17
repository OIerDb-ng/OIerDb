"""Issue 和 PR 共用的 GitHub 评论函数。"""

import os

from github import Auth, Github
from github.Issue import Issue


def github_client(token=""):
    return Github(
        auth=Auth.Token(token) if token else None,
        lazy=True,
        timeout=30,
        retry=1,
        api_version="2022-11-28",
    )


def upsert_comment(issue: Issue, body: str | None, author: str, marker: str) -> dict:
    """同步作者和标记匹配的评论，body 为 None 时撤回旧评论。"""
    for comment in issue.get_comments():
        if comment.user and comment.user.login == author and (comment.body or "").startswith(marker + "\n"):
            if body is None:
                comment.delete()
                return {"status": "comment_deleted"}
            if comment.body == body:
                return {"status": "unchanged", "comment_url": comment.html_url}
            comment.edit(body)
            return {"status": "comment_updated", "comment_url": comment.html_url}
    if body is None:
        return {"status": "unchanged"}
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
