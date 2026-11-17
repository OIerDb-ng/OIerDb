#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

"""由 OpenCC 的繁简字对照表生成 generator/t2s.json。

用法（可在仓库任意目录执行）：

    python generator/tools/gen_t2s.py <TSCharacters.txt 或其所在目录>

TSCharacters.txt 来自 OpenCC（Apache-2.0）：
https://github.com/BYVoid/OpenCC/blob/master/data/dictionary/TSCharacters.txt
同样可以在 opencc-python-reimplemented 的 wheel 包的
opencc/dictionary/TSCharacters.txt 找到。

对照表中的每行形如「<繁体字><制表符><简体字1> <简体字2> ...」，一个繁体字可能
对应多个简体字；此处取第一个候选（这也是 OpenCC 在不做词组消歧时的默认行为）。
最终只保留逐字的、转换前后不同的映射。

生成结果是一个 JSON 对象，键为繁体字（含常见异体字），值为对应的简体字，
按码位排序，一行一条，便于审阅和比对。生成器只在合并姓名写法时使用它，
因此不放在 data/ 下，避免被打包进下发给前端的 dist/static.json。
"""

import json
import os
import sys

generator_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
source_name = "TSCharacters.txt"
target_path = os.path.join(generator_dir, "t2s.json")


def parse(path):
    """解析 TSCharacters.txt。

    path: 文件路径。

    返回值: 繁体字到简体字的映射。
    """

    table = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            traditional, _, candidates = line.partition("\t")
            if candidates == "":  # 部分版本以空格分隔
                traditional, _, candidates = line.partition(" ")
            if len(traditional) != 1 or candidates == "":
                continue
            simplified = candidates.split()[0]
            if len(simplified) != 1 or simplified == traditional:
                continue
            table[traditional] = simplified
    return table


def main():
    if len(sys.argv) != 2:
        print("用法: python generator/tools/gen_t2s.py <TSCharacters.txt 或其所在目录>", file=sys.stderr)
        return 1
    path = sys.argv[1]
    if os.path.isdir(path):
        path = os.path.join(path, source_name)
    if not os.path.isfile(path):
        print(f"错误: 找不到文件 {path}", file=sys.stderr)
        return 1
    table = parse(path)
    if not table:
        print(f"错误: 未能从 {path} 解析出任何映射", file=sys.stderr)
        return 1
    with open(target_path, "w", newline="\n", encoding="utf-8") as f:
        json.dump(table, f, ensure_ascii=False, indent=0, sort_keys=True)
        print("", file=f)
    print(f"已生成 {target_path}，共 {len(table)} 条映射")
    return 0


if __name__ == "__main__":
    sys.exit(main())
