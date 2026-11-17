#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

"""便捷入口：等价于 `cd generator && python main.py`。

生成器在 generator/ 下（`npm run generate` 同样是先进这个目录），仓库根目录原本没有入口。
这个文件只做转发，删掉它不影响生成器本身。
"""

import os
import runpy
import sys

GENERATOR_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "generator")

if __name__ == "__main__":
    entry = os.path.join(GENERATOR_DIR, "main.py")
    if not os.path.isfile(entry):
        sys.exit(f"找不到生成器入口：{entry}")
    sys.path.insert(0, GENERATOR_DIR)
    sys.argv[0] = entry
    runpy.run_path(entry, run_name="__main__")
