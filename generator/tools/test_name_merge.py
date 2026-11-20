#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

"""繁简姓名合并的回归测试。

在临时目录里用十几条记录的极小数据跑一遍完整生成流程，覆盖：同校繁简写法合并、
同学段跨省不合并、只有繁体时保留原写法、记录数相同时取简体、姓名取最后一次参赛的写法、
粤港澳往返就读可合并、相同标识符强制合并。用法：

    python generator/tools/test_name_merge.py [--keep]

退出码为 0 表示全部通过，--keep 保留临时目录。
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

GENERATOR_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_DIR = os.path.dirname(GENERATOR_DIR)

SCHOOLS = [
    "香港,香港,哈罗香港国际学校,哈羅香港國際學校",
    "香港,香港,拔萃男书院",
    "香港,香港,香港培正中学",
    "香港,香港,皇仁书院",
    "北京,北京,北京市第一中学",
    "广东,深圳市,深圳中学",
]

# 比赛名, 奖项, 姓名, 年级, 学校, 分数, 省份, 性别, 标识符
RAW = [
    "CSP2024提高,一等奖,徐維昆,初二,哈罗香港国际学校,300,香港,男,",
    "CSP2025提高,一等奖,徐维昆,初三,哈罗香港国际学校,320,香港,男,",
    "NOIP2016提高,二等奖,張偉,初二,拔萃男书院,200,香港,男,",
    "NOIP2016提高,二等奖,张伟,初二,北京市第一中学,210,北京,男,",
    "NOI2013,铜牌,易維濱,中四,香港培正中学,269,香港,男,",
    "CSP2024入门,一等奖,陳浩賢,初三,皇仁书院,300,香港,男,<ZYX>",
    "CSP2025入门,一等奖,陈浩贤,高一,皇仁书院,300,香港,男,",
    "NOIP2016提高,一等奖,王崑,初二,皇仁书院,300,香港,男,",
    "NOIP2017提高,一等奖,王崑,初三,皇仁书院,310,香港,男,",
    "NOIP2018提高,一等奖,王昆,高一,皇仁书院,320,香港,男,",
    "CSP2022提高,一等奖,李思远,高一,北京市第一中学,300,北京,男,",
    "CSP2020入门,一等奖,李思遠,初二,拔萃男书院,300,香港,男,",
    "CSP2022提高,一等奖,王思远,高一,北京市第一中学,300,北京,男,A",
    "CSP2020入门,一等奖,王思遠,初二,拔萃男书院,300,香港,男,A",
    # 粤港澳往返就读：跨省但同一片就读区域，应当合并
    "CSP2024入门,一等奖,陈小明,初一,深圳中学,300,广东,男,",
    "CSP2025入门,一等奖,陳小明,初二,皇仁书院,320,香港,男,",
]

ANSI = re.compile(r"\x1b\[[0-9;]*m")


def prepare(work):
    generator = os.path.join(work, "generator")
    data = os.path.join(work, "data")
    os.makedirs(generator)
    os.makedirs(os.path.join(generator, "dist"))
    os.makedirs(data)
    for name in os.listdir(GENERATOR_DIR):
        if name.endswith(".py") or name == "t2s.json":
            shutil.copy(os.path.join(GENERATOR_DIR, name), os.path.join(generator, name))
    for name in os.listdir(os.path.join(REPO_DIR, "data")):
        if name.endswith(".json"):
            shutil.copy(os.path.join(REPO_DIR, "data", name), os.path.join(data, name))
    with open(os.path.join(data, "school.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(SCHOOLS) + "\n")
    with open(os.path.join(data, "raw.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(RAW) + "\n")
    return generator


def run(generator, *args):
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    return subprocess.run(
        [sys.executable, "main.py", *args],
        cwd=generator,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )


def parse_result(generator, contest_names):
    people = []
    with open(os.path.join(generator, "dist", "result.txt"), encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            parts = line.split(",")
            assert len(parts) == 9, line
            people.append(
                {
                    "uid": int(parts[0]),
                    "initials": parts[1],
                    "name": parts[2],
                    "records": [contest_names[int(record.split(":")[0])] for record in parts[8].split("/")],
                }
            )
    return people


def main():
    keep = "--keep" in sys.argv[1:]
    work = tempfile.mkdtemp(prefix="oierdb-name-merge-")
    try:
        generator = prepare(work)
        plain = run(generator)
        if plain.returncode != 0:
            print("main.py 运行失败：", file=sys.stderr)
            print(plain.stdout[-4000:] + plain.stderr[-8000:], file=sys.stderr)
            return 1
        with open(os.path.join(REPO_DIR, "data", "contests.json"), encoding="utf-8") as f:
            contest_names = [contest["name"] for contest in json.load(f)]
        people = parse_result(generator, contest_names)
        plain_result = open(os.path.join(generator, "dist", "result.txt"), "rb").read()

        verbose = run(generator, "--show-name-merges")
        if verbose.returncode != 0:
            print("main.py --show-name-merges 运行失败：", file=sys.stderr)
            print(verbose.stdout[-4000:] + verbose.stderr[-8000:], file=sys.stderr)
            return 1
        verbose_result = open(os.path.join(generator, "dist", "result.txt"), "rb").read()

        by_name = {}
        for person in people:
            by_name.setdefault(person["name"], []).append(person)
        stderr = ANSI.sub("", verbose.stderr)
        failures = []

        def check(condition, message):
            if not condition:
                failures.append(message)

        # 1. 徐維昆 / 徐维昆
        check("徐維昆" not in by_name, "徐維昆 应被合并进 徐维昆")
        check("徐维昆" in by_name, "结果中缺少 徐维昆")
        if "徐维昆" in by_name:
            check(
                sorted(by_name["徐维昆"][0]["records"]) == ["CSP2024提高", "CSP2025提高"],
                f"徐维昆 的记录不正确: {by_name['徐维昆'][0]['records']}",
            )

        # 2. 同学段跨省份不合并
        check("張偉" in by_name and "张伟" in by_name, "張偉 / 张伟 应各自保留")
        if "張偉" in by_name and "张伟" in by_name:
            check(len(by_name["張偉"][0]["records"]) == 1, "張偉 不应被合并")
            check(len(by_name["张伟"][0]["records"]) == 1, "张伟 不应被合并")

        # 3. 只有繁体写法时保持原样，首字母按原姓名计算
        check("易維濱" in by_name, "易維濱 应保留繁体写法")
        if "易維濱" in by_name:
            check(by_name["易維濱"][0]["initials"] == "ywb", f"易維濱 的首字母错误: {by_name['易維濱'][0]['initials']}")

        # 4. 记录数相同时取简体，标识符保留
        check("陳浩賢" not in by_name, "陳浩賢 应被合并进 陈浩贤")
        if "陈浩贤" in by_name:
            check(len(by_name["陈浩贤"][0]["records"]) == 2, "陈浩贤 应合并 2 条记录")
            check(
                by_name["陈浩贤"][0]["initials"] == "ZYX",
                f"陈浩贤 的标识符首字母丢失: {by_name['陈浩贤'][0]['initials']}",
            )
        else:
            check(False, "结果中缺少 陈浩贤")

        # 5. 姓名取最后一次获奖记录的写法（王昆 是最后一次）
        check("王崑" not in by_name, "王崑 应被合并进 王昆（最后一次参赛）")
        if "王昆" in by_name:
            check(len(by_name["王昆"][0]["records"]) == 3, "王昆 应合并 3 条记录")
        else:
            check(False, "结果中缺少 王昆")

        # 6. 跨省份的繁简同名不合并
        check("李思远" in by_name and "李思遠" in by_name, "李思远 / 李思遠 应各自保留")
        if "李思远" in by_name and "李思遠" in by_name:
            check(len(by_name["李思远"][0]["records"]) == 1, "李思远 不应被合并")
            check(len(by_name["李思遠"][0]["records"]) == 1, "李思遠 不应被合并")
        check("李思远 × 李思遠" in stderr and "inf" in stderr, "跨省份的 李思远 × 李思遠 判定距离应为 inf")

        # 7. 相同标识符强制合并
        check("王思遠" not in by_name, "王思遠 应因相同标识符被合并进 王思远")
        if "王思远" in by_name:
            check(len(by_name["王思远"][0]["records"]) == 2, "王思远 应合并 2 条记录")
        else:
            check(False, "结果中缺少 王思远")

        # 8. 粤港澳往返就读：跨省但同一片就读区域，可以合并（显示名取最后一次）
        check("陈小明" not in by_name, "陈小明 应被合并进 陳小明（粤港澳同区）")
        if "陳小明" in by_name:
            check(len(by_name["陳小明"][0]["records"]) == 2, "陳小明 应合并 2 条记录")
        else:
            check(False, "结果中缺少 陳小明")

        # 9. 人数与 --show-name-merges 不影响结果
        check(len(people) == 10, f"合并后应有 10 人，实际 {len(people)} 人: {sorted(by_name)}")
        check(plain_result == verbose_result, "--show-name-merges 不应改变生成的数据")

        if failures:
            print("测试失败：", file=sys.stderr)
            for message in failures:
                print("  -", message, file=sys.stderr)
            return 1
        print("繁简姓名合并测试通过（8 组用例 + 输出一致性）")
        return 0
    finally:
        if keep:
            print(f"临时目录保留在 {work}")
        else:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
