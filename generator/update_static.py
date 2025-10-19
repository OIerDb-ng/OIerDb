#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

import hashlib
import json
from pathlib import Path


def main():
    """将静态 JSON 文件合并并生成相应的信息文件。"""

    output = {}

    static_dir = Path("../data")
    if static_dir.exists():
        for json_file in static_dir.glob("*.json"):
            name = json_file.stem
            with open(json_file, "r", encoding="utf-8") as f:
                output[name] = json.load(f)

    # 读取 dist/school.json 文件
    school_file = Path("dist/school.json")
    if school_file.exists():
        with open(school_file, "r", encoding="utf-8") as f:
            output["schools"] = json.load(f)

    output_str = json.dumps(output, ensure_ascii=False, separators=(",", ":"))

    dist_dir = Path("dist")
    dist_dir.mkdir(exist_ok=True)

    with open(dist_dir / "static.json", "w", encoding="utf-8") as f:
        f.write(output_str)

    output_bytes = output_str.encode("utf-8")
    sha512_hash = hashlib.sha512(output_bytes).hexdigest()
    file_size = len(output_bytes)

    info_data = {"sha512": sha512_hash, "size": file_size}

    with open(dist_dir / "static.info.json", "w", encoding="utf-8") as f:
        json.dump(info_data, f, ensure_ascii=False, separators=(",", ":"))

    if school_file.exists():
        school_file.unlink()


if __name__ == "__main__":
    main()
