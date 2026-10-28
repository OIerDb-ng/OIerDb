#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""检查同名选手在自动合并下的分组，辅助拆分 data/raw.txt 里被错误合并的条目。

用法（可在仓库任意目录执行，建议用 generator 的虚拟环境）:
    generator/.venv/bin/python generator/tools/oier_check.py lines <姓名>
    generator/.venv/bin/python generator/tools/oier_check.py simulate <姓名> [选项]

子命令:
    lines     列出该姓名在 data/raw.txt 的所有行（物理行号 / 有效行号 / 原始内容）。
    simulate  模拟当前（或假设的）标识符分配下，生成器会把该姓名的记录合并成哪几个人。

simulate 选项:
    --strip                       假设去掉该姓名所有标识符后模拟（判断不加标识符能否正确分组）。
    --assign 行号=标识符[,...]    覆盖某些行（物理行号）的标识符后再模拟；标识符可为空串（表示移除）。
    --expect 行号,行号|行号,...   期望的正确分组（按人用 | 分隔，行号为物理行号）。给出后:
                                  1) 检查当前状态与期望的差距；
                                  2) 检查去掉全部标识符后自动合并能否直接得到期望分组；
                                  3) 不能时给出最小的标识符修改建议（含毕业状态、最近参赛）；
                                  4) 按建议（或按 --assign/--strip 的假设）模拟并校验是否与期望一致。
                                  同时给出 --expect 与 --strip/--assign 时，只校验该假设，不给建议。
                                  应把该姓名的全部记录都列入期望：未列入的行若混进某个
                                  期望组，会被标记为“混入了未列入期望的行 ✗”。

说明:
    · 有效行号 = 跳过注释和空行后的行号，与网站链接里的 OIer uid 一致；物理行号是 grep -n 看到的行号。
    · “已高中毕业”按“初中入学年份 + 6 年、6 月毕业”估算，仅供参考，展示时附上估算依据。
    · 分组模拟复用生成器（record.Record.distance / check_stay_down，阈值 240）的贪心合并逻辑。
    · 退出码: 0 = 校验通过（或未做校验）；1 = 校验不通过或运行出错。
