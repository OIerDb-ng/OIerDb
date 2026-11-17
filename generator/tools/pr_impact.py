#!/usr/bin/env python3
"""指定两个提交可预览数据影响，无参数时读取 GitHub Actions 事件并更新 PR 评论。"""

import argparse
import json
import os
import subprocess
import sys
from collections import Counter, defaultdict
from contextlib import redirect_stdout
from html import escape
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import NamedTuple

from github import GithubException

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT), str(ROOT / "generator")]

import util
from generator.tools.comment import github_client, upsert_bot_comment
from loader import iter_data_lines, load_schools, parse_raw_line
from oier import OIer
from school import School

MARKER = "<!-- oierdb-pr-impact -->"
DATA_FILES = (
    "raw.txt", "school.txt", "contests.json", "grades.json",
    "surnames.json", "scoring.json", "name_exceptions.json",
)
SAMPLE_SIZE = 5
COMMENT_LIMIT = 60_000


class SchoolEntry(NamedTuple):
    province: str
    city: str
    name: str
    aliases: tuple[str, ...]

    def keys(self):
        return ((self.province, name) for name in (self.name, *self.aliases))


def load_snapshot(path):
    try:
        util.load_data(path)
    except (ValueError, TypeError, KeyError, AttributeError):
        raise ValueError("数据配置无法读取或格式无效") from None

    School.clear()
    try:
        with open(os.devnull, "w") as discard, redirect_stdout(discard):
            load_schools(path / "school.txt")
    except ValueError:
        raise ValueError("school.txt 格式无效") from None
    schools = [
        SchoolEntry(school.province, school.city, school.name, tuple(sorted(set(school.aliases) - {""})))
        for school in School.get_all()
        if school.province
    ]

    by_name = defaultdict(list)
    for number, _, line in iter_data_lines(path / "raw.txt"):
        fields = line.split(",", 3)
        if len(fields) != 4:
            raise ValueError(f"raw.txt 第 {number} 行格式无效")
        by_name[fields[2]].append((number, line))

    people = {}
    for name, lines in by_name.items():
        records = {}
        for number, line in lines:
            try:
                parsed = parse_raw_line(line)
                records[parsed.to_record(parsed)] = line
            except (ValueError, TypeError):
                raise ValueError(f"raw.txt 第 {number} 行格式无效或引用无法解析") from None
        people[name] = tuple(sorted(
            tuple(sorted(records[record] for record in group))
            for group in OIer.group_records(records)
        ))
    return people, schools


def differences(before, after):
    left, right = Counter(before), Counter(after)
    return sorted((left - right).elements()), sorted((right - left).elements())


def people_changes(before, after):
    changes = []
    for name in before.keys() | after.keys():
        left, right = before.get(name, ()), after.get(name, ())
        if left != right:
            changes.append((name, *differences(left, right)))
    return sorted(changes, key=lambda change: (-abs(len(change[1]) - len(change[2])), change[0]))


def school_changes(before, after):
    """用同省的正式名及别名连接两侧，保留拆分、合并的多对一关系。"""
    sides = differences(before, after)
    by_key = [defaultdict(list), defaultdict(list)]
    for side, entries in enumerate(sides):
        for index, school in enumerate(entries):
            for key in school.keys():
                by_key[side][key].append(index)

    seen = set()
    changes = []
    for side, entries in enumerate(sides):
        for index in range(len(entries)):
            if (side, index) in seen:
                continue
            pending = [(side, index)]
            component = [[], []]
            while pending:
                source, idx = pending.pop()
                if (source, idx) in seen:
                    continue
                seen.add((source, idx))
                school = sides[source][idx]
                component[source].append(school)
                other = 1 - source
                for key in school.keys():
                    pending.extend((other, match) for match in by_key[other].pop(key, ()))
            changes.append(tuple(map(sorted, component)))
    return sorted(changes, key=lambda change: (
        -abs(len(change[0]) - len(change[1])), (change[0] or change[1])[0], change,
    ))


def html_text(value):
    value = " ".join(value.split())
    if len(value) > 200:
        value = value[:199] + "…"
    return escape(value).replace("@", "＠")


def html_list(items, render, limit):
    if not items:
        return ""
    shown = items[:limit]
    entries = "".join(f"<li>{render(item)}</li>" for item in shown)
    if len(shown) < len(items):
        entries += f"<li>另有 {len(items) - len(shown)} 项</li>"
    return f"<ul>{entries}</ul>"


def person_cell(name, groups, limit):
    if not groups:
        return "—"

    def render_group(group):
        rows = [line.split(",") for line in group]
        provinces = "、".join(sorted({row[6] for row in rows}))
        identifier = rows[0][8] or "(空)"
        label = html_text(f"{identifier}：{provinces}")

        def render_award(row):
            contest, award, _, grade, school, score, province, gender, _ = row
            details = [province, school or "学校未填", grade or "年级未填"]
            if score:
                details.append(f"{score} 分")
            if gender:
                details.append(gender)
            return html_text(f"{contest} {award}（{' · '.join(details)}）")

        return label + html_list(rows, render_award, limit)

    return f"<strong>{html_text(name)}</strong>" + html_list(groups, render_group, limit)


def school_cells(schools, limit):
    cells = []
    for school in schools[:limit]:
        location = "，".join(filter(None, (school.province, school.city)))
        title = html_text(f"{school.name}（{location}）")
        cells.append(f"<strong>{title}</strong>" + html_list(school.aliases, html_text, limit))
    if len(cells) < len(schools):
        cells.append(f"另有 {len(schools) - len(cells)} 所学校")
    return cells


