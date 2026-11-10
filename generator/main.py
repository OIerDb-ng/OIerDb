#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

# 修改说明（AGPL-3.0 §5(a)）
# 本文件在原项目 OIerDb（作者 Baoshuo，AGPL-3.0）基础上新增了「分层优先排名」入口
# （--lex-rank / --rank=lex）及相应输出与预览报告，由 Yanhao Xiang 于 2026-11-10 二次开发，
# 修改后的代码同样以 GNU AGPL-3.0 发布（完整源码即本仓库）。

import hashlib
import json
import os
import util
from contest import Contest
from oier import OIer
from record import Record
from school import School
from sys import argv, stderr, executable
from tqdm import tqdm
import subprocess


def __main__():
    gender_map = {"男": 1, "女": -1}
    new_schools = []

    def parse_school_line(line):
        """解析 school.txt 文件的一行。

        line: 一行。
        """

        if line.startswith("#"):  # 注释
            return
        li = line.split(",")
        if len(li) < 3:
            raise ValueError("格式错误")
        province, city, name, *aliases = li
        # 全空的废弃条目（,,）仅用于占位以保持 ID 对齐，不校验省份
        if (province or city or name) and province not in util.provinces:
            raise util.UnknownReferenceError(f"未知的省级行政区：\x1b[32m'{province}'\x1b[0m")
        School.create(name, province, city, aliases)

    def parse_school():
        "解析 school.txt 文件。"

        with open("../data/school.txt", encoding="utf-8") as f:
            raw_data = f.readlines()
        unknown_references = 0
        for idx, line in tqdm(enumerate(raw_data), total=len(raw_data)):
            try:
                parse_school_line(line.strip())
            except util.UnknownReferenceError as e:
                # 未知的省份必须中止生成（static.json 的省份为数字下标，无法编码未知值）
                print(
                    f"\x1b[01mschool.txt:{idx + 1}: \x1b[31mfatal: \x1b[0;37m'{line.strip()}'\x1b[0m，{e}",
                    file=stderr,
                )
                unknown_references += 1
            except ValueError as e:
                print(
                    f"\x1b[01mschool.txt:{idx + 1}: \x1b[031merror: \x1b[0;37m'{line.strip()}'\x1b[0m，{e}",
                    file=stderr,
                )
        if unknown_references:
            print("\n" + "=" * 60, file=stderr)
            print(
                f"\x1b[01;31mschool.txt 中共有 {unknown_references} 行存在未知的省级行政区（如上所示）\x1b[0m",
                file=stderr,
            )
            print(
                "\x1b[31m请先在 generator/util.py 的省份列表中补充定义，或更正对应条目，再重新生成\x1b[0m",
                file=stderr,
            )
            print("=" * 60, file=stderr)
            raise ValueError("数据验证失败，school.txt 中存在未知的省级行政区，无法生成最终结果")

    def parse_raw_line(line):
        """解析 raw.txt 文件的一行。

        line: 一行。
        """

        if line.startswith("#"):  # 注释
            return
        li = line.split(",")
        if len(li) != 9:
            raise ValueError("格式错误")
        contest_name, level, name, grade_name, school_name, score, province, gender_name, identifier = li
        if name == "":
            raise ValueError("姓名不能为空")
        if province not in util.provinces:
            raise util.UnknownReferenceError(f"未知的省级行政区：\x1b[32m'{province}'\x1b[0m")
        if level not in util.award_levels:
            raise util.UnknownReferenceError(f"未知的奖项名称：\x1b[32m'{level}'\x1b[0m")
        contest = Contest.by_name(contest_name)

        try:
            school = School.by_name_in_province(school_name, province)
        except ValueError as e:
            if '--disable-school-fallback' in argv:
                new_schools.append((province, school_name))
                raise e
            else:
                try:
                    print(
                        f"\x1b[33mwarning: \x1b[0;37m无法识别学校名 \x1b[35m'{school_name}'\x1b[0m 在省份 \x1b[35m'{province}'\x1b[0m 中，回退到全局查找\x1b[0m",
                        file=stderr,
                    )
                    school = School.by_name(school_name)
                except ValueError as e:
                    new_schools.append((province, school_name))
                    raise e

        grades = util.get_grades(grade_name)
        gender = gender_map.get(gender_name, 0)
        if not Contest.is_score_valid(score):
            raise ValueError(f"无法识别的分数：\x1b[032m'{score}'\x1b[0m")
        # 开始创建数据
        oier = OIer.of(name, identifier)
        record = contest.add_contestant(oier, score, level, grades, school, province, gender)
        oier.add_record(record)

    def parse_raw():
        "解析 raw.txt 文件。"

        with open("../data/raw.txt", encoding="utf-8") as f:
            raw_data = f.readlines()
        unknown_references = 0
        for idx, line in tqdm(enumerate(raw_data), total=len(raw_data)):
            try:
                parse_raw_line(line.strip())
            except util.UnknownReferenceError as e:
                # 未知的省份/奖项/比赛必须中止生成（继续会在 result.txt 中
                # 写入未经索引的原始字符串，破坏前端解析约定），先收集全部再退出
                print(
                    f"\x1b[01mraw.txt:{idx + 1}: \x1b[31mfatal: \x1b[0;37m'{line.strip()}'\x1b[0m，{e}",
                    file=stderr,
                )
                unknown_references += 1
            except ValueError as e:
                print(
                    f"\x1b[01mraw.txt:{idx + 1}: \x1b[31merror: \x1b[0;37m'{line.strip()}'\x1b[0m，{e}",
                    file=stderr,
                )
        if unknown_references:
            print("\n" + "=" * 60, file=stderr)
            print(
                f"\x1b[01;31mraw.txt 中共有 {unknown_references} 行引用了未知的省份/奖项/比赛（如上所示）\x1b[0m",
                file=stderr,
            )
            print(
                "\x1b[31m请先在 data/contests.json（比赛）或 generator/util.py（省份/奖项列表）中补充定义，再重新生成\x1b[0m",
                file=stderr,
            )
            print("=" * 60, file=stderr)
            raise ValueError("数据验证失败，存在未知的省份/奖项/比赛，无法生成最终结果")

    def attempt_merge(threshold=240):
        """尝试合并信息。

        threshold: 距离阈值。
        """

        recordseqs = []
        length = OIer.count_all()
        for idx, oier in tqdm(enumerate(OIer.get_all()), total=OIer.count_all()):
            # tqdm
            # 手动合并的无需拆分
            if oier.identifier:
                recordseqs.append(oier.records)
                continue
            original_length = len(oier.records)
            a = [[record] for record in oier.records]
            while True:
                n, best, bi, bj = len(a), threshold + 1, -1, -1
                for i in range(n):
                    for j in range(i):
                        if (dist := Record.distance(a[j], a[i], threshold + 1)) < best:
                            best, bi, bj = dist, j, i
                if best <= threshold:
                    stay_down = Record.check_stay_down(a[bi], a[bj])
                    if stay_down == 1:
                        for record in a[bi]:
                            record.keep_grade()
                    elif stay_down == -1:
                        for record in a[bj]:
                            record.keep_grade()
                    else:
                        assert stay_down == 0
                    a[bi].extend(a[bj])
                    del a[bj]
                else:
                    break
            if "--show-incomplete-merge" in argv and len(a) != 1:
                print(
                    f"\x1b[01;33mwarning: \x1b[0;32m'{oier.name}'\x1b[0m 未完全合并，合并进度为 \x1b[32m{original_length}\x1b[0m → \x1b[32m{len(a)}\x1b[0m",
                    file=stderr,
                )
            recordseqs.extend(a)
        OIer.clear()
        for recordseq in tqdm(recordseqs):
            original = recordseq[0].oier
            # UID 定为该 OIer 首次出现的<b>有效</b>行号
            uid = min(recordseq, key=lambda record: record.id).id
            # 入学年份取众数，相同的话取最早的
            em = util.get_weighted_mode([record.ems for record in recordseq if not record.is_keep_grade()])[0]
            # 性别如果唯一则取之，空或不唯一置空（如跨性别）
            gender = set(record.gender for record in recordseq if record.gender)
            gender = gender.pop() if len(gender) == 1 else 0
            oier = OIer(original.name, original.identifier, gender, em, uid)
            oier.records = recordseq[:]
            for record in oier.records:
                record.oier = oier

    def analyze_individual_oier():
        "分析各体信息。"

        for oier in tqdm(OIer.get_all()):
            oier.compute_ccf_level()
            oier.compute_oierdb_score()

    def apply_lex_ranking():
        """分层优先排名：先按最高赛事层级，再按该层级上的最高奖项，最后看其余成绩。

        同时保留旧的累加排名（rank_old），供预览文件对比。
        """

        import ranking

        ranking.load()

        # 先判定派生赛事（NGOI(y) 与 NOIP(y-1) 成绩一致者不计入排名）
        report = ranking.detect_derived_contests(OIer.get_all())
        excluded = ranking._RULES.get("excluded_contest_names", [])
        for name, total, sample, same, ratio in report:
            mark = "排除" if name in excluded else "保留"
            print(f"  {name}: {total} 条记录，{sample} 条可与上年 NOIP 比对，"
                  f"{same} 条分数一致（{ratio * 100:.1f}%）→ {mark}", file=stderr)

        # 旧排名（累加模型）
        old_order = sorted(OIer.get_all(), key=lambda o: (-o.oierdb_score, o.uid))
        for idx, oier in enumerate(old_order, 1):
            oier.rank_old = idx

        # 新排名（分层优先）
        pairs = [(ranking.prepare(oier), oier) for oier in tqdm(OIer.get_all())]
        pairs.sort(key=lambda pair: pair[0])
        OIer.__all_oiers_list__[:] = [oier for _, oier in pairs]
        for idx, oier in enumerate(OIer.get_all(), 1):
            oier.rank_new = idx

        # 学校榜也使用 LexRank：每个学生在同一学校只贡献一次，
        # 学生之间按个人排名排序并用递减权重聚合。
        school_scores = ranking.school_scores(OIer.get_all())
        for school in School.get_all():
            school.score = school_scores.get(school, 0.0)

    def output_lex_result():
        "输出新排名结果，并把旧排名另存一份用于对比。"

        import ranking

        ranking_on = any(a in ("--lex-rank", "--rank=lex") for a in argv)
        with open("dist/result.txt", "w", newline="\n", encoding="utf-8") as f:
            for oier in tqdm(OIer.get_all()):
                score = oier.lex_rating if ranking_on else None
                print(oier.to_compress_format(score), file=f, end="\n")
        if not ranking_on:
            return

        # 旧排名的结果另存，便于 A/B 对比
        old_order = sorted(OIer.get_all(), key=lambda o: o.rank_old)
        with open("dist/result_old.txt", "w", newline="\n", encoding="utf-8") as f:
            for oier in tqdm(old_order):
                print(oier.to_compress_format(), file=f, end="\n")

        with open("dist/rank_diff.tsv", "w", newline="\n", encoding="utf-8") as f:
            print("new_rank\told_rank\tdelta\tuid\tname\ttier\taward\tbest\tsecondary\trating"
                  "\told_score\trecords", file=f)
            for oier in tqdm(OIer.get_all()):
                print(f"{oier.rank_new}\t{oier.rank_old}\t{oier.rank_old - oier.rank_new}\t"
                      f"{oier.uid}\t{oier.name}\t{oier.lex_tier}\t{oier.lex_award}\t"
                      f"{ranking.describe(oier)}\t{oier.lex_secondary:.4f}\t{oier.lex_rating:.2f}\t"
                      f"{float(oier.oierdb_score):.2f}\t{len(oier.records)}", file=f)

        write_rank_preview()

    def write_rank_preview():
        "生成人类可读的排名对比报告 dist/rank_preview.md。"

        import ranking
        from collections import Counter, defaultdict

        people = OIer.get_all()
        total = len(people)

        def has_medal(oier, types, levels=("金牌", "银牌", "铜牌", "国际金牌", "国际银牌", "国际铜牌")):
            return any(r.contest.type in types and r.level in levels for r in oier.records)

        def has_level(oier, types, level):
            return any(r.contest.type in types and r.level == level for r in oier.records)

        def best_award_text(oier):
            return ranking.describe(oier)

        buckets = Counter((o.lex_tier, o.lex_award) for o in people)
        with open("dist/rank_preview.md", "w", newline="\n", encoding="utf-8") as f:
            print("# 分层优先排名预览\n", file=f)
            print("规则：`contest_tier`（赛事层级）→ `award_rank`（该层级上的最高奖项）"
                  "→ `secondary`（其余成绩，有界）→ `uid`。规则表见 `data/ranking.json`。\n", file=f)
            print(f"- 总人数：{total}", file=f)
            print(f"- 主键分桶数（同一 (层级, 奖项) 的组）：{len(buckets)}", file=f)
            print(f"- 最大一桶：{buckets.most_common(1)[0]}", file=f)

            print("\n## 前 100 名\n", file=f)
            print("| 新名次 | 旧名次 | 变动 | 姓名 | 最高成就 | 其余成绩 | 合成评分 | 记录数 |",
                  file=f)
            print("|---:|---:|---:|---|---|---:|---:|---:|", file=f)
            for o in people[:100]:
                d = o.rank_old - o.rank_new
                print(f"| {o.rank_new} | {o.rank_old} | {d:+d} | {o.name} | {best_award_text(o)} "
                      f"| {o.lex_secondary:.3f} | {o.lex_rating:.1f} | {len(o.records)} |", file=f)

            print("\n## IOI 金牌得主的新旧名次\n", file=f)
            ioi_gold = [o for o in people if has_medal(o, ("IOI",), ("金牌",))]
            ioi_gold.sort(key=lambda o: o.rank_new)
            print(f"共 {len(ioi_gold)} 人\n", file=f)
            print("| 新名次 | 旧名次 | 变动 | 姓名 | 最高成就 | 记录数 |", file=f)
            print("|---:|---:|---:|---|---|---:|", file=f)
            for o in ioi_gold[:20]:
                d = o.rank_old - o.rank_new
                print(f"| {o.rank_new} | {o.rank_old} | {d:+d} | {o.name} | {best_award_text(o)} "
                      f"| {len(o.records)} |", file=f)
            if len(ioi_gold) > 20:
                print(f"| … | | | 其余 {len(ioi_gold) - 20} 人 | | |", file=f)
            if ioi_gold:
                new_rk = [o.rank_new for o in ioi_gold]
                old_rk = [o.rank_old for o in ioi_gold]
                print(f"\n- 新名次：最好 #{min(new_rk)}，中位 #{sorted(new_rk)[len(new_rk)//2]}，"
                      f"最差 #{max(new_rk)}", file=f)
                print(f"- 旧名次：最好 #{min(old_rk)}，中位 #{sorted(old_rk)[len(old_rk)//2]}，"
                      f"最差 #{max(old_rk)}", file=f)

            print("\n## 变动最大的选手\n", file=f)
            movers = sorted(people, key=lambda o: o.rank_old - o.rank_new)
            print("上升最多的 15 人：\n", file=f)
            print("| 变动 | 新名次 | 旧名次 | 姓名 | 最高成就 |", file=f)
            print("|---:|---:|---:|---|---|", file=f)
            for o in movers[::-1][:15]:
                print(f"| {o.rank_old - o.rank_new:+d} | {o.rank_new} | {o.rank_old} | {o.name} "
                      f"| {best_award_text(o)} |", file=f)
            print("\n下降最多的 15 人：\n", file=f)
            print("| 变动 | 新名次 | 旧名次 | 姓名 | 最高成就 |", file=f)
            print("|---:|---:|---:|---|---|", file=f)
            for o in movers[:15]:
                print(f"| {o.rank_old - o.rank_new:+d} | {o.rank_new} | {o.rank_old} | {o.name} "
                      f"| {best_award_text(o)} |", file=f)

            print("\n## 效度检查（旧模型 vs 新模型）\n", file=f)
            top1000_new = people[:1000]
            old_top1000 = sorted(people, key=lambda o: o.rank_old)[:1000]

            print("| 指标 | 旧模型 | 新模型 |", file=f)
            print("|---|---:|---:|", file=f)
            print(f"| 前 1000 名里有 IOI 金牌 | "
                  f"{sum(1 for o in old_top1000 if has_level(o, ('IOI',), '金牌'))} | "
                  f"{sum(1 for o in top1000_new if has_level(o, ('IOI',), '金牌'))} |", file=f)
            print(f"| 前 1000 名里有 IOI 奖牌 | "
                  f"{sum(1 for o in old_top1000 if has_medal(o, ('IOI',)))} | "
                  f"{sum(1 for o in top1000_new if has_medal(o, ('IOI',)))} |", file=f)
            print(f"| 前 1000 名里有 NOI 金牌 | "
                  f"{sum(1 for o in old_top1000 if has_level(o, ('NOI',), '金牌'))} | "
                  f"{sum(1 for o in top1000_new if has_level(o, ('NOI',), '金牌'))} |", file=f)
            print(f"| 前 1000 名里有 NOIP/CSP-S 一等奖（无更高奖项） | "
                  f"{sum(1 for o in old_top1000 if has_level(o, ('NOIP', 'NOIP提高', 'CSP提高'), '一等奖') and not has_medal(o, ('IOI', 'NOI', 'NOID类', 'WC', 'APIO', 'CTSC')))} | "
                  f"{sum(1 for o in top1000_new if has_level(o, ('NOIP', 'NOIP提高', 'CSP提高'), '一等奖') and not has_medal(o, ('IOI', 'NOI', 'NOID类', 'WC', 'APIO', 'CTSC')))} |",
                  file=f)
            print(f"| IOI 金牌最差名次 | {max((o.rank_old for o in ioi_gold), default=0)} | "
                  f"{max((o.rank_new for o in ioi_gold), default=0)} |", file=f)
            print(f"| IOI 金牌中位名次 | "
                  f"{sorted(o.rank_old for o in ioi_gold)[len(ioi_gold)//2] if ioi_gold else 0} | "
                  f"{sorted(o.rank_new for o in ioi_gold)[len(ioi_gold)//2] if ioi_gold else 0} |",
                  file=f)

            churn = sum(1 for o in people if abs(o.rank_old - o.rank_new) >= 1000)
            print(f"| 名次变动 ≥1000 的人数 | — | {churn} ({churn/total*100:.1f}%) |", file=f)

            print("\n## 最高赛事层级的分布\n", file=f)
            by_tier = Counter(o.lex_tier for o in people)
            print("| 层级 | 人数 | 占比 |", file=f)
            print("|---:|---:|---:|", file=f)
            for t in sorted(by_tier, reverse=True):
                print(f"| {t} | {by_tier[t]} | {by_tier[t]/total*100:.2f}% |", file=f)

            print("\n## 派生赛事判定（NGOI）\n", file=f)
            print("NGOI 是当年 NOIP 成绩在全体女选手中的排名。下表把每条 NGOI 与"
                  "同一人上一年 NOIP 的原始分数比对；一致率 ≥95% 的整场排除。\n", file=f)
            print("| 赛事 | 记录数 | 可比记录 | 分数一致 | 一致率 | 处理 |", file=f)
            print("|---|---:|---:|---:|---:|---|", file=f)
            excluded = ranking._RULES.get("excluded_contest_names", [])
            for name, tot, sample, same, ratio in ranking.last_report:
                mark = "**排除**" if name in excluded else "保留"
                print(f"| {name} | {tot} | {sample} | {same} | {ratio*100:.1f}% | {mark} |",
                      file=f)


    def validate_data():
        "验证数据完整性，检查是否存在重复的 UID、学校 ID、比赛 ID 及【比赛 ID、UID】组合。"

        errors = []

        # 检查重复的 UID
        uid_list = [oier.uid for oier in OIer.get_all()]
        uid_counter = {}
        for uid in uid_list:
            uid_counter[uid] = uid_counter.get(uid, 0) + 1
        duplicate_uids = [uid for uid, count in uid_counter.items() if count > 1]
        if duplicate_uids:
            errors.append(f"发现重复的 UID: {', '.join(map(str, duplicate_uids))}")

        # 检查重复的学校 ID
        school_id_list = [school.id for school in School.get_all()]
        school_id_counter = {}
        for sid in school_id_list:
            school_id_counter[sid] = school_id_counter.get(sid, 0) + 1
        duplicate_school_ids = [sid for sid, count in school_id_counter.items() if count > 1]
        if duplicate_school_ids:
            errors.append(f"发现重复的学校 ID: {', '.join(map(str, duplicate_school_ids))}")

        # 检查重复的比赛 ID
        contest_id_list = [contest.id for contest in Contest.get_all()]
        contest_id_counter = {}
        for cid in contest_id_list:
            contest_id_counter[cid] = contest_id_counter.get(cid, 0) + 1
        duplicate_contest_ids = [cid for cid, count in contest_id_counter.items() if count > 1]
        if duplicate_contest_ids:
            errors.append(f"发现重复的比赛 ID: {', '.join(map(str, duplicate_contest_ids))}")

        # 检查重复的【比赛 ID、UID】组合
        contest_uid_pairs = []
        for oier in OIer.get_all():
            for record in oier.records:
                contest_uid_pairs.append((record.contest.id, oier.uid))
        
        pair_counter = {}
        for pair in contest_uid_pairs:
            pair_counter[pair] = pair_counter.get(pair, 0) + 1
        duplicate_pairs = [pair for pair, count in pair_counter.items() if count > 1]
        if duplicate_pairs:
            errors.append(
                f"发现重复的【比赛 ID、UID】组合: " + 
                ', '.join([f"(比赛ID: {cid}, UID: {uid})" for cid, uid in duplicate_pairs])
            )

        # 如果存在错误，输出并退出
        if errors:
            print("\n" + "=" * 60, file=stderr)
            print("\x1b[01;31m数据验证失败！发现以下错误：\x1b[0m", file=stderr)
            for error in errors:
                print(f"\x1b[31m  - {error}\x1b[0m", file=stderr)
            print("=" * 60, file=stderr)
            raise ValueError("数据验证失败，存在重复数据，无法生成最终结果")

        print("\x1b[32m数据验证通过，未发现重复数据\x1b[0m", file=stderr)

    def merge_schools():
        "合并新增学校信息，输出到 dist/merge_preview.txt 中。"

        nonlocal new_schools
        new_schools = sorted(set(new_schools))
        with open("dist/merge_preview.txt", "w", encoding="utf-8") as f:
            print(
"""# 用 '#' 号表示注释。
# 这是由 main.py 自动生成的学校合并确认文件，本文件的格式有如下几种：
#   b <name> <origin>  表示将新名称 <name> 合并到 <origin>，将名称作为别名。
#   f <name>,<origin>  表示将新名称 <name> 合并到 <origin>，并将新名称设为正式名称。
#   c <province> <city> <name>  表示插入学校 <province>,<city>,<name>。
#   s <name> <origin>  表示将名称 <name> 从 <origin> 拆出，并按照原来的地区设置新建一个学校。""",
                file=f,
            )
            for province, school_name in tqdm(new_schools):
                res = School.find_candidate(school_name, province)
                method = res[0]
                if method == "b":
                    school = res[1]
                    print(
                        f"\x1b[32m[direct redirect]\x1b[0m: \x1b[35m'{school_name}'\x1b[0m → \x1b[37m'{school.name}'\x1b[0m",
                        file=stderr,
                    )
                    print(f"b {school_name} {school.name}", file=f)
                elif method == "f":
                    school = res[1]
                    print(
                        f"\x1b[32m[name changed]\x1b[0m: \x1b[35m'{school_name}'\x1b[0m ← \x1b[37m'{school.name}'\x1b[0m",
                        file=stderr,
                    )
                    print(f"f {school_name} {school.name}", file=f)
                elif method == "fs":
                    school = res[1]
                    standard = res[2]
                    print(
                        f"\x1b[32m[towards standard name]\x1b[0m: (\x1b[35m'{school_name}'\x1b[0m, \x1b[37m'{school.name}'\x1b[0m) → \x1b[33m'{standard}'\x1b[0m",
                        file=stderr,
                    )
                    print(f"f {standard} {school.name}", file=f)
                    print(f"b {school_name} {school.name}", file=f)
                elif method == "c":
                    city = res[1]
                    print(
                        f"\x1b[32m[create]\x1b[0m: (\x1b[35m'{province}'\x1b[0m, \x1b[35m'{city}'\x1b[0m, \x1b[35m'{school_name}'\x1b[0m)",
                        file=stderr,
                    )
                    print(f"c {province} {city} {school_name}", file=f, end="\n")

    def export_unknown_schools():
        "导出未识别到的学校信息，输出到 dist/unknown-schools.txt 中，一行一个。"

        unknown_schools = sorted(set(new_schools))
        with open("dist/unknown-schools.txt", "w", newline="\n", encoding="utf-8") as f:
            for province, school_name in unknown_schools:
                print(f"{province},{school_name}", file=f)

    def output_schools():
        "输出学校信息。"

        output = []
        for school in tqdm(School.get_all()):
            # 省份输出为 util.provinces 的数字下标；全空的废弃条目记 -1（前端解析时跳过）
            province = -1 if school.province == "" else util.provinces.index(school.province)
            output.append([school.name, province, school.city, float(round(school.score, 2))])
        with open("dist/school.json", "w", newline="\n", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False)

    def output_compressed():
        "输出压缩的结果，不压缩的结果先咕着。"

        OIer.sort_by_score()
        with open("dist/result.txt", "w", newline="\n", encoding="utf-8") as f:
            for oier in tqdm(OIer.get_all()):
                print(oier.to_compress_format(), file=f, end="\n")

    def compute_sha512():
        """
        计算 dist/result.txt 的 SHA512 值，保存在 sha512/result 中。
        （注：使用 *.txt 后缀可以利用 gzip 压缩）
        """

        file_size = os.stat("dist/result.txt").st_size

        with open("dist/result.txt", "rb") as f:
            sha512 = hashlib.sha512(f.read()).hexdigest()
        with open("dist/result.info.json", "w", newline="\n", encoding="utf-8") as f:
            print('{"sha512":"' + sha512 + '", "size":' + str(file_size) + "}", file=f)

    def update_static():
        "调用 update_static.py 以产生静态 JSON 信息。"
        
        subprocess.run([executable, "update_static.py"], check=True)

    def report_status(message):
        "向终端报告当前进度。"

        print(f"================ {message} ================", file=stderr)

    report_status("读取学校信息中")
    parse_school()

    report_status("读取选手信息中")
    parse_raw()

    report_status("合并信息中")
    attempt_merge()

    report_status("分析选手中")
    analyze_individual_oier()

    lex_ranking = any(a in ("--lex-rank", "--rank=lex") for a in argv)
    if lex_ranking:
        report_status("计算分层优先排名中")
        apply_lex_ranking()
    else:
        OIer.sort_by_score()

    report_status("验证数据完整性中")
    validate_data()

    if "--merge-schools" in argv:
        report_status("尝试合并学校中")
        merge_schools()

    if "--export-unknown-schools" in argv:
        report_status("导出未识别学校中")
        export_unknown_schools()

    report_status("输出到 dist/result.txt 中")
    if lex_ranking:
        output_lex_result()
    else:
        output_compressed()

    report_status("计算 SHA512 摘要中")
    compute_sha512()

    report_status("输出学校信息中")
    output_schools()

    report_status("输出静态 JSON 信息中")
    update_static()


if __name__ == "__main__":
    __main__()
