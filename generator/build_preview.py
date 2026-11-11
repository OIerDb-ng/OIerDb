#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""把 dist/ 的生成结果打包成一个可双击打开的单文件预览页 dist/preview.html。

数据来源：
    dist/result.txt        新模型榜单（新排序）
    dist/rank_diff.tsv     新旧名次、层级、奖项、其余成绩
    data/contests.json     赛事名 / 类型 / 年份
    data/school.txt        学校名 / 省 / 市
    data/ranking.json      赛事层级（用于显示层级名）


署名与许可：Yanhao Xiang 于 2026-11-10 在原项目 OIerDb（作者 Baoshuo，AGPL-3.0）
基础上二次开发；本文件同样以 GNU AGPL-3.0 发布，完整源码即本仓库。"""

import json
import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, ".")
import util  # noqa: E402
import ranking  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")
DATA = os.path.join(HERE, "..", "data")


def load_meta():
    contests = json.load(open(os.path.join(DATA, "contests.json"), encoding="utf-8"))
    ranking.load(os.path.join(DATA, "ranking.json"))

    cinfo = []
    for c in contests:
        cinfo.append([c["name"], util.contest_types.index(c["type"]), c["year"],
                      ranking.tier_for(c["type"], c["year"]),
                      util.school_year(c["year"], c["fall_semester"])])

    schools = []
    with open(os.path.join(DATA, "school.txt"), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            li = line.split(",")
            if len(li) < 3:
                continue
            schools.append([li[2], li[0], li[1]])

    return {
        "contests": cinfo,
        "schools": schools,
        "provinces": util.provinces,
        "levels": util.award_levels,
        "types": util.contest_types,
        "tierNames": {
            "9": "IOI 国际赛",
            "8": "国家级（NOI/CTSC/APIO）",
            "7": "WC 冬令营",
            "6": "NOI 夏令营",
            "5": "专项赛（女生/春季/AI）",
            "3": "NOIP（2020 年起单组别）",
            "2": "省赛提高级",
            "1": "省赛入门级",
        },
    }


def main():
    meta = load_meta()
    META_TYPES = meta["types"]

    diff = {}
    with open(os.path.join(DIST, "rank_diff.tsv"), encoding="utf-8") as f:
        h = f.readline().rstrip("\n").split("\t")
        for line in f:
            li = line.rstrip("\n").split("\t")
            if len(li) != len(h):
                continue
            r = dict(zip(h, li))
            diff[r["uid"]] = r

    rows, sids_of = [], {}
    ngoi_seen = defaultdict(list)          # ngoi 赛事名 -> [(uid, score)]
    per_person = defaultdict(list)         # uid -> [(cid, score)]
    with open(os.path.join(DIST, "result.txt"), encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            uid, ini, name, g, em, rating, ccf, ccf_lvl, recs = line.split(",", 8)
            r = diff.get(uid)
            if r is None:
                continue
            sids = sorted({int(x.split(":")[1]) for x in recs.split("/") if x})
            rows.append("|".join([
                uid, ini, name, g, em, rating, ccf, ccf_lvl,
                r["old_score"], r["old_rank"], r["tier"], r["award"], r["secondary"],
                r["best"], recs, ",".join(map(str, sids)),
            ]))
            sids_of[uid] = sids
            for x in recs.split("/"):
                if not x:
                    continue
                f2 = x.split(":")
                cid, sc = int(f2[0]), f2[2]
                per_person[uid].append((cid, sc))
                c = meta["contests"][cid]
                if META_TYPES[c[1]] == "NGOI" and sc:
                    ngoi_seen[c[0]].append((uid, sc))

    # 派生赛事报告：与 ranking.detect_derived_contests 使用相同的判定规则
    def is_noip(cid):
        return META_TYPES[meta["contests"][cid][1]].startswith("NOIP")

    report = []
    for cname in sorted(ngoi_seen):
        cid = next(i for i, c in enumerate(meta["contests"]) if c[0] == cname)
        target_sy = meta["contests"][cid][4]
        sample = same = 0
        for uid, sc in ngoi_seen[cname]:
            cands = [(c, s) for c, s in per_person[uid]
                     if is_noip(c) and meta["contests"][c][4] == target_sy and s]
            if not cands:
                continue
            sample += 1
            if ranking.derived_scores_match(sc, (s for _, s in cands)):
                same += 1
        ratio = same / sample if sample else 0.0
        report.append([cname, len(ngoi_seen[cname]), sample, same, round(ratio, 4)])
    meta["excluded"] = []
    meta["ngoi"] = report

    # 统计
    tier_count = Counter(int(r["tier"]) for r in diff.values())

    def count_where(pred):
        return sum(1 for r in diff.values() if pred(r))

    stats = {
        "total": len(diff),
        "tierCount": {str(k): v for k, v in sorted(tier_count.items(), reverse=True)},
        "top1000WithIoiGold": count_where(
            lambda r: int(r["new_rank"]) <= 1000 and r["best"].startswith("IOI")
            and int(r["award"]) == 5),
        "top1000WithIoiGoldOld": count_where(
            lambda r: int(r["old_rank"]) <= 1000 and r["best"].startswith("IOI")
            and int(r["award"]) == 5),
        "medalTop1000New": count_where(
            lambda r: int(r["new_rank"]) <= 1000 and int(r["tier"]) >= 7),
        "medalTop1000Old": count_where(
            lambda r: int(r["old_rank"]) <= 1000 and int(r["tier"]) >= 7),
    }

    payload = json.dumps({"meta": meta, "stats": stats, "rows": rows},
                         ensure_ascii=False, separators=(",", ":"))

    data_path = os.path.join(DIST, "preview_data.js")
    with open(data_path, "w", encoding="utf-8", newline="\n") as f:
        f.write("window.__PREVIEW__=")
        f.write(payload)
        f.write(";\n")

    with open(os.path.join(HERE, "preview_template.html"), encoding="utf-8-sig") as f:
        html = f.read()

    out = os.path.join(DIST, "preview.html")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    print(f"已生成 {out}（{os.path.getsize(out) / 1024:.0f} KB）"
          f" 与 {data_path}（{os.path.getsize(data_path) / 1048576:.1f} MB，{len(rows)} 人）")


if __name__ == "__main__":
    main()
