#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""从最终 result.txt（合并后的人）核对 NGOI 与「上一学年 NOIP」的配对。

用 school_year 对齐：NGOI2022↔NOIP2021、NGOI2023↔NOIP2022、
NGOI2024↔NOIP2023、NGOI2025↔NOIP2024、NGOI2026↔NOIP2025。


署名与许可：Yanhao Xiang 于 2026-11-10 在原项目 OIerDb（作者 Baoshuo，AGPL-3.0）
基础上二次开发；本文件同样以 GNU AGPL-3.0 发布，完整源码即本仓库。"""

import json
from collections import defaultdict

CONTESTS = json.load(open("../data/contests.json", encoding="utf-8"))
C = {i: c for i, c in enumerate(CONTESTS)}


def sy(cid):
    c = C[cid]
    return c["year"] - (0 if c["fall_semester"] else 1)


recs_of = defaultdict(list)     # uid -> [(cid, score)]
for line in open("dist/result.txt", encoding="utf-8"):
    line = line.rstrip("\n")
    if not line:
        continue
    f = line.split(",", 8)
    for x in f[8].split("/"):
        if not x:
            continue
        g = x.split(":")
        recs_of[f[0]].append((int(g[0]), g[2]))

ngoi = sorted([i for i, c in C.items() if c["type"] == "NGOI"], key=sy)
noip_by_sy = defaultdict(list)
for i, c in C.items():
    if c["type"].startswith("NOIP"):
        noip_by_sy[sy(i)].append(i)

print(f"{'NGOI':10s} {'学年':>5s} {'记录':>5s} {'同人同学年有NOIP':>14s} {'分数一致':>8s} {'一致率':>7s}")
for cid in ngoi:
    total = have = same = 0
    for uid, lst in recs_of.items():
        for rc, sc in lst:
            if rc != cid:
                continue
            total += 1
            cands = [s for rc2, s in recs_of[uid]
                     if rc2 in noip_by_sy[sy(cid)] and s]
            if not cands:
                continue
            have += 1
            if sc and any(abs(float(s) - float(sc)) < 1e-9 for s in cands):
                same += 1
    print(f"{C[cid]['name']:10s} {sy(cid):5d} {total:5d} {have:14d} {same:8d} "
          f"{same/max(have,1)*100:6.1f}%")
