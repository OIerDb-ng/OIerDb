#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

import sys


def main():
    """
    处理学校数据合并的脚本

    支持的命令：
    - b <name> <origin>: 将新名称 <name> 合并到 <origin>，将新名称作为别名
    - f <name> <origin>: 将新名称 <name> 合并到 <origin>，并将新名称设为正式名称
    - c <province> <city> <name>: 插入学校 <province>,<city>,<name>
    - s <name> <origin>: 将名称 <name> 从 <origin> 拆出，并按照原来的地区设置新建一个学校
    """

    # 读取学校数据
    hash_map = {}
    schools = []

    try:
        with open("../data/school.txt", "r", encoding="utf-8") as f:
            schools = f.read().strip().split("\n")
    except FileNotFoundError:
        print("错误: 找不到文件 ../data/school.txt", file=sys.stderr)
        sys.exit(1)

    # 建立学校名称到索引的映射
    for idx, line in enumerate(schools):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # 学校名称是第三个字段（索引为2）
        school_name = line.split(",")[2]
        hash_map[school_name] = idx

    n = len(schools)

    # 读取合并预览数据
    try:
        with open("dist/merge_preview.txt", "r", encoding="utf-8") as f:
            data = f.read().split("\n")
    except FileNotFoundError:
        print("错误: 找不到文件 dist/merge_preview.txt", file=sys.stderr)
        sys.exit(1)

    # 处理每一行命令
    for line in data:
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        parts = line.split(" ")
        cmd = parts[0]
        data_parts = parts[1:]

        if cmd == "b":
            # b <name> <origin> 表示将新名称 <name> 合并到 <origin>，将新名称作为别名
            if len(data_parts) < 2:
                print(f"警告: 命令格式错误: {line}", file=sys.stderr)
                continue

            name, origin = data_parts[0], data_parts[1]
            idx = hash_map.get(origin)

            if idx is None:
                print(f"错误: 找不到学校 '{origin}' 在命令: {line}", file=sys.stderr)
                continue

            schools[idx] += f",{name}"

        elif cmd == "f":
            # f <name> <origin> 表示将新名称 <name> 合并到 <origin>，并将新名称设为正式名称
            if len(data_parts) < 2:
                print(f"警告: 命令格式错误: {line}", file=sys.stderr)
                continue

            name, origin = data_parts[0], data_parts[1]
            idx = hash_map.get(origin)

            if idx is None:
                print(f"错误: 找不到学校 '{origin}' 在命令: {line}", file=sys.stderr)
                continue

            segments = schools[idx].split(",")
            # 在第3个位置（索引2）插入新名称
            segments.insert(2, name)
            schools[idx] = ",".join(segments)

        elif cmd == "c":
            # c <province> <city> <name> 表示插入学校 <province>,<city>,<name>
            if len(data_parts) < 3:
                print(f"警告: 命令格式错误: {line}", file=sys.stderr)
                continue

            province, city, name = data_parts[0], data_parts[1], data_parts[2]
            new_school = f"{province},{city},{name}"
            schools.append(new_school)
            hash_map[name] = n
            n += 1

        elif cmd == "s":
            # s <name> <origin> 表示将名称 <name> 从 <origin> 拆出，并按照原来的地区设置新建一个学校
            if len(data_parts) < 2:
                print(f"警告: 命令格式错误: {line}", file=sys.stderr)
                continue

            name, origin = data_parts[0], data_parts[1]
            idx = hash_map.get(origin)

            if idx is None:
                print(f"错误: 找不到学校 '{origin}' 在命令: {line}", file=sys.stderr)
                continue

            segments = schools[idx].split(",")

            # 创建新学校，使用原学校的省份和城市
            if len(segments) >= 2:
                new_school = f"{segments[0]},{segments[1]},{name}"
                schools.append(new_school)
                hash_map[name] = n
                n += 1

                # 从原学校中移除该名称
                filtered_segments = [s for s in segments[2:] if s != name]
                schools[idx] = f"{segments[0]},{segments[1]},{','.join(filtered_segments)}"
            else:
                print(f"警告: 学校数据格式错误: {schools[idx]}", file=sys.stderr)
        else:
            print(f"警告: 未知命令 '{cmd}' 在行: {line}", file=sys.stderr)

    # 写入新的学校数据文件
    try:
        with open("../data/school.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(schools) + "\n")
        print("处理完成，结果已保存到 data/school.txt")
    except Exception as e:
        print(f"错误: 无法写入文件 data/school.txt: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
