#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""分层优先（lexicographic）的评价函数。

署名与许可：本文件由 Yanhao Xiang 于 2026-11-10 在原项目 OIerDb（作者 Baoshuo）基础上
二次开发，依原项目的 GNU Affero General Public License v3.0（AGPL-3.0）发布；
修改后的完整源代码即本仓库，网络部署时同样须按 AGPL-3.0 提供对应源码。

与 util.py 里的「累加模型」并存：
    score(人) = Σ 1.25^(year-2000) · rc · tc          （旧模型，可在任意低级别上无限累加）
    key(人)   = (-最高赛事层级, -该层级上的最高奖项, -其余成绩分, uid)   （新模型）

新模型的语义：
    1. 参加过高等级赛事的优先            → 主键第一位是最高赛事层级
    2. 高等级赛事里拿到高等级奖项的优先  → 主键第二位是「该层级」上的最高奖项
    3. 两者都相同才看其余成绩            → 第三位是 secondary（有界，∈[0,1)）
    4. 再相同按 uid，保证结果稳定可复现

注意「该层级」而不是「全局」：IOI 铜牌 + NOI 金牌的选手，主键是 (IOI, 铜牌)，
NOI 金牌只在其余成绩里体现 —— 这是「先看最高舞台」的直接推论。
"""

import json
from collections import defaultdict
from sys import stderr

import util

_RULES = None
_REF_YEAR = 2026
_MAX_TIER = 9


def load(path="../data/ranking.json"):
    """载入规则表，并校验覆盖了所有已知赛种与奖项。"""

    global _RULES, _REF_YEAR
    with open(path, encoding="utf-8") as f:
        _RULES = json.load(f)
    _REF_YEAR = _RULES["secondary"]["ref_year"]

    missing_t = [t for t in util.contest_types if t not in _RULES["contest_tier"]]
    missing_a = [a for a in util.award_levels if a not in _RULES["award_rank"]]
    if missing_t or missing_a:
        print(f"\x1b[01;33mwarning: \x1b[0mranking.json 未覆盖：赛种 {missing_t} / 奖项 {missing_a}，"
              f"这些将按 {_RULES.get('default_tier', 0)} 层处理", file=stderr)

    # 校验排除列表里的赛事名确实存在，避免笔误导致静默失效
    excluded = _RULES.get("excluded_contest_names", [])
    if excluded:
        from contest import Contest
        for name in excluded:
            try:
                Contest.by_name(name)
            except ValueError:
                print(f"\x1b[01;33mwarning: \x1b[0mranking.json 的 excluded_contest_names 里"
                      f" '{name}' 不是已知赛事，已忽略", file=stderr)
        print(f"\x1b[0;36mnote: \x1b[0m按规则排除的赛事：{', '.join(excluded)}", file=stderr)
    return _RULES


def tier(contest):
    """赛事层级，越大越高。

    contest: Contest 对象，或赛事类型字符串（此时按静态表处理）。
    """

    return tier_for(getattr(contest, "type", contest), getattr(contest, "year", None))


def tier_for(contest_type, year=None):
    """按 (赛事类型, 年份) 决定层级。

    2020 年起 NOIP 不再分普及/提高组，是单组别的省级联赛，层级高于 CSP-S；
    2020 年以前的 NOIP 提高组与 CSP-S 同级、普及组与 CSP-J 同级（静态表已体现）。
    """

    if contest_type == "NOIP":
        since = int(_RULES.get("noip_unsplit_since", 2020))
        if year is None or year >= since:
            return int(_RULES.get("noip_unsplit_tier", 3))
        return _RULES["contest_tier"].get("NOIP提高", 2)
    return _RULES["contest_tier"].get(contest_type, _RULES.get("default_tier", 0))


def award(level):
    "奖项层级，越大越高（只在同一赛事层级内部比较）。"
    return _RULES["award_rank"].get(level, 0)


def is_excluded(record):
    """该记录是否不计入排名函数（如派生的 NGOI）。"""

    return record.contest.name in _RULES.get("excluded_contest_names", ())


last_report = []


def detect_derived_contests(oiers, derived_type="NGOI", base_prefix="NOIP",
                            threshold=1.0, min_samples=10):
    """按「NGOI 与上一学年的 NOIP 成绩完全一致」自动判定派生赛事。

    NGOI 不是额外竞赛，而是当年 NOIP 成绩在全体女选手中的排名：
        NGOI2022 ↔ NOIP2021
        NGOI2023 ↔ NOIP2022
        NGOI2024 ↔ NOIP2023
        NGOI2025 ↔ NOIP2024
        NGOI2026 ↔ NOIP2025
    因此按 school_year 对齐（比赛年与 fall_semester 的编码在不同年份并不统一，
    直接比较 contest.year 会错位）。

    返回 [(赛事名, 记录数, 可比记录数, 分数一致数, 一致率), ...]。
    """

    global last_report

    groups = {}
    for oier in oiers:
        for record in oier.records:
            if record.contest.type == derived_type:
                groups.setdefault(record.contest.name, []).append((oier, record))

    report, derived = [], []
    for name, items in sorted(groups.items()):
        sample = same = 0
        for oier, record in items:
            want = record.contest.school_year()
            candidates = [r for r in oier.records
                          if r.contest.type.startswith(base_prefix)
                          and r.contest.school_year() == want]
            if not candidates:
                continue
            sample += 1
            if any(c.score is not None and record.score is not None
                   and abs(float(c.score) - float(record.score)) < 1e-9 for c in candidates):
                same += 1
        ratio = same / sample if sample else 0.0
        report.append((name, len(items), sample, same, ratio))
        if sample >= min_samples and ratio >= threshold:
            derived.append(name)

    excluded = _RULES.setdefault("excluded_contest_names", [])
    for name in derived:
        if name not in excluded:
            excluded.append(name)
    last_report = report
    return report


def best_of(oier):
    """返回 (最高赛事层级, 该层级上的最高奖项层级, 对应的那条记录)。

    排序轴由 ranking.json 的 primary_order 决定（默认 ["tier", "award"]：
    先比赛事层级，再比该层级上的奖项）。同一奖项有多条时，取场内百分位最高的那条用于展示。
    """

    order = _RULES.get("primary_order", ["tier", "award"])
    best = (0, 0, None)
    for record in oier.records:
        if is_excluded(record):
            continue
        t, a = tier(record.contest), award(record.level)
        if _ordered(t, a, order) > _ordered(*best[:2], order):
            best = (t, a, record)
        elif (t, a) == best[:2] and best[2] is not None:
            if rank_fraction(record) > rank_fraction(best[2]):
                best = (t, a, record)
    return best


def _ordered(t, a, order=None):
    "按配置的主键顺序返回比较元组。"
    order = order or _RULES.get("primary_order", ["tier", "award"])
    return (t, a) if order[0] == "tier" else (a, t)


def rank_fraction(record):
    "场内百分位，∈[0,1]；1 表示该场第 1 名。"
    total = record.contest.n_contestants()
    if not total:
        return 0.0
    return float(util.rank_coefficient(record.rank, total)) / 100.0


def secondary(oier, ref_year=None):
    """其余成绩的有界加权分，∈[0,1)。

    每个 (赛种, 年份) 只取最好一条；按层级加权、按年线性衰减；再按降序施加
    递减权重，使「多参加几场」的边际收益迅速衰减。
    """

    cfg = _RULES["secondary"]
    ref = ref_year or _REF_YEAR
    floor = float(cfg["tier_floor"])
    per_year = float(cfg["decay_per_year"])
    min_decay = float(cfg["min_decay"])
    ratio = float(cfg["diminishing"])

    best = {}
    for record in oier.records:
        if is_excluded(record):
            continue
        t = tier(record.contest)
        weight = floor + (1.0 - floor) * t / _MAX_TIER
        age = max(0, ref - record.contest.year)
        decay = max(min_decay, 1.0 - per_year * age)
        value = rank_fraction(record) * weight * decay
        key = (record.contest.type, record.contest.year)
        if value > best.get(key, 0.0):
            best[key] = value

    total, factor = 0.0, 1.0
    for value in sorted(best.values(), reverse=True):
        total += value * factor
        factor *= ratio
    return total / (1.0 + total)


def rank_key(oier):
    """排序键。可以直接给 list.sort() 使用（升序即排名从高到低）。"""

    t, a, _ = best_of(oier)
    return (*(-x for x in _ordered(t, a)), -secondary(oier), oier.uid)


def prepare(oier):
    "计算并缓存该选手的分层信息，返回排序键。"

    t, a, record = best_of(oier)
    s = secondary(oier)
    oier.lex_tier = t
    oier.lex_award = a
    oier.lex_best = record
    oier.lex_secondary = s
    oier.lex_rating = rating(t, a, s)
    return rank_key_of(t, a, s, oier.uid)


def rank_key_of(t, a, s, uid):
    return (*(-x for x in _ordered(t, a)), -s, uid)


def school_scores(oiers):
    """按学校内去重学生的 LexRank 聚合学校评分。

    学生按个人 LexRank 从高到低排列，最高学生的评分作为主值，其余学生
    按 1/2、1/4、... 衰减后作为补充。一个学生在学校的多条比赛记录只计一次。
    """

    students_by_school = defaultdict(set)
    for oier in oiers:
        for school in {
            record.school for record in oier.records if not is_excluded(record)
        }:
            students_by_school[school].add(oier)

    scores = {}
    for school, students in students_by_school.items():
        ordered = sorted(
            students,
            key=lambda oier: (
                -oier.lex_tier,
                -oier.lex_award,
                -oier.lex_secondary,
                oier.uid,
            ),
        )
        score = float(ordered[0].lex_rating)
        factor = 0.5
        for oier in ordered[1:]:
            score += float(oier.lex_rating) / 10000.0 * factor
            factor *= 0.5
        scores[school] = score
    return scores


def rating(t, a, s):
    """用于展示的合成分，严格保持主键的字典序，其余成绩 < 100 分。"""

    hi, lo = _ordered(t, a)
    return hi * 1000 + lo * 100 + 99.0 * s


def describe(oier):
    "一行人类可读说明，用于预览文件。"
    r = getattr(oier, "lex_best", None)
    if r is None:
        return "无有效记录"
    return f"{r.contest.name} {r.level}"