def comparison_table(changes):
    rows = ["<table>", "<thead><tr><th>变更前</th><th>变更后</th></tr></thead>", "<tbody>"]
    for before, after in changes:
        columns = (before or ["—"], after or ["—"])
        height = max(map(len, columns))
        for i in range(height):
            cells = []
            for column in columns:
                if len(column) == 1 and height > 1:
                    if i == 0:
                        cells.append(f'<td rowspan="{height}">{column[0]}</td>')
                else:
                    cells.append(f"<td>{column[i] if i < len(column) else ''}</td>")
            rows.append(f"<tr>{''.join(cells)}</tr>")
    return "\n".join(rows + ["</tbody>", "</table>"])


def count_delta(before, after):
    delta = after - before
    change = f"↑ {delta:,}" if delta > 0 else f"↓ {-delta:,}" if delta < 0 else "0"
    return f"{before:,} | {after:,} | {change}"


def comparison_section(label, rows, count):
    details = comparison_table(rows) if count else "无变化。"
    return f"#### {label}变化（展示 {min(SAMPLE_SIZE, count)} / {count} 组）\n\n{details}"


def format_report(before, after, footer):
    people_before, schools_before = before
    people_after, schools_after = after
    people = people_changes(people_before, people_after)
    schools = school_changes(schools_before, schools_after)
    people_counts = count_delta(sum(map(len, people_before.values())), sum(map(len, people_after.values())))
    school_counts = count_delta(len(schools_before), len(schools_after))
    intro = f"""{MARKER}

### PR 数据影响

| 指标 | 变更前 | 变更后 | 净变化 |
| --- | ---: | ---: | ---: |
| 唯一选手数 | {people_counts} |
| 唯一学校数 | {school_counts} |"""

    for limit in (None, 8, 1):
        people_rows = (
            ([person_cell(name, left, limit)], [person_cell(name, right, limit)])
            for name, left, right in people[:SAMPLE_SIZE]
        )
        school_rows = (
            (school_cells(left, limit), school_cells(right, limit))
            for left, right in schools[:SAMPLE_SIZE]
        )
        body = "\n\n".join((
            intro,
            comparison_section("选手", people_rows, len(people)),
            comparison_section("学校", school_rows, len(schools)),
            footer,
        ))
        if len(body.encode("utf-8")) <= COMMENT_LIMIT:
            return body
    raise ValueError("报告超出 GitHub 评论长度限制")


def git(*args, **kwargs):
    return subprocess.run(["git", *args], cwd=ROOT, **kwargs)


def commit_sha(ref):
    return git("rev-parse", "--verify", "--end-of-options", f"{ref}^{{commit}}",
               check=True, capture_output=True, text=True).stdout.strip()


def load_commit(commit):
    with TemporaryDirectory() as temp:
        path = Path(temp)
        for name in DATA_FILES:
            with (path / name).open("wb") as output:
                result = git("cat-file", "blob", f"{commit}:data/{name}", stdout=output, stderr=subprocess.DEVNULL)
                if result.returncode:
                    raise ValueError(f"`{commit[:12]}` 缺少 data/{name}")
        try:
            return load_snapshot(path)
        except ValueError as error:
            message = "数据必须使用 UTF-8 编码" if isinstance(error, UnicodeError) else str(error)
            raise ValueError(f"`{commit[:12]}` {message}") from None


def build_report(before, after):
    footer = f"比较提交：`{before[:12]}` → `{after[:12]}`。"
    same_data = git("diff", "--quiet", "--no-ext-diff", "--no-textconv", before, after, "--",
                    *(f"data/{name}" for name in DATA_FILES)).returncode == 0
    try:
        left = load_commit(before)
        right = left if same_data else load_commit(after)
        return format_report(left, right, footer)
    except ValueError as error:
        return f"{MARKER}\n\n### PR 数据影响\n\n无法统计：{error}。\n\n{footer}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("commits", nargs="*", metavar="commit")
    args = parser.parse_args()
    if len(args.commits) == 2:
        print(build_report(*map(commit_sha, args.commits)))
        return
    if args.commits:
        parser.error("本地预览需要传入两个提交")

    github_operation = "读取 PR"
    try:
        event_path = os.environ.get("GITHUB_EVENT_PATH")
        if not event_path:
            raise ValueError("需要 GITHUB_EVENT_PATH")
        pr = json.loads(Path(event_path).read_text(encoding="utf-8")).get("pull_request")
        if not pr:
            raise ValueError("GitHub 事件中缺少 PR")

        base, head = pr["base"]["sha"], pr["head"]["sha"]
        git("fetch", "--no-tags", "--", "origin", base, head, check=True)
        before = git("merge-base", "--", base, head, check=True, capture_output=True, text=True).stdout.strip()
        body = build_report(before, head)

        repository = os.environ["GITHUB_REPOSITORY"]
        number = pr["number"]
        with github_client(os.environ["GITHUB_TOKEN"]) as github:
            current = github.get_repo(repository).get_pull(number)
            if current.state != "open" or current.head.sha != head or current.base.ref != pr["base"]["ref"]:
                print("PR 已更新或关闭，跳过评论。")
                return
        github_operation = "更新 PR 评论"
        result = upsert_bot_comment(repository, number, body, MARKER)
        print(result["comment_url"])
    except GithubException as error:
        raise SystemExit(f"{github_operation}失败（GitHub HTTP {error.status}）") from None
    except ValueError as error:
        raise SystemExit(str(error)) from None


if __name__ == "__main__":
    main()
