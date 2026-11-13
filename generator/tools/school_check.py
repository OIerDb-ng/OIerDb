#!/usr/bin/env python3
"""查询和校验学校数据。"""

import argparse
import json
import sys
from collections import Counter, defaultdict
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from loader import DEFAULT_RAW_FILE, DEFAULT_SCHOOL_FILE, iter_data_lines, load_schools, parse_raw_line  # noqa: E402
from oier import OIer  # noqa: E402
from school import School  # noqa: E402
from query import lookup_schools  # noqa: E402


def load_table(path):
    School.clear()
    with redirect_stdout(sys.stderr):
        return load_schools(path)


def table_errors(rows):
    owners = defaultdict(set)
    errors = []
    for phys, _, text, school in rows:
        if text == ",,":
            continue
        if not school.name or not school.province:
            errors.append(f"行 {phys}: 学校正式名称和省份不能为空（废弃行请使用 ',,'）")
        names = [school.name, *school.aliases]
        for name in names:
            if name:
                owners[(school.province, name)].add(school.id)
    for (province, name), ids in owners.items():
        if len(ids) > 1:
            errors.append(f"{province}/{name}: 同省名称冲突，学校 ID 为 {sorted(ids)}")
    return errors


def layout_errors(before, after):
    errors = []
    if len(after) < len(before):
        errors.append("有效行数减少，会改变后续学校 ID；合并后请保留 ',,' 占位")
    for old, new in zip(before, after):
        old_school, new_school = old[3], new[3]
        if old[2] == ",," or new[2] == ",,":
            continue
        old_names = {name for name in [old_school.name, *old_school.aliases] if name}
        new_names = {name for name in [new_school.name, *new_school.aliases] if name}
        if old_names.isdisjoint(new_names):
            errors.append(
                f"学校 ID {old_school.id}: 原名称全部丢失或条目发生移位 "
                f"({old_school.name} → {new_school.name})"
            )
    return errors


def parsed_records(raw_file):
    for phys, _, text in iter_data_lines(raw_file):
        try:
            yield phys, text, parse_raw_line(text)
        except ValueError as error:
            raise ValueError(f"{raw_file}:{phys}: {error}") from error


def signature(school):
    return school.id, school.name, school.province, school.city


def show(school_id, json_output, raw_file, school_file):
    result = lookup_schools(ids=[school_id], raw_file=raw_file, school_file=school_file)
    if json_output:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["matches"]:
        raise ValueError(f"未知学校 ID {school_id}")
    if json_output:
        return 0
    profile = result["matches"][0]
    name = profile["name"] or "已作废的占位行"
    print(f"学校 ID {school_id}，物理行 {profile['physical_line']}：{name}")
    if not profile["placeholder"]:
        print(f"  地区：{profile['province']}/{profile['city']}")
        print("  别名：" + ("、".join(profile["aliases"]) or "无"))
    print(f"  关联获奖记录：{profile['record_count']} 条；涉及姓名：{profile['member_count']} 个")
    for count in profile["record_counts"]:
        print(f"    {count['province']}/{count['original_school_name']}: {count['count']} 条")
    for record in profile["records"]:
        print(f"    [物理行 {record['physical_line']}，有效行 {record['valid_line']}] "
              f"{record['raw']}")
    if profile["records_truncated"]:
        print(f"  仅显示前 {len(profile['records'])} 条记录")
    return 0


def check(rows, raw_file):
    errors = table_errors(rows)
    for error in errors:
        print(f"错误：{error}", file=sys.stderr)
    fallback = Counter()
    count = 0
    for _, _, parsed in parsed_records(raw_file):
        count += 1
        try:
            School.by_name_in_province(parsed.school_name, parsed.province)
        except ValueError:
            fallback[(parsed.province, parsed.school_name, parsed.school.id)] += 1
    for (province, name, target), n in sorted(fallback.items()):
        print(f"警告：{province}/{name} 使用全局回退 → 学校 ID {target}（{n} 条）")
    print(f"检查{'失败' if errors else '通过'}：{len(rows)} 个学校条目（含占位），{count} 条获奖记录")
    return 1 if errors else 0


