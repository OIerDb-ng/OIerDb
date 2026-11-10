#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""独立校验分层优先排名的结果文件，检查字典序是否真的严格成立。

署名与许可：Yanhao Xiang 于 2026-11-10 在原项目 OIerDb（作者 Baoshuo，AGPL-3.0）
基础上二次开发；本文件同样以 GNU AGPL-3.0 发布，完整源码即本仓库。"""

import sys
from collections import Counter, defaultdict

TSV = "dist/rank_diff.tsv"
rows = []
with open(TSV, encoding="utf-8") as f:
    header = f.readline().rstrip("\n").split("\t")
    for line in f:
        li = line.rstrip("\n").split("\t")
        if len(li) != len(header):
            continue
        r = dict(zip(header, li))
        rows.append({
            "new": int(r["new_rank"]), "old": int(r["old_rank"]),
            "uid": int(r["uid"]), "name": r["name"],
            "tier": int(r["tier"]), "award": int(r["award"]),
            "best": r["best"], "sec": float(r["secondary"]),
            "rating": float(r["rating"]), "old_score": float(r["old_score"]),
            "n": int(r["records"]),
        })

N = len(rows)
print(f"读入 {N} 人\n")

# ---- 1. 字典序严格性：rating 必须单调不增 -----------------------------------
bad = [(a, b) for a, b in zip(rows, rows[1:]) if a["rating"] < b["rating"] - 1e-9]
print(f"【不变量 1】rating 单调不增：{'OK' if not bad else f'违反 {len(bad)} 处'}")
if bad:
    for a, b in bad[:3]:
        print("   ", a["new"], a["name"], a["rating"], "→", b["new"], b["name"], b["rating"])

# ---- 2. (tier, award) 必须成段，不允许交错 ----------------------------------
seen, order_ok, cur = set(), True, None
for r in rows:
    k = (r["tier"], r["award"])
    if k != cur:
        if k in seen:
            order_ok = False
            print(f"   ⚠ 桶 {k} 出现两段，首个交集在 #{r['new']}")
            break
        seen.add(k)
        cur = k
print(f"【不变量 2】(层级, 奖项) 成段不交错：{'OK' if order_ok else '违反'}")

# ---- 3. 高层的任意一人必须排在低层所有人之前 --------------------------------
tiers = Counter(r["tier"] for r in rows)
max_rank_of_tier = {}
for r in rows:
    max_rank_of_tier[r["tier"]] = max(max_rank_of_tier.get(r["tier"], 0), r["new"])
min_rank_of_tier = {}
for r in rows:
    min_rank_of_tier[r["tier"]] = min(min_rank_of_tier.get(r["tier"], 10 ** 9), r["new"])
print("\n【不变量 3】层级边界（该层最后一名 < 下一层第一名的层级）")
for t in sorted(max_rank_of_tier, reverse=True):
    print(f"    层级 {t}: {tiers[t]:6d} 人   名次 {min_rank_of_tier[t]:6d} – {max_rank_of_tier[t]:6d}")

# ---- 4. 同奖项档内的其余成绩必须单调 ----------------------------------------
viol = 0
i = 0
while i < N:
    j = i
    while j + 1 < N and (rows[j + 1]["tier"], rows[j + 1]["award"]) == (rows[i]["tier"], rows[i]["award"]):
        j += 1
    for k in range(i, j):
        if rows[k]["sec"] < rows[k + 1]["sec"] - 1e-9:
            viol += 1
    i = j + 1
print(f"\n【不变量 4】同桶内 secondary 单调不增：{'OK' if viol == 0 else f'违反 {viol} 处'}")

# ---- 5. 具体人核查 ----------------------------------------------------------
print("\n【抽样】旧模型里被省一压过的 IOI 金牌（新模型名次）：")
targets = {}
for r in rows:
    if r["best"].startswith("IOI") and r["award"] == 5:
        targets[r["uid"]] = r
watch = ["赖陆", "冯齐", "蒋中", "沈洋", "周而进"]
for r in sorted(targets.values(), key=lambda x: x["new"]):
    if any(w in r["name"] for w in watch[:2]):
        print(f"    #{r['new']:>6d}（旧 #{r['old']:>6d}，{r['old'] - r['new']:+7d}）"
              f" {r['name']:<6s} {r['best']}  旧分 {r['old_score']:.1f}")

print("\n【分层】新模型前 20 名：")
for r in rows[:20]:
    print(f"    #{r['new']:>3d}（旧 #{r['old']:>6d}）{r['name']:<6s} {r['best']:<22s}"
          f" 其余 {r['sec']:.3f}  {r['n']:2d}条")

# ---- 6. 分数是否还会被"堆条数"淹没 ------------------------------------------
print("\n【对照】同一 (层级, 奖项) 桶内，记录条数 vs 名次（看堆条数还有没有用）")
by_bucket = defaultdict(list)
for r in rows:
    by_bucket[(r["tier"], r["award"])].append(r)
for k in sorted(by_bucket, reverse=True)[:6]:
    seg = by_bucket[k]
    if len(seg) < 50:
        continue
    many = [x for x in seg if x["n"] >= 10]
    few = [x for x in seg if x["n"] <= 3]
    f = lambda a: f"中位 {sorted(x['new'] for x in a)[len(a)//2]:6d}" if a else "   -   "
    print(f"    桶 {k} 共 {len(seg):5d} 人：≥10 条 {len(many):4d} 人 {f(many)}   "
          f"≤3 条 {len(few):4d} 人 {f(few)}")

# ---- 7. 整体变动 ------------------------------------------------------------
deltas = sorted(r["old"] - r["new"] for r in rows)
up = sum(1 for d in deltas if d > 0)
print(f"\n【整体】名次上升 {up} 人 / 下降 {N - up} 人；Δ 中位 {deltas[len(deltas)//2]}；"
      f"变动 ≥1000 名 {sum(1 for d in deltas if abs(d) >= 1000)} 人")
