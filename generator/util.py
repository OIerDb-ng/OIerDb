#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

from collections import Counter
from decimal import Decimal as D, getcontext
from itertools import chain
from sys import stderr
from config import DATA_DIR

getcontext().prec = 64

provinces = [
    "安徽",
    "北京",
    "福建",
    "甘肃",
    "广东",
    "广西",
    "贵州",
    "海南",
    "河北",
    "河南",
    "黑龙江",
    "湖北",
    "湖南",
    "吉林",
    "江苏",
    "江西",
    "辽宁",
    "内蒙古",
    "山东",
    "山西",
    "陕西",
    "上海",
    "四川",
    "天津",
    "新疆",
    "浙江",
    "重庆",
    "宁夏",
    "云南",
    "澳门",
    "香港",
    "青海",
    "西藏",
    "台湾",
]

award_levels = [
    "金牌",
    "银牌",
    "铜牌",
    "一等奖",
    "二等奖",
    "三等奖",
    "国际金牌",
    "国际银牌",
    "国际铜牌",
    "前5%",
    "前15%",
    "前25%",
]


def __main__():
    import json
    import pypinyin
    from contest import Contest

    global add_contestant, contests, contest_type_coefficient, decay_coefficient, enrollment_middle, get_contest_id, get_grades, get_initials, get_mode, get_weighted_mode, lcs, rank_coefficient

    with open(DATA_DIR / "contests.json") as f:
        for contest in json.load(f):
            Contest.create(contest)

    with open(DATA_DIR / "grades.json") as f:
        g_ = json.load(f)
    g_initial = g_["initial"]
    g_element = g_["element"]
    g_special = g_["special"]

    with open(DATA_DIR / "surnames.json") as f:
        surnames = json.load(f)

    with open(DATA_DIR / "scoring.json") as f:
        scoring = json.load(f)

    with open(DATA_DIR / "name_exceptions.json") as f:
        name_exceptions = json.load(f)

    pypinyin.load_single_dict({ ord(k): v for k, v in name_exceptions.items() })

    rc_list_legacy = (
        [D(i) for i in range(100, 39, -1)]
        + [D("0.15") * i for i in range(240, 50, -1)]
        + [D("0.03") * i for i in range(250, 50, -1)]
    )

    rc_list = (
        [D(i) for i in range(100, 39, -1)]
        + [D("0.15") * i for i in range(239, 50, -1)]
        + [D("0.05") * i for i in range(150, -1, -1)]
    )
    assert len(rc_list) == 401
    assert sorted(rc_list, reverse=True) == rc_list

    def get_initials(name):
        """获取拼音首字母。

        name: 姓名。
        """
        return "".join(get_initial_list(name))

    def get_initial_list(name):
        initial = pypinyin.lazy_pinyin(name, style=pypinyin.Style.FIRST_LETTER)
        for i in range(len(name), 0, -1):
            if name[:i] in surnames:
                initial[:i] = surnames[name[:i]]
        return initial

    def get_grades(grade_name):
        """获取可能的年级列表。

        grade_name: 年级名称。

        返回值: 以初一为 16，(2^可能年级) 列表之和，需要保证年级在 0 ~ 31 之间。
        """

        if grade_name in g_special:
            return g_special[grade_name]
        ret, cur = g_initial, grade_name
        while True:
            if cur == "":
                ret = 1 << ret
                g_special.setdefault(grade_name, ret)
                return ret
            for element in g_element:
                if cur.startswith(element):
                    ret += g_element[element]
                    cur = cur[len(element) :]
                    break
            else:
                raise ValueError(f"未知的年级：\x1b[032m'{grade_name}'\x1b[0m")

    def enrollment_middle(contest, grades):
        """获取初中入学年份列表。

        contest: 比赛对象。
        grades: 所有可能的年级列表。

        返回值: dict，表示所有可能的入学年份列表，值表示优先级。
        """

        year = contest.school_year()
        mask = grades
        is_primary_or_none = grades == 4290837504  # "小学/无" 中小学优先级比大学高
        ems = {}
        while mask:
            grade = (mask & -mask).bit_length() - 16
            ems[year - grade + 1] = 1 if is_primary_or_none and grade > 5 else 2
            mask &= mask - 1
        return ems

    def get_mode(sets):
        """获取最佳初中入学年份。

        sets: 集合的列表，每个集合表示可能的入学年份集合。

        返回值: 最佳入学年份的列表。
        """

        counter = Counter(chain(*sets))
        most = counter.most_common(1)[0][1]
        return sorted(k for k, v in counter.items() if v == most)

    def get_weighted_mode(dicts):
        """获取最佳初中入学年份。

        dicts: 字典的列表，每个字典表示可能的入学年份字典以及相应的优先级。

        返回值: 最佳入学年份的列表。
        """

        counter = Counter()
        for d in dicts:
            counter.update(d)
        most = counter.most_common(1)[0][1]
        return sorted(k for k, v in counter.items() if v == most)

    def decay_coefficient(year):
        """获取因年份造成的衰变系数，<b>该函数可以自行修改</b>。

        year: 比赛年份。

        返回值: 系数，<b>需为 Decimal 类型</b>。
        """

        return D("1.25") ** (year - 2000)

    def rank_coefficient(rank, total, name=None):
        """获取因排名产生的系数，<b>该函数可以自行修改</b>。

        rank: 当前排名。
        total: 总人数。
        name: 姓名，用于输出错误信息，无需用到。

        返回值: 系数，<b>需为 Decimal 类型</b>。
        """

        if not (1 <= rank <= total):
            print(
                f"\x1b[01;33mwarning: \x1b[0m诡异的排名：\x1b[32m{rank}\x1b[0m / \x1b[32m{total}\x1b[0m (from \x1b[32m{name}\x1b[0m)，已自动 clamped",
                file=stderr,
            )
        return rc_list[400 * max(min(rank, total), 1) // total]

    def contest_type_coefficient(type, name=None):
        """获取不同比赛类型产生的系数，<b>该函数可以自行修改</b>。

        type: <b>字符串</b>，为比赛类型。
        name: 姓名，用于输出错误信息，无需用到。

        返回值: 系数，<b>需为 Decimal 类型</b>。
        """

        if type not in scoring:
            print(
                "\x1b[01;33mwarning: \x1b[0m未知的比赛类型：\x1b[32m'{type}'\x1b[0m (from \x1b[32m{name}\x1b[0m)，不计算贡献",
                file=stderr,
            )
        return D(scoring.get(type, "0"))

    def lcs(str1, str2):
        """求字符串 str1 和 str2 的最长公共子序列。"""

        n = len(str1)
        m = len(str2)
        f = [[0] * (m + 1) for i in range(n + 1)]
        for i in range(n):
            for j in range(m):
                f[i + 1][j + 1] = f[i][j] + 1 if str1[i] == str2[j] else max(f[i + 1][j], f[i][j + 1])
        return f[n][m]


__main__()
