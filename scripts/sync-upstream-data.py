#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""同步上游 OIerDb 的 data/ 目录（原始获奖数据、学校表、赛程表等）。

本仓库的定位是「数据完全沿用上游，只改排名」。因此重新抓取上游新增的比赛时，
优先用本脚本把 data/ 对齐到上游最新版本，再用 --lex-rank 重新生成。

用法：
    python scripts/sync-upstream-data.py            # 有差异就备份并覆盖
    python scripts/sync-upstream-data.py --check    # 只检查，不写文件
    python scripts/sync-upstream-data.py --data-dir D:\\path\\to\\data

被覆盖的旧文件会备份到 data/.backup/<时间戳>/ 下。

署名：Yanhao Xiang 于 2026-11-10 二次开发，依原项目 AGPL-3.0 发布。
"""

import argparse
import hashlib
import json
import os
import shutil
import sys
import time
import urllib.request

REPO = "OIerDb-ng/OIerDb"
BRANCH = "master"
BASE = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/data"

# 只同步这些文件；data/ranking.json 是本仓库新增的，不在同步范围内
FILES = [
    "raw.txt",
    "school.txt",
    "contests.json",
    "grades.json",
    "scoring.json",
    "surnames.json",
    "name_exceptions.json",
]

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DATA = os.path.join(HERE, "..", "data")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(url: str, timeout=180) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "oierdb-lexrank-sync"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def validate_raw(path: str) -> str:
    """粗校验 raw.txt：行数与 9 字段格式。"""

    lines = 0
    bad = []
    with open(path, encoding="utf-8") as f:
        for no, line in enumerate(f, 1):
            s = line.rstrip("\n")
            if not s or s.startswith("#"):
                continue
            lines += 1
            if len(s.split(",")) != 9 and len(bad) < 5:
                bad.append(no)
    msg = f"{lines:,} 条有效记录"
    if bad:
        msg += f"；⚠ 字段数异常的行：{bad}"
    return msg


def main():
    ap = argparse.ArgumentParser(description="同步上游 OIerDb 的 data/ 目录")
    ap.add_argument("--data-dir", default=DEFAULT_DATA, help="本地 data 目录")
    ap.add_argument("--base", default=BASE, help="上游 data 文件的 URL 前缀")
    ap.add_argument("--check", action="store_true", help="只检查差异，不写文件")
    args = ap.parse_args()

    data_dir = os.path.abspath(args.data_dir)
    if not os.path.isdir(data_dir):
        sys.exit(f"找不到 data 目录：{data_dir}")

    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup_dir = os.path.join(data_dir, ".backup", stamp)

    print(f"上游：{REPO}@{BRANCH}")
    print(f"本地：{data_dir}")
    print(f"{'文件':22s} {'状态':10s} {'大小':>10s}  sha256(前12位)")
    print("-" * 78)

    changed, failed = [], []
    for name in FILES:
        url = f"{args.base}/{name}"
        try:
            remote = fetch(url)
        except Exception as exc:  # noqa: BLE001
            failed.append(name)
            print(f"{name:22s} {'下载失败':10s} {'':>10s}  {exc}")
            continue

        local_path = os.path.join(data_dir, name)
        local = open(local_path, "rb").read() if os.path.exists(local_path) else b""
        remote_hash = sha256(remote)
        same = sha256(local) == remote_hash
        status = "一致" if same else ("缺失" if not local else "有更新")
        print(f"{name:22s} {status:10s} {len(remote):>10,}  {remote_hash[:12]}")

        if same or args.check:
            continue

        changed.append(name)
        if not os.path.isdir(backup_dir):
            os.makedirs(backup_dir, exist_ok=True)
        if local:
            shutil.copyfile(local_path, os.path.join(backup_dir, name))
        with open(local_path, "wb") as f:
            f.write(remote)

    print("-" * 78)
    if failed:
        print(f"⚠ 以下文件下载失败，已保持本地版本：{', '.join(failed)}")

    if not changed:
        print("本地数据已是最新。" if not failed else "没有可更新的文件。")
        return

    if args.check:
        print(f"检测到 {len(changed)} 个文件可更新：{', '.join(changed)}")
        print("（当前是 --check 模式，未写入）")
        return

    print(f"已更新 {len(changed)} 个文件，旧文件备份在：{backup_dir}")

    raw = os.path.join(data_dir, "raw.txt")
    if os.path.exists(raw):
        print(f"raw.txt 校验：{validate_raw(raw)}")
    for name in ("contests.json", "school.txt"):
        path = os.path.join(data_dir, name)
        if not os.path.exists(path):
            continue
        try:
            if name.endswith(".json"):
                json.load(open(path, encoding="utf-8"))
                print(f"{name} 校验：JSON 可解析")
            else:
                n = sum(1 for line in open(path, encoding="utf-8")
                        if line.strip() and not line.startswith("#"))
                print(f"{name} 校验：{n:,} 行")
        except Exception as exc:  # noqa: BLE001
            print(f"⚠ {name} 校验失败：{exc}")

    print("\n下一步：")
    print("  cd generator && python main.py --lex-rank     # 重新生成")
    print("  或直接运行 start-local.cmd --refresh          # 同步+生成+预览")


if __name__ == "__main__":
    main()
