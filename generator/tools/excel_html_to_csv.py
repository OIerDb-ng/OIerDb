#!/usr/bin/env python3
# -*- coding: UTF-8 -*-

"""
将 Excel「发布为网页」向导生成的 HTML 文件（<BODY> 内只有一个 <TABLE>）转换为 CSV。

用法:
    python3 tools/excel_html_to_csv.py <输入.html> [输出.csv]

若省略输出路径，将使用与输入文件同名、后缀改为 .csv 的文件。
"""

import csv
import os
import re
import sys
from html.parser import HTMLParser


class _TableParser(HTMLParser):
    """提取 <table> 中的单元格内容，并展开 rowspan/colspan 合并单元格。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._grid = {}  # (row, col) -> 单元格文本
        self._table_depth = 0
        self._row = -1
        self._col = 0
        self._in_cell = False
        self._cell_chunks = []
        self._skip_depth = 0  # 跳过 <script>/<style> 内容

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip_depth += 1
            return
        if self._skip_depth:
            return

        if tag == "table":
            self._table_depth += 1
        elif tag == "tr" and self._table_depth == 1:
            self._row += 1
            self._col = 0
        elif tag in ("td", "th") and self._table_depth == 1:
            attrs = dict(attrs)
            # 跳过已被上方行 rowspan 占用的列
            while (self._row, self._col) in self._grid:
                self._col += 1

            self._in_cell = True
            self._cell_chunks = []
            self._cell_rowspan = _to_int(attrs.get("rowspan"))
            self._cell_colspan = _to_int(attrs.get("colspan"))
        elif tag == "br" and self._in_cell:
            self._cell_chunks.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._skip_depth = max(0, self._skip_depth - 1)
            return
        if self._skip_depth:
            return

        if tag == "table":
            self._table_depth = max(0, self._table_depth - 1)
        elif tag in ("td", "th") and self._in_cell:
            text = _normalize_cell_text("".join(self._cell_chunks))
            for r in range(self._row, self._row + self._cell_rowspan):
                for c in range(self._col, self._col + self._cell_colspan):
                    self._grid[(r, c)] = text
            self._col += self._cell_colspan
            self._in_cell = False

    def handle_data(self, data):
        if self._in_cell and not self._skip_depth:
            self._cell_chunks.append(data)

    def to_rows(self):
        if not self._grid:
            return []

        max_row = max(r for r, _ in self._grid) + 1
        max_col = max(c for _, c in self._grid) + 1
        rows = [[self._grid.get((r, c), "") for c in range(max_col)] for r in range(max_row)]
        return _trim_trailing_empty(rows)


def _to_int(value, default=1):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_cell_text(raw):
    text = raw.replace("\xa0", " ")  # &nbsp; 常被 Excel 用作空单元格占位
    return "\n".join(line.strip() for line in text.split("\n")).strip()


def _trim_trailing_empty(rows):
    """去掉 Excel 导出时常见的、内容全为空的多余尾部行/列。"""

    while rows and all(cell == "" for cell in rows[-1]):
        rows.pop()

    while rows and rows[0] and all(row[-1] == "" for row in rows):
        for row in rows:
            row.pop()

    return rows


def _detect_encoding(raw):
    match = re.search(rb"charset=[\"']?\s*([\w-]+)", raw[:4096], re.IGNORECASE)
    if not match:
        return "utf-8"

    charset = match.group(1).decode("ascii", "ignore").lower()
    if charset in ("gb2312", "gbk"):
        return "gb18030"  # gb18030 兼容 gb2312/gbk，能解析更多字符
    return charset


def convert(input_path, output_path):
    with open(input_path, "rb") as f:
        raw = f.read()

    encoding = _detect_encoding(raw)
    try:
        html_text = raw.decode(encoding)
    except (LookupError, UnicodeDecodeError):
        html_text = raw.decode("gb18030", errors="replace")

    parser = _TableParser()
    parser.feed(html_text)
    rows = parser.to_rows()

    # 使用 utf-8-sig（带 BOM），方便 Excel 直接打开且不出现中文乱码
    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        csv.writer(f).writerows(rows)

    return len(rows)


def main():
    if len(sys.argv) < 2:
        print("用法: python3 tools/excel_html_to_csv.py <输入.html> [输出.csv]", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) >= 3 else os.path.splitext(input_path)[0] + ".csv"

    try:
        row_count = convert(input_path, output_path)
    except FileNotFoundError:
        print(f"错误: 找不到文件 {input_path}", file=sys.stderr)
        sys.exit(1)

    print(f"已导出 {row_count} 行到 {output_path}")


if __name__ == "__main__":
    main()