def collect_groups(names, raw_file):
    records = []
    source_lines = {}
    for phys, _, text in iter_data_lines(raw_file):
        fields = text.split(",")
        if len(fields) < 3 or fields[2] not in names:
            continue
        parsed = parse_raw_line(text)
        identity = SimpleNamespace(name=parsed.name, identifier=parsed.identifier)
        record = parsed.to_record(identity)
        records.append(record)
        source_lines[id(record)] = phys
    groups = defaultdict(set)
    for group in OIer.group_records(records):
        groups[group[0].oier.name].add(frozenset(source_lines[id(record)] for record in group))
    return groups


def simulate(candidate_file, raw_file, school_file):
    before = load_table(school_file)
    for error in table_errors(before):
        print(f"原学校表问题：{error}", file=sys.stderr)
    original = {}
    for _, _, parsed in parsed_records(raw_file):
        original[(parsed.province, parsed.school_name)] = signature(parsed.school)

    after = load_table(candidate_file)
    errors = table_errors(after) + layout_errors(before, after)
    if errors:
        raise ValueError("候选学校表校验失败：" + "；".join(errors))
    transitions = Counter()
    affected_names = set()
    examples = []
    for phys, text, parsed in parsed_records(raw_file):
        previous = original[(parsed.province, parsed.school_name)]
        current = signature(parsed.school)
        if previous == current:
            continue
        transitions[(previous, current)] += 1
        affected_names.add(parsed.name)
        if len(examples) < 20:
            examples.append((phys, previous[0], current[0], text))

    changed_rows = sum(old[2] != new[2] for old, new in zip(before, after)) + abs(len(after) - len(before))
    affected_records = transitions.total()
    print(f"候选表：修改 {changed_rows} 个有效行，条目数 {len(before)} → {len(after)}（含占位）")
    print(f"学校归属或属性变化：{affected_records} 条记录，涉及 {len(affected_names)} 个姓名")
    for (previous, current), count in sorted(transitions.items()):
        print(f"  {previous[0]} {previous[1]} ({previous[2]}/{previous[3]}) → "
              f"{current[0]} {current[1]} ({current[2]}/{current[3]}): {count} 条")
    for phys, previous, current, text in examples:
        print(f"  [物理行 {phys}] 学校 ID {previous} → {current}: {text}")
    if affected_records > len(examples):
        print(f"  仅显示前 {len(examples)} 条记录")
    if not affected_names:
        return 0

    after_groups = collect_groups(affected_names, raw_file)
    load_table(school_file)
    before_groups = collect_groups(affected_names, raw_file)
    changed_names = [name for name in sorted(affected_names) if before_groups[name] != after_groups[name]]
    print(f"选手分组变化：{len(changed_names)} 个姓名")
    for name in changed_names:
        print(f"  {name}：{format_groups(before_groups[name])} → {format_groups(after_groups[name])}")
    return 0


def format_groups(groups):
    return " | ".join(
        ",".join(map(str, sorted(group)))
        for group in sorted(groups, key=lambda group: min(group))
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    lines = commands.add_parser("lines", help="按正式名称或别名搜索学校")
    lines.add_argument("name")
    info = commands.add_parser("show", help="按学校 ID 查询")
    info.add_argument("school_id", type=int)
    info.add_argument("--json", action="store_true", help="输出 JSON")
    verify = commands.add_parser("check", help="校验学校表和获奖记录")
    preview = commands.add_parser("simulate", help="预览候选学校表的影响")
    preview.add_argument("candidate_file", type=Path)
    for command in (lines, info, verify, preview):
        command.add_argument("--school-file", type=Path, default=DEFAULT_SCHOOL_FILE, help="学校表")
    for command in (info, verify, preview):
        command.add_argument("--raw-file", type=Path, default=DEFAULT_RAW_FILE, help="获奖记录文件")
    args = parser.parse_args()
    try:
        if args.command == "simulate":
            return simulate(args.candidate_file.expanduser(), args.raw_file, args.school_file)
        if args.command == "show":
            return show(args.school_id, args.json, args.raw_file, args.school_file)
        rows = load_table(args.school_file)
        if args.command == "check":
            return check(rows, args.raw_file)
        count = 0
        for phys, _, text, school in rows:
            if any(args.name in name for name in (school.name, *school.aliases)):
                print(f"学校 ID {school.id}，物理行 {phys}: {text}")
                count += 1
        print(f"匹配 {count} 个条目")
        return 0 if count else 1
    except (ValueError, OSError) as error:
        print(f"错误：{error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
