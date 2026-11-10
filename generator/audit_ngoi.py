#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""审计 NGOI 是否为「当年 NOIP 成绩在女选手中的排名」的直接产物。

做法：对每一条 NGOI 记录，找同一 (姓名, 标识符) 在同一学年的 NOIP 系列记录
（NOIP / NOIP提高 / NOIP普及），比较原始分数。若某一年全部吻合，则该年 NGOI
可以视为 NOIP 的派生视图，不应重复计入排名。


署名与许可：Yanhao Xiang 于 2026-11-10 在原项目 OIerDb（作者 Baoshuo，AGPL-3.0）
基础上二次开发；本文件同样以 GNU AGPL-3.0 发布，完整源码即本仓库。"""

import sys
from collections import Counter, defaultdict

sys.path.insert(0, ".")
import util  # noqa: E402
from contest import Contest  # noqa: E402
from school import School  # noqa: E402

with open("../data/school.txt", encoding="utf-8") as fh:
    for line in fh:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        li = line.split(",")
        if len(li) < 3:
            continue
        p, c, n, *a = li
        if (p or c or n) and p not in util.provinces:
            continue
        School.create(n, p, c, a)

NOIP_TYPES = ("NOIP", "NOIP提高", "NOIP普及")
# (name, ident) -> school_year -> [(type, score, level, contest_name)]
noip = defaultdict(lambda: defaultdict(list))
ngoi = []
rid = 0
with open("../data/raw.txt", encoding="utf-8") as fh:
    for line in fh:
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        li = s.split(",")
        if len(li) != 9 or li[2] == "":
            continue
        cn, lv, nm, gr, sn, sc, pv, gd, idt = li
        if pv not in util.provinces or lv not in util.award_levels:
            continue
        try:
            contest = Contest.by_name(cn)
        except ValueError:
            continue
        if not Contest.is_score_valid(sc):
            continue
        rid += 1
        sy = contest.school_year()
        rec = (contest.type, sc, lv, cn, pv, gd, contest.year)
        if contest.type in NOIP_TYPES:
            noip[(nm, idt)][sy].append(rec)
        elif contest.type == "NGOI":
            ngoi.append((nm, idt, sy, sc, lv, cn, pv, gd))

print(f"有效记录 = {rid}")
print(f"NGOI 记录 = {len(ngoi)}，涉及姓名 = {len({x[0] for x in ngoi})}")

by_year = defaultdict(list)
for nm, idt, sy, sc, lv, cn, pv, gd in ngoi:
    by_year[cn].append((nm, idt, sy, sc, lv, pv, gd))

print(f"\n{'赛事':12s} {'学年':>5s} {'记录':>5s} {'找到NOIP':>8s} {'分数相同':>8s} {'比例':>7s}")
all_match = {}
for cn in sorted(by_year):
    rows = by_year[cn]
    found = same = 0
    diffs = []
    for nm, idt, sy, sc, lv, pv, gd in rows:
        cands = noip.get((nm, idt), {}).get(sy, [])
        if not cands:
            continue
        found += 1
        try:
            target = float(sc)
        except ValueError:
            continue
        if any(abs(float(c[1]) - target) < 1e-9 for c in cands if c[1]):
            same += 1
        else:
            diffs.append((nm, sc, [(c[0], c[1]) for c in cands]))
    ok = found and same / found > 0.999
    all_match[cn] = ok
    print(f"{cn:12s} {rows[0][2] if rows else 0:5d} {len(rows):5d} {found:8d} {same:8d} "
          f"{same/max(found,1)*100:6.1f}%  {'← 全部一致，派生视图' if ok else ''}")
    if diffs[:3] and not ok:
        for nm, sc, cs in diffs[:3]:
            print(f"      反例：{nm} NGOI={sc}  NOIP={cs}")

print("\n结论：派生（应排除）的 NGOI 赛事 =",
      [cn for cn, ok in all_match.items() if ok])

# 只有 NGOI、没有 NOIP 的女选手
only = [x for x in ngoi if not noip.get((x[0], x[1]), {})]
print(f"\n找不到任何学年 NOIP 记录的 NGOI 选手 = {len(only)} 人 / {len({x[0] for x in ngoi})} 人")
for nm, idt, sy, sc, lv, cn, pv, gd in only[:8]:
    print(f"    {nm:<6s} {cn} {lv} 分数 {sc} {pv}")
