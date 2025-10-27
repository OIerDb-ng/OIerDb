#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

import hashlib
import json
import os
from config import DATA_DIR, DIST_DIR


def main():
    """将静态 JSON 文件合并并生成相应的信息文件。"""

    output = {}

    if DATA_DIR.exists():
        for json_file in DATA_DIR.glob("*.json"):
            name = json_file.stem
            with open(json_file, "r", encoding="utf-8") as f:
                output[name] = json.load(f)

    # 读取 dist/school.json 文件
    school_file = DIST_DIR / "school.json"
    if school_file.exists():
        with open(school_file, "r", encoding="utf-8") as f:
            output["schools"] = json.load(f)

    output_str = json.dumps(output, ensure_ascii=False, separators=(",", ":"))

    DIST_DIR.mkdir(exist_ok=True)

    with open(DIST_DIR / "static.json", "w", encoding="utf-8") as f:
        f.write(output_str)

    output_bytes = output_str.encode("utf-8")
    sha512_hash = hashlib.sha512(output_bytes).hexdigest()
    file_size = len(output_bytes)

    info_data = {"sha512": sha512_hash, "size": file_size}

    with open(DIST_DIR / "static.info.json", "w", encoding="utf-8") as f:
        json.dump(info_data, f, ensure_ascii=False, separators=(",", ":"))

    # 创建符号链接
    sha512_short = sha512_hash[:7]
    
    # 创建符号链接 static.{sha512前7位}.json -> static.json
    static_versioned_link = DIST_DIR / f"static.{sha512_short}.json"
    if static_versioned_link.exists() or static_versioned_link.is_symlink():
        static_versioned_link.unlink()
    os.symlink("static.json", static_versioned_link)
    
    # 创建符号链接 static.sha512.json -> static.info.json
    static_sha512_link = DIST_DIR / "static.sha512.json"
    if static_sha512_link.exists() or static_sha512_link.is_symlink():
        static_sha512_link.unlink()
    os.symlink("static.info.json", static_sha512_link)

    if school_file.exists():
        school_file.unlink()


if __name__ == "__main__":
    main()
