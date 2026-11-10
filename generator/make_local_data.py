#!/usr/bin/env python3
# -*- coding: UTF-8 -*-
"""把 generator/dist 的产物铺成本地前端可直接读取的目录。

前端（apps/frontend-legacy）按内容寻址拉取数据：
    /data/static.info.json  →  /data/static.<sha512前7位>.json
    /data/result.info.json  →  /data/result.<sha512前7位>.txt
所以这里要按哈希改名复制。


署名与许可：Yanhao Xiang 于 2026-11-10 在原项目 OIerDb（作者 Baoshuo，AGPL-3.0）
基础上二次开发；本文件同样以 GNU AGPL-3.0 发布，完整源码即本仓库。"""

import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")
OUT = os.path.join(HERE, "..", "apps", "frontend-legacy", "public", "data")


def main():
    os.makedirs(OUT, exist_ok=True)

    # 清理上一次的哈希文件，避免堆积
    for name in os.listdir(OUT):
        if name.startswith(("static.", "result.")):
            os.remove(os.path.join(OUT, name))

    for kind, src_name in (("static", "static.json"), ("result", "result.txt")):
        info_path = os.path.join(DIST, f"{kind}.info.json")
        if not os.path.exists(info_path):
            raise SystemExit(f"缺少 {info_path}，请先运行 python main.py --lex-rank")
        info = json.load(open(info_path, encoding="utf-8"))
        sha7 = info["sha512"][:7]
        ext = ".json" if kind == "static" else ".txt"

        shutil.copyfile(info_path, os.path.join(OUT, f"{kind}.info.json"))
        shutil.copyfile(os.path.join(DIST, src_name),
                        os.path.join(OUT, f"{kind}.{sha7}{ext}"))
        print(f"  {kind}: {src_name} → {kind}.{sha7}{ext}"
              f"（{os.path.getsize(os.path.join(OUT, f'{kind}.{sha7}{ext}')) / 1048576:.1f} MB）")

    env_path = os.path.join(HERE, "..", "apps", "frontend-legacy", ".env.local")
    with open(env_path, "w", encoding="utf-8", newline="\n") as f:
        f.write("# 由 generator/make_local_data.py 生成：指向本地数据而非线上 API\n")
        f.write("VITE_LOCAL_DATA=/data\n")
    print(f"  已写入 {os.path.abspath(env_path)}")
    print("\n本地数据就绪。")


if __name__ == "__main__":
    main()
