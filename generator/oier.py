#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

import gc
import re
import util
from fractions import Fraction as R

__re_identifier_with_initials__ = re.compile(r"<(\w+)>")

"下列硬编码常量为 CCF 等级计算规则。"
__clnoi__ = {"金牌": 10, "银牌": 9, "铜牌": 8}
__clother__ = {"APIO": 500, "CTS": 800, "CTSC": 800, "WC": 600}
__clscr2lvl__ = [(1000, 10), (500, 9), (250, 8)]


class OIer:
    __all_oiers_list__ = []
    __all_oiers_map__ = {}

    def __init__(self, name, identifier, gender, em, uid):
        self.name = name
        self.identifier = identifier
        self.gender = gender
        self.enroll_middle = em
        self.uid = uid
        if result := re.search(__re_identifier_with_initials__, identifier):
            self.initials = result.group(1)
        else:
            self.initials = util.get_initials(name)
        self.records = []
        OIer.__all_oiers_list__.append(self)

    @staticmethod
    def of(name, identifier, gender=None, em=None, uid=None):
        """返回或创建 OIer。

        name: 姓名。
        identifier: 为去重而设的附加信息。
        gender: 性别。
        em: 初中入学年份。
        uid: 用户 ID。
        """

        key = (name, identifier)
        if key in OIer.__all_oiers_map__:
            return OIer.__all_oiers_map__[key]
        oier = OIer(name, identifier, gender, em, uid)
        OIer.__all_oiers_map__[key] = oier
        return oier

    @staticmethod
    def clear():
        "清空数据。"

        OIer.__all_oiers_list__ = []
        OIer.__all_oiers_map__ = {}
        gc.collect()

    @staticmethod
    def count_all():
        "获取当前 OIer 总数。"

        return len(OIer.__all_oiers_list__)

    @staticmethod
    def get_all():
        "获取当前所有 OIer 的列表。"

        return OIer.__all_oiers_list__

    @staticmethod
    def sort_by_score():
        "根据 DB 评分对 OIer 排序。"

        OIer.__all_oiers_list__.sort(key=lambda oier: (-oier.oierdb_score, oier.uid))

    @staticmethod
    def __float2p_format__(x):
        return f"{x:.2f}".rstrip("0").rstrip(".").lstrip("0") or "0"

    def __get_compressed_records__(self):
        return "/".join(record.to_compress_format(self.enroll_middle) for record in self.records)

    def to_compress_format(self):
        "转化成压缩格式字符串。"

        return "{},{},{},{},{},{},{},{},{}".format(
            self.uid,
            self.initials,
            self.name,
            self.gender,
            self.enroll_middle,
            OIer.__float2p_format__(self.oierdb_score),
            OIer.__float2p_format__(float(self.ccf_score)),
            self.ccf_level,
            self.__get_compressed_records__(),
        )

    def add_record(self, record):
        """添加一次比赛记录到选手。

        record: 比赛记录。
        """

        self.records.append(record)

    def compute_oierdb_score(self):
        "计算该 OIer 的 DB 评分。"

        s = util.D(0)
        for record in self.records:
            dc = util.decay_coefficient(record.contest.year)
            rc = util.rank_coefficient(record.rank, record.contest.n_contestants(), self.name)
            tc = util.contest_type_coefficient(record.contest.type, self.name)
            c = dc * rc * tc
            record.school.score += c
            s += c
        self.oierdb_score = s

    def compute_ccf_level(self):
        """
        计算该 OIer 的 CCF 评分及评级。
        参考资料: https://www.noi.cn/xw/2019-08-26/715369.shtml
        """

        l = 0
        scores = {}
        self.records.sort(key=lambda record: record.contest.id)
        for record in self.records:
            if record.contest.type == "NOI":
                l = max(l, __clnoi__.get(record.level, 0))
            elif record.contest.type in ["NOIP", "NOIP提高", "CSP提高"]:
                n = (
                    record.contest.capacity
                    if record.contest.capacity
                    else record.contest.level_counts["一等奖"] * 5
                )
                if record.rank * 10 <= n:  # 七级：在NOIP提高组复赛（CSP-S第二轮）中成绩列全国前10%
                    l = max(l, 7)
                elif record.rank * 5 <= n:  # 六级：在NOIP提高组复赛（CSP-S第二轮）中成绩列全国前20%
                    l = max(l, 6)
                elif record.rank * 2 <= n:  # 四级：全国前50%
                    l = max(l, 4)
                else:  # 三级：进入NOIP复赛（CSP-J/S第二轮）；
                    l = max(l, 3)
            elif record.contest.type in ["NOIP普及", "CSP入门"]:
                n = (
                    record.contest.capacity
                    if record.contest.capacity
                    else record.contest.level_counts["一等奖"] * 5
                )
                if record.rank * 5 <= n:  # 五级：在NOIP普及组复赛（CSP-J第二轮）中成绩列全国前20%
                    l = max(l, 5)
                elif record.rank * 2 <= n:  # 四级：全国前50%
                    l = max(l, 4)
                else:  # 三级：进入NOIP复赛（CSP-J/S第二轮）
                    l = max(l, 3)
            elif B := __clother__.get(record.contest.type, 0):
                n = record.contest.n_contestants()
                scores.setdefault(record.contest.type, R(0))
                scores[record.contest.type] = max(
                    scores[record.contest.type], B - (record.rank - 1) * R(B - 50, n - 1)
                )
            score = sum(scores.values())
            for condition, level in __clscr2lvl__:
                if score >= condition:
                    l = max(l, level)
        self.ccf_score = score
        self.ccf_level = l
