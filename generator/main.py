#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

import hashlib
import json
import os
import util
from contest import Contest
from oier import OIer
from loader import parse_raw_line, parse_school_line
from school import School
from sys import argv, stderr, executable
from tqdm import tqdm
import subprocess


def __main__():
    new_schools = []

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

    def warn_school_fallback(name, province):
        print(
            f"\x1b[33mwarning: \x1b[0;37m无法识别学校名 \x1b[35m'{name}'\x1b[0m 在省份 \x1b[35m'{province}'\x1b[0m 中，回退到全局查找\x1b[0m",
            file=stderr,
        )

    def add_raw_line(line):
        parsed = parse_raw_line(
            line,
            allow_school_fallback="--disable-school-fallback" not in argv,
            on_school_fallback=warn_school_fallback,
            on_unknown_school=lambda province, name: new_schools.append((province, name)),
        )
        if parsed is None:
            return
        oier = OIer.of(parsed.name, parsed.identifier)
        record = parsed.contest.add_contestant(
            oier, parsed.score, parsed.level, parsed.grades,
            parsed.school, parsed.province, parsed.gender,
        )
        oier.add_record(record)

    def parse_raw():
        "解析 raw.txt 文件。"

        with open("../data/raw.txt", encoding="utf-8") as f:
            raw_data = f.readlines()
        unknown_references = 0
        for idx, line in tqdm(enumerate(raw_data), total=len(raw_data)):
            try:
                add_raw_line(line.strip())
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

    def attempt_merge(threshold=OIer.MERGE_THRESHOLD):
        """尝试合并信息。

        threshold: 距离阈值。
        """

        recordseqs = []
        for oier in tqdm(OIer.get_all()):
            original_length = len(oier.records)
            a = OIer.group_records(oier.records, threshold)
            if "--show-incomplete-merge" in argv and not oier.identifier and len(a) != 1:
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
            em = OIer.enrollment_year(recordseq)
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

    report_status("验证数据完整性中")
    validate_data()

    if "--merge-schools" in argv:
        report_status("尝试合并学校中")
        merge_schools()

    if "--export-unknown-schools" in argv:
        report_status("导出未识别学校中")
        export_unknown_schools()

    report_status("输出到 dist/result.txt 中")
    output_compressed()

    report_status("计算 SHA512 摘要中")
    compute_sha512()

    report_status("输出学校信息中")
    output_schools()

    report_status("输出静态 JSON 信息中")
    update_static()


if __name__ == "__main__":
    __main__()
