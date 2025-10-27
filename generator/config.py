#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

"""
Generator 配置文件
集中管理所有目录路径常量
"""

from pathlib import Path

# 确定项目根目录和数据目录
GENERATOR_DIR = Path(__file__).parent
PROJECT_ROOT = GENERATOR_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
DIST_DIR = GENERATOR_DIR / "dist"