"""

import os
import sys

__generator_dir__ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, __generator_dir__)
os.chdir(__generator_dir__)  # util 等模块按 ../data 相对路径读取数据

import argparse  # noqa: E402
import re  # noqa: E402
from datetime import date  # noqa: E402

import util  # noqa: E402  导入即加载 data/*.json
from contest import Contest  # noqa: E402
from oier import OIer  # noqa: E402
from record import Record  # noqa: E402
from school import School  # noqa: E402

THRESHOLD = 240  # 与 main.attempt_merge 的默认阈值一致
__re_score_with_rank__ = re.compile(r"^(\d+\.?\d*)\(rk(\d+)\)$")


class LineRecord:
    """raw.txt 中属于目标姓名的一行及其解析结果。"""

    def __init__(self, phys_line, valid_line, line):
        self.phys_line = phys_line
        self.valid_line = valid_line
        self.raw = line
        li = line.split(",")
        if len(li) != 9:
            raise ValueError(f"字段数不是 9（{len(li)}）")
        (
            contest_name,
            level,
            name,
            grade_name,
            school_name,
            score,
            province,
            gender_name,
            identifier,
        ) = li
        if name == "":
            raise ValueError("姓名为空")
        if province not in util.provinces:
            raise ValueError(f"未知省份 '{province}'")
        if level not in util.award_levels:
            raise ValueError(f"未知奖项 '{level}'")
        self.contest = Contest.by_name(contest_name)  # 未知的比赛会抛 UnknownReferenceError
        try:
            self.school = School.by_name_in_province(school_name, province)
        except ValueError:
            self.school = School.by_name(school_name)  # 与 main.py 一致：回退到全局查找
        grades = util.get_grades(grade_name)
        gender = {"男": 1, "女": -1}.get(gender_name, 0)
        # 分数只用于展示，不参与分组，这里仅做格式检查
        if m := re.match(__re_score_with_rank__, score):
            self.score = m.group(1)
        elif score == "" or score.replace(".", "").isnumeric():
            self.score = score
        else:
            raise ValueError(f"无法识别的分数 '{score}'")
        self.level = level
        self.grade_name = grade_name
        self.gender_name = gender_name
        self.identifier = identifier
        oier = OIer.of(name, "")  # 占位用，分组逻辑不依赖具体的 OIer
        self.record = Record(oier, self.contest, None, 0, level, grades, self.school, province, gender)

    def clone(self):
        return LineRecord(self.phys_line, self.valid_line, self.raw)


def load_schools():
    """加载 data/school.txt 到 School 注册表（分组距离计算依赖学校与地区）。"""

    with open("../data/school.txt", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if stripped == "" or stripped.startswith("#"):
                continue
            li = stripped.split(",")
            if len(li) < 3:
                continue
            province, city, name, *aliases = li
            School.create(name, province, city, aliases)


def load_name(name):
    """读取 data/raw.txt，返回 (该姓名的 LineRecord 列表, 无法解析的行列表)。"""

    records = []
    malformed = []
    phys_line = 0
    valid_line = 0
    with open("../data/raw.txt", encoding="utf-8") as f:
        for line in f:
            phys_line += 1
            stripped = line.strip()
            if stripped == "" or stripped.startswith("#"):
                continue
            valid_line += 1
            fields = stripped.split(",")
            if len(fields) != 9 or fields[2] != name:
                continue
            try:
                records.append(LineRecord(phys_line, valid_line, stripped))
            except ValueError as e:
                malformed.append((phys_line, stripped, str(e)))
    return records, malformed


def sort_key(lr):
    """按时间先后的排序键（秋季赛在年末、春夏赛在年中）。"""

    return (lr.contest.year, 1 if lr.contest.fall_semester else 0)


def simulate_groups(line_records, threshold=THRESHOLD):
    """按生成器的逻辑把记录分组成“人”。

    有标识符的记录按键锁定为一人；空标识符的记录进入自动合并池，
    用与 main.attempt_merge 相同的贪心过程聚类。
    """

    locked = {}
    pool = []
    for lr in line_records:
        if lr.identifier:
            locked.setdefault(lr.identifier, []).append(lr)
        else:
            pool.append(lr)

    a = [[lr] for lr in pool]
    while True:
        n, best, bi, bj = len(a), threshold + 1, -1, -1
        for i in range(n):
            for j in range(i):
                dist = Record.distance(
                    [x.record for x in a[j]],
                    [x.record for x in a[i]],
                    threshold + 1,
                )
                if dist < best:
                    best, bi, bj = dist, j, i
        if best <= threshold:
            stay_down = Record.check_stay_down(
                [x.record for x in a[bi]], [x.record for x in a[bj]]
            )
            if stay_down == 1:
                for x in a[bi]:
                    x.record.keep_grade()
            elif stay_down == -1:
                for x in a[bj]:
                    x.record.keep_grade()
            else:
                assert stay_down == 0
            a[bi].extend(a[bj])
            del a[bj]
        else:
            break

    groups = [list(v) for v in locked.values()] + a
    for g in groups:
        g.sort(key=lambda lr: (sort_key(lr), lr.valid_line))
    return groups


def dedupe_consecutive(items):
    ret = []
    for item in items:
        if not ret or ret[-1] != item:
            ret.append(item)
    return ret


def person_facts(group):
    """计算一个人的摘要信息：初中入学年份（估）、毕业年份、是否已毕业、最近参赛。"""

    ems = [lr.record.ems for lr in group if not lr.record.is_keep_grade()]
    if not ems:
        ems = [lr.record.ems for lr in group]
    em = util.get_weighted_mode(ems)[0]
    grad_year = em + 6
    today = date.today()
    graduated = (today.year, today.month) > (grad_year, 6)
    latest = max(group, key=lambda lr: (sort_key(lr), lr.valid_line))
    return {"em": em, "grad_year": grad_year, "graduated": graduated, "latest": latest}


def identifier_label(group):
    idents = sorted({lr.identifier for lr in group})
    if len(idents) == 1:
        return repr(idents[0]) if idents[0] else "（空）"
    return "混合(" + "/".join(repr(i) if i else "空" for i in idents) + ")"


def print_person(index, group):
    lrs = sorted(group, key=lambda lr: (sort_key(lr), lr.valid_line))
    uid = min(lr.valid_line for lr in lrs)
    facts = person_facts(lrs)
    latest = facts["latest"]
    print(f"◆ 人物 {index}：uid={uid}，标识符={identifier_label(lrs)}，共 {len(lrs)} 条记录")
    for lr in lrs:
        gender = lr.gender_name or "？"
        identifier = repr(lr.identifier) if lr.identifier else "空"
        print(
            f"    [行 {lr.phys_line}] {lr.contest.name}（{lr.contest.year}）{lr.level}"
            f" {lr.school.name} {lr.grade_name or '？'} {gender}"
            f" 分数 {lr.score or '—'} 标识符 {identifier}"
        )
    grades = dedupe_consecutive([lr.grade_name or "？" for lr in lrs])
    schools = dedupe_consecutive([lr.school.name for lr in lrs])
    print(f"    年级：{' → '.join(grades)}")
    print(f"    学校：{' → '.join(schools)}")
    verdict = "已毕业" if facts["graduated"] else "未毕业"
    print(
        f"    初中入学（估）{facts['em']} 年，预计高中毕业 {facts['grad_year']} 年 6 月"
        f"（{verdict}）；最近参赛 {latest.contest.name}（{latest.contest.year}）"
    )


def print_groups(title, groups):
    print(f"\n—— {title}：共 {len(groups)} 人 ——")
    for i, g in enumerate(groups, 1):
        print()
        print_person(i, g)


def identifier_distribution(records):
    idents = {}
    for lr in records:
        idents[lr.identifier] = idents.get(lr.identifier, 0) + 1
    return "，".join(
        f"{repr(k) if k else '空'}×{v}"
        for k, v in sorted(idents.items(), key=lambda kv: (kv[0] != "", kv[0]))
    )


def parse_expect(spec, records):
    """解析 --expect 参数为行号集合列表，并校验行号确实属于该姓名。"""

    phys_lines = {lr.phys_line for lr in records}
    sets = []
    for part in spec.split("|"):
        lines = []
        for token in part.split(","):
            token = token.strip()
            if not token:
                continue
            try:
                ln = int(token)
            except ValueError:
                raise SystemExit(f"--expect 中的行号不是整数：'{token}'")
            if ln not in phys_lines:
                raise SystemExit(
                    f"--expect 中的行 {ln} 不属于该姓名（可用物理行号：{sorted(phys_lines)}）"
                )
            lines.append(ln)
        if lines:
            sets.append(frozenset(lines))
    if not sets:
        raise SystemExit("--expect 至少需要一个分组")
    return sets


def parse_assign(spec, records):
    """解析 --assign 参数为 {物理行号: 标识符}。"""

    phys_lines = {lr.phys_line for lr in records}
    overrides = {}
    for token in spec.split(","):
        token = token.strip()
        if not token:
            continue
        if "=" not in token:
            raise SystemExit(f"--assign 的每段应为 行号=标识符：'{token}'")
        ln_s, identifier = token.split("=", 1)
        try:
            ln = int(ln_s)
        except ValueError:
            raise SystemExit(f"--assign 中的行号不是整数：'{ln_s}'")
        if ln not in phys_lines:
            raise SystemExit(
                f"--assign 中的行 {ln} 不属于该姓名（可用物理行号：{sorted(phys_lines)}）"
            )
        overrides[ln] = identifier
    return overrides


class Expectation:
    """期望分组与模拟结果的比对。"""

    def __init__(self, sets, records):
        self.sets = sets
        self.index = {}
        for i, s in enumerate(sets):
            for ln in s:
                self.index[ln] = i
        self.records = records
        # 未列入期望的行：它们混进某个期望组时同样说明分组不对，必须被检出
        self.unlisted = sorted(lr.phys_line for lr in records if lr.phys_line not in self.index)

    def check(self, groups):
        """返回每组的状态: ("ok",) / ("merged", [其他组号], [未列入的行]) / ("split", 人数)。"""

        status = []
        for i, s in enumerate(self.sets):
            persons = [g for g in groups if {lr.phys_line for lr in g} & s]
            if len(persons) == 1:
                members = {lr.phys_line for lr in persons[0]}
                touched = {self.index[ln] for ln in members if ln in self.index}
                others = sorted(touched - {i})
                extra = sorted(ln for ln in members if ln not in self.index)
                if others or extra:
                    status.append(("merged", others, extra))
                else:
                    status.append(("ok",))
            else:
                status.append(("split", len(persons)))
        return status

    def all_ok(self, groups):
        return all(s[0] == "ok" for s in self.check(groups))

    def describe(self, groups):
        status = self.check(groups)
        lines = []
        for i, s in enumerate(status):
            members = ",".join(str(ln) for ln in sorted(self.sets[i]))
            if s[0] == "ok":
                lines.append(f"    组 {i + 1}（行 {members}）：恰好自成一人 ✓")
            elif s[0] == "merged":
                parts = []
                if s[1]:
                    parts.append("与 " + "、".join(f"组 {j + 1}" for j in s[1]) + " 被并成一人")
                if s[2]:
                    extra = ",".join(str(ln) for ln in s[2])
                    parts.append(f"混入了未列入期望的行（行 {extra}）")
                lines.append(f"    组 {i + 1}（行 {members}）：" + "，".join(parts) + " ✗")
            else:
                lines.append(f"    组 {i + 1}（行 {members}）：被拆成 {s[1]} 人 ✗")
        return "\n".join(lines)


def suggest_identifiers(records, expectation):
    """给出最小的标识符修改建议，返回 (改动列表, 分组说明, {行号: 建议标识符})。

    原则（与 SKILL.md 一致）:
    · 去掉全部标识符后自动合并即可正确分组的行 → 移除现有标识符，不新增；
    · 需要标识符才能分开/合并的组 → 已毕业者优先拿标识符；都未毕业时，
      最近参赛记录最久远者优先拿标识符；空标识符留给最可能继续参赛的人。
    """

    lrs_strip = [lr.clone() for lr in records]
    for lr in lrs_strip:
        lr.identifier = ""
    strip_groups = simulate_groups(lrs_strip)
    exp = expectation

    # 每个期望组被哪些“去掉标识符后的人”触碰
    touch = [[] for _ in exp.sets]
    for gi, g in enumerate(strip_groups):
        lines = {lr.phys_line for lr in g}
        for i, s in enumerate(exp.sets):
            if lines & s:
                touch[i].append(gi)

    # 通过共享“人”把期望组连成簇（同一簇内必须用标识符互相分开）
    parent = list(range(len(exp.sets)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        parent[find(x)] = find(y)

    for g in strip_groups:
        lines = {lr.phys_line for lr in g}
        idxs = sorted({exp.index[ln] for ln in lines if ln in exp.index})
        for other in idxs[1:]:
            union(idxs[0], other)

    clusters = {}
    for i in range(len(exp.sets)):
        clusters.setdefault(find(i), []).append(i)

    facts = []
    for s in exp.sets:
        facts.append(person_facts([lr for lr in lrs_strip if lr.phys_line in s]))

    # 需要标识符的组：自己的行被拆散（触碰多个人），或与他人同簇（会被并成一人）
    need_id = set()
    for i in range(len(exp.sets)):
        if len(touch[i]) > 1 or len(clusters[find(i)]) > 1:
            need_id.add(i)

    # 每簇挑选一个“保留空标识符”的组：优先未毕业，其次最近参赛最新
    keep_empty = set()
    for members in clusters.values():
        if len(members) == 1:
            continue
        # 只考虑能独立成人的组（该组全部行落在同一个去掉标识符后的人里；
        # 该人混有其他期望组的行没关系——其他人拿标识符离开合并池即可）
        candidates = [i for i in members if i in need_id and len(touch[i]) == 1]
        if not candidates:
            continue  # 簇内没有能独立成人的组，全部加标识符
        candidates.sort(
            key=lambda i: (
                0 if not facts[i]["graduated"] else 1,  # 未毕业优先保留空标识符
                tuple(-x for x in sort_key(facts[i]["latest"])),  # 最近参赛最新优先
                -facts[i]["latest"].valid_line,
            )
        )
        keep_empty.add(candidates[0])

    # 分配标识符：已毕业且最近参赛久远的先挑（沿用既有标识符的机会更大）
    to_identify = sorted(
        need_id - keep_empty,
        key=lambda i: (
            0 if facts[i]["graduated"] else 1,
            tuple(sort_key(facts[i]["latest"])),
        ),
    )
    final_id = {}
    # 不在期望分组里的行保持原样，其标识符视为已被占用
    used = {
        lr.identifier
        for lr in records
        if lr.identifier and lr.phys_line not in exp.index
    }
    # 先沿用各组统一且未被占用的既有标识符，减少改动
    for i in to_identify:
        current = {lr.identifier for lr in records if lr.phys_line in exp.sets[i]}
        if len(current) == 1 and current != {""}:
            (identifier,) = current
            if identifier not in used:
                final_id[i] = identifier
                used.add(identifier)
    for i in to_identify:
        if i in final_id:
            continue
        identifier = next((c for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" if c not in used), None)
        if identifier is None:
            raise SystemExit("需要分配的标识符超过 26 个，请用 --assign 手工指定")
        final_id[i] = identifier
        used.add(identifier)

    suggestion = {}
    notes = []
    for i in range(len(exp.sets)):
        target = final_id.get(i, "")
        for ln in exp.sets[i]:
            suggestion[ln] = target
        verdict = "已毕业" if facts[i]["graduated"] else "未毕业"
        latest = facts[i]["latest"]
        target_label = repr(target) if target else "（空）"
        note = (
            f"    组 {i + 1}（{len(exp.sets[i])} 条，最近参赛 {latest.contest.name}"
            f"（{latest.contest.year}），预计 {facts[i]['grad_year']} 年 6 月毕业，{verdict}）"
            f" → 标识符 {target_label}"
        )
        if i in keep_empty:
            note += "　← 保留空标识符（该人的未来新记录会并入他）"
        notes.append(note)

    changes = [
        (lr.phys_line, lr.identifier, suggestion[lr.phys_line])
        for lr in sorted(records, key=lambda lr: lr.phys_line)
        if lr.phys_line in suggestion and lr.identifier != suggestion[lr.phys_line]
    ]
    return changes, "\n".join(notes), suggestion


def apply_and_simulate(records, suggestion):
    lrs = [lr.clone() for lr in records]
    for lr in lrs:
        if lr.phys_line in suggestion:
            lr.identifier = suggestion[lr.phys_line]
    return simulate_groups(lrs)


def cmd_lines(name):
    records, malformed = load_name(name)
    if not records and not malformed:
        print(f"raw.txt 中没有姓名「{name}」的记录")
        return 1
    print(f"姓名「{name}」共 {len(records)} 条记录；标识符分布：{identifier_distribution(records)}")
    for lr in sorted(records, key=lambda lr: lr.phys_line):
        print(f"    行 {lr.phys_line}（有效行号 {lr.valid_line}）：{lr.raw}")
    for phys, raw, err in malformed:
        print(f"    行 {phys} 无法解析（{err}）：{raw}")
    return 0


def cmd_simulate(name, strip, assign, expect):
    records, malformed = load_name(name)
    if not records:
        print(f"raw.txt 中没有姓名「{name}」的可解析记录")
        return 1
    print(f"姓名「{name}」共 {len(records)} 条记录；当前标识符分布：{identifier_distribution(records)}")
    for phys, raw, err in malformed:
        print(f"警告：行 {phys} 无法解析（{err}）：{raw}")

    overrides = parse_assign(assign, records) if assign else {}
    if strip and overrides:
        print("--strip 与 --assign 不要同时使用")
        return 1

    def hypothetical_records():
        lrs = [lr.clone() for lr in records]
        for lr in lrs:
            if strip:
                lr.identifier = ""
            elif lr.phys_line in overrides:
                lr.identifier = overrides[lr.phys_line]
        return lrs

    if not expect:
        mode = "去掉全部标识符后" if strip else ("按 --assign 假设" if overrides else "当前状态")
        print_groups(f"{mode}的模拟分组", simulate_groups(hypothetical_records()))
        return 0

    expectation = Expectation(parse_expect(expect, records), records)
    if expectation.unlisted:
        unlisted = ",".join(str(ln) for ln in expectation.unlisted)
        print(
            f"注意：有 {len(expectation.unlisted)} 行未列入 --expect（行 {unlisted}）。"
            "它们混入期望分组时会被标记为 ✗；建议把该姓名的全部记录都列入期望。"
        )

    current_groups = simulate_groups([lr.clone() for lr in records])
    print_groups("当前状态的模拟分组", current_groups)
    print("\n—— 与期望分组的对比（当前状态）——")
    print(expectation.describe(current_groups))

    if strip or overrides:
        hypo_groups = simulate_groups(hypothetical_records())
        mode = "去掉全部标识符后" if strip else "按 --assign 假设"
        print_groups(f"{mode}的模拟分组", hypo_groups)
        print(f"\n—— 与期望分组的对比（{mode}）——")
        print(expectation.describe(hypo_groups))
        ok = expectation.all_ok(hypo_groups)
        print("\n校验结果：" + ("与期望一致 ✓" if ok else "与期望不一致 ✗"))
        return 0 if ok else 1

    stripped = [lr.clone() for lr in records]
    for lr in stripped:
        lr.identifier = ""
    strip_groups = simulate_groups(stripped)
    print_groups("去掉全部标识符后的模拟分组", strip_groups)
    print("\n—— 与期望分组的对比（去掉全部标识符）——")
    print(expectation.describe(strip_groups))

    if expectation.all_ok(strip_groups):
        changes = [(lr.phys_line, lr.identifier) for lr in records if lr.identifier]
        print(
            "\n结论：去掉全部标识符后自动合并即可得到期望分组。"
            "按规则不要新增任何标识符，只需移除下列行的现有标识符："
        )
        for ln, old in changes:
            print(f"    行 {ln}: {repr(old)} → （空）")
        print("\n按建议修改后的模拟：与期望一致 ✓")
        return 0

    changes, notes, suggestion = suggest_identifiers(records, expectation)
    print(
        "\n结论：仅靠自动合并无法得到期望分组，需要调整标识符。"
        "建议（已毕业者优先拿标识符；都未毕业时最近参赛最久远者先拿；空标识符留给最可能继续参赛的人）："
    )
    print(notes)
    if changes:
        print("\n需要改动的行（物理行号: 当前 → 建议）：")
        for ln, old, new in changes:
            print(f"    行 {ln}: {repr(old) if old else '（空）'} → {repr(new) if new else '（空）'}")
    else:
        print("\n（无需改动任何标识符）")
    verified = expectation.all_ok(apply_and_simulate(records, suggestion))
    print("\n按建议修改后的模拟：与期望" + ("一致 ✓" if verified else "不一致 ✗（请用 --assign 手工迭代）"))
    return 0 if verified else 1


def main():
    parser = argparse.ArgumentParser(
        description="检查同名选手的自动合并分组（详见文件头部说明）"
    )
    sub = parser.add_subparsers(dest="command", required=True)
    p_lines = sub.add_parser("lines", help="列出该姓名的所有行")
    p_lines.add_argument("name")
    p_sim = sub.add_parser("simulate", help="模拟该姓名的合并分组")
    p_sim.add_argument("name")
    p_sim.add_argument("--strip", action="store_true", help="去掉全部标识符后模拟")
    p_sim.add_argument("--assign", default="", help="覆盖若干行的标识符后模拟")
    p_sim.add_argument("--expect", default="", help="期望的分组，用于校验与给建议")
    args = parser.parse_args()

    load_schools()

    if args.command == "lines":
        sys.exit(cmd_lines(args.name))
    sys.exit(cmd_simulate(args.name, args.strip, args.assign, args.expect))


if __name__ == "__main__":
    main()
