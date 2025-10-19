#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

from collections import Counter
from record import Record
from sys import stderr
import re

__re_score_with_rank__ = re.compile(r"^(\d+\.?\d+)\(rk(\d+)\)$")


class Contest:
    __all_contests_list__ = []
    __all_contests_map__ = {}

    def __init__(self, idx, settings):
        self.id = idx
        self.name = settings["name"]
        self.type = settings["type"]
        self.year = settings["year"]
        self.fall_semester = settings["fall_semester"]
        self.full_score = settings["full_score"]
        self.capacity = settings.get("capacity")
        self.contestants = []
        self.level_counts = Counter()

    @staticmethod
    def create(settings):
        """新建比赛。

        settings: 比赛配置，格式见 ../data/contests.json。
        """

        idx = Contest.count_all()
        contest = Contest(idx, settings)
        Contest.__all_contests_list__.append(contest)
        Contest.__all_contests_map__[contest.name] = contest
        return contest

    @staticmethod
    def by_name(name):
        """根据名称返回比赛

        name: 比赛名称。
        """

        if name in Contest.__all_contests_map__:
            return Contest.__all_contests_map__[name]
        raise ValueError(f"未知的比赛名：\x1b[32m'{name}'\x1b[0m")

    @staticmethod
    def count_all():
        "获取当前比赛总数。"

        return len(Contest.__all_contests_list__)

    @staticmethod
    def get_all():
        "获取当前所有比赛的列表。"

        return Contest.__all_contests_list__

    @staticmethod
    def is_score_valid(score):
        """判断分值字段是否符合格式。

        score: 分值。
        """

        if re.match(__re_score_with_rank__, score):
            return True
        if score == "":
            return True
        if not score.replace(".", "").isnumeric():
            return False
        try:
            float(score)
        except ValueError:
            return False
        return True

    def school_year(self):
        "获取该比赛的学年（以秋季学期为准）。"

        return self.year - (0 if self.fall_semester else 1)

    def n_contestants(self):
        "获取该比赛的选手总数。"

        return self.capacity if self.capacity else len(self.contestants)

    def add_contestant(self, oier, score, level, grades, school, province, gender):
        """添加一名选手到比赛。

        oier: 选手。
        score: 分值。
        level: 奖项名称，如二等奖。

        返回值: 选手参加比赛的记录 (Record) 类型。
        """

        if result := re.match(__re_score_with_rank__, score):
            score = float(result.group(1))
            rank = int(result.group(2))
        elif score == "":
            score = None
            rank = len(self.contestants) + 1
        else:
            score = float(score)
            if len(self.contestants) == 0:
                if not (score is None) and score > self.full_score:
                    print(
                        f"\x1b[01;33mwarning: \x1b[0m超过满分的分数：\x1b[32m{score}\x1b[0m > \x1b[32m{self.full_score}\x1b[0m，于比赛 \x1b[32m'{self.name}'\x1b[0m",
                        file=stderr,
                    )
                rank = 1
            elif score == self.contestants[-1].score:
                rank = self.contestants[-1].rank
            else:
                if (score is None) or (self.contestants[-1].score is None):
                    print(
                        f"\x1b[01;33mwarning: \x1b[0m不兼容的分数：\x1b[32m{score}\x1b[0m > \x1b[32m{self.contestants[-1].score}\x1b[0m，于比赛 \x1b[32m'{self.name}'\x1b[0m",
                        file=stderr,
                    )
                elif score > self.contestants[-1].score:
                    print(
                        f"\x1b[01;33mwarning: \x1b[0m不单调的分数：\x1b[32m{score}\x1b[0m > \x1b[32m{self.contestants[-1].score}\x1b[0m，于比赛 \x1b[32m'{self.name}'\x1b[0m",
                        file=stderr,
                    )
                rank = len(self.contestants) + 1

        record = Record(oier, self, score, rank, level, grades, school, province, gender)
        self.contestants.append(record)
        self.level_counts[level] += 1
        return record
