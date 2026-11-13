from dataclasses import dataclass

import util
from contest import Contest
from record import Record
from school import School

DEFAULT_RAW_FILE = util.DATA_DIR / "raw.txt"
DEFAULT_SCHOOL_FILE = util.DATA_DIR / "school.txt"


def iter_data_lines(path):
    """返回（物理行号、有效行号、内容），行号从 1 开始。"""
    valid_line = 0
    with open(path, encoding="utf-8") as source:
        for phys_line, line in enumerate(source, 1):
            text = line.strip()
            if not text or text.startswith("#"):
                continue
            valid_line += 1
            yield phys_line, valid_line, text


def parse_school_line(line):
    """`,,` 占位行仍占用一个学校 ID。"""
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    fields = line.split(",")
    if len(fields) < 3:
        raise ValueError("格式错误")
    province, city, name, *aliases = fields
    if (province or city or name) and province not in util.provinces:
        raise util.UnknownReferenceError(f"未知的省级行政区：\x1b[32m'{province}'\x1b[0m")
    return School.create(name, province, city, aliases)


def load_schools(path=DEFAULT_SCHOOL_FILE):
    """调用前须清空学校注册表。"""
    rows = []
    for phys, valid, text in iter_data_lines(path):
        try:
            rows.append((phys, valid, text, parse_school_line(text)))
        except ValueError as error:
            raise type(error)(f"{path}:{phys}: {error}") from error
    return rows


@dataclass
class ParsedRecord:
    contest: Contest
    level: str
    name: str
    grade_name: str
    school_name: str
    score: str
    province: str
    gender_name: str
    identifier: str
    school: School
    grades: int
    gender: int

    def to_record(self, oier):
        """创建不参与排名统计的模拟记录。"""
        return Record(
            oier, self.contest, None, 0, self.level,
            self.grades, self.school, self.province, self.gender,
        )


def parse_raw_line(line, *, allow_school_fallback=True, on_school_fallback=None, on_unknown_school=None):
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    fields = line.split(",")
    if len(fields) != 9:
        raise ValueError("格式错误")
    contest_name, level, name, grade_name, school_name, score, province, gender_name, identifier = fields
    if not name:
        raise ValueError("姓名不能为空")
    if province not in util.provinces:
        raise util.UnknownReferenceError(f"未知的省级行政区：\x1b[32m'{province}'\x1b[0m")
    if level not in util.award_levels:
        raise util.UnknownReferenceError(f"未知的奖项名称：\x1b[32m'{level}'\x1b[0m")
    contest = Contest.by_name(contest_name)
    try:
        school = School.resolve(
            school_name, province, allow_fallback=allow_school_fallback,
            on_fallback=on_school_fallback,
        )
    except ValueError:
        if on_unknown_school is not None:
            on_unknown_school(province, school_name)
        raise
    grades = util.get_grades(grade_name)
    gender = {"男": 1, "女": -1}.get(gender_name, 0)
    if not Contest.is_score_valid(score):
        raise ValueError(f"无法识别的分数：\x1b[032m'{score}'\x1b[0m")
    return ParsedRecord(
        contest, level, name, grade_name, school_name, score,
        province, gender_name, identifier, school, grades, gender,
    )
