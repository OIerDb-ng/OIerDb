#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

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
        School.create(name, province, city, aliases)

    def parse_school():
        "解析 school.txt 文件。"

        with open("../data/school.txt") as f:
            raw_data = f.readlines()
        for idx, line in tqdm(enumerate(raw_data), total=len(raw_data)):
            try:
                parse_school_line(line.strip())
            except ValueError as e:
                print(
                    f"\x1b[01mschool.txt:{idx + 1}: \x1b[031merror: \x1b[0;37m'{line.strip()}'\x1b[0m，{e}",
                    file=stderr,
                )

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
        contest = Contest.by_name(contest_name)

        try:
            school = School.by_name_in_province(school_name, province)
        except ValueError as e:
            if "--disable-school-fallback" in argv:
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

        with open("../data/raw.txt") as f:
            raw_data = f.readlines()
        for idx, line in tqdm(enumerate(raw_data), total=len(raw_data)):
            try:
                parse_raw_line(line.strip())
            except ValueError as e:
                print(
                    f"\x1b[01mraw.txt:{idx + 1}: \x1b[31merror: \x1b[0;37m'{line.strip()}'\x1b[0m，{e}",
                    file=stderr,
                )

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
                f"发现重复的【比赛 ID、UID】组合: "
                + ", ".join([f"(比赛ID: {cid}, UID: {uid})" for cid, uid in duplicate_pairs])
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
        with open("dist/merge_preview.txt", "w") as f:
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

    def output_schools():
        "输出学校信息。"

        output = []
        for school in tqdm(School.get_all()):
            output.append([school.name, school.province, school.city, float(round(school.score, 2))])
        with open("dist/school.json", "w", newline="\n") as f:
            json.dump(output, f, ensure_ascii=False)

    def output_compressed():
        "输出压缩的结果，不压缩的结果先咕着。"

        OIer.sort_by_score()
        with open("dist/result.txt", "w", newline="\n") as f:
            for oier in tqdm(OIer.get_all()):
                print(oier.to_compress_format(), file=f, end="\n")

    def compute_sha512():
        """
        计算 dist/result.txt 的 SHA512 值,保存在 result.info.json 中,并创建符号链接。
        (注:使用 *.txt 后缀可以利用 gzip 压缩)
        """

        file_size = os.stat("dist/result.txt").st_size

        with open("dist/result.txt", "rb") as f:
            sha512 = hashlib.sha512(f.read()).hexdigest()
        with open("dist/result.info.json", "w", newline="\n") as f:
            print('{"sha512":"' + sha512 + '", "size":' + str(file_size) + "}", file=f)

        # 创建符号链接
        sha512_short = sha512[:7]

        # 创建符号链接 result.{sha512前7位}.txt -> result.txt
        result_versioned_link = f"dist/result.{sha512_short}.txt"
        if os.path.exists(result_versioned_link) or os.path.islink(result_versioned_link):
            os.unlink(result_versioned_link)
        os.symlink("result.txt", result_versioned_link)

        # 创建符号链接 result.sha512.json -> result.info.json
        result_sha512_link = "dist/result.sha512.json"
        if os.path.exists(result_sha512_link) or os.path.islink(result_sha512_link):
            os.unlink(result_sha512_link)
        os.symlink("result.info.json", result_sha512_link)

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
