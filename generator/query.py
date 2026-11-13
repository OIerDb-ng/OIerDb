from collections import Counter, defaultdict
from contextlib import redirect_stdout
import hashlib
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace

from loader import DEFAULT_RAW_FILE, DEFAULT_SCHOOL_FILE, iter_data_lines, load_schools, parse_raw_line
from oier import OIer
from school import School

REPO_DIR = Path(__file__).resolve().parent.parent


def _git(*args):
    try:
        return subprocess.run(
            ["git", *args],
            cwd=REPO_DIR,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def _source(raw_file, school_file):
    commit = _git("rev-parse", "HEAD") if (REPO_DIR / ".git").exists() else None
    status = (
        _git("status", "--porcelain", "--untracked-files=normal", "--", "data", "generator") if commit else None
    )
    return {
        "kind": "repository",
        "commit": commit,
        "working_tree_dirty": bool(status) if status is not None else None,
        "sha256": {
            "raw": hashlib.sha256(Path(raw_file).read_bytes()).hexdigest(),
            "school": hashlib.sha256(Path(school_file).read_bytes()).hexdigest(),
        },
    }


def _table(school_file):
    School.clear()
    # School.create 的重复名称提示不能混入机器可读的 stdout。
    with redirect_stdout(sys.stderr):
        return load_schools(school_file)


def _records(raw_file):
    for physical, valid, text in iter_data_lines(raw_file):
        fallback = []
        try:
            parsed = parse_raw_line(text, on_school_fallback=lambda *args: fallback.append(True))
        except ValueError as error:
            raise ValueError(f"{raw_file}:{physical}: {error}") from error
        yield physical, valid, parsed, bool(fallback)


def _record_info(physical, valid, parsed, fallback):
    return {
        "physical_line": physical,
        "valid_line": valid,
        "name": parsed.name,
        "identifier": parsed.identifier,
        "contest": parsed.contest.name,
        "year": parsed.contest.year,
        "grade": parsed.grade_name,
        "province": parsed.province,
        "award": parsed.level,
        "score": parsed.score,
        "raw": ",".join(
            [
                parsed.contest.name,
                parsed.level,
                parsed.name,
                parsed.grade_name,
                parsed.school_name,
                parsed.score,
                parsed.province,
                parsed.gender_name,
                parsed.identifier,
            ]
        ),
        "original_school_name": parsed.school_name,
        "school_id": parsed.school.id,
        "school_name": parsed.school.name,
        "school_province": parsed.school.province,
        "school_resolution": "global_fallback" if fallback else "province",
    }


def lookup_oiers(uids=(), names=(), *, raw_file=DEFAULT_RAW_FILE, school_file=DEFAULT_SCHOOL_FILE, limit=100):
    """按 UID 或完整姓名查询，保留全部同名分组。"""
    uids, names = list(dict.fromkeys(uids)), list(dict.fromkeys(names))
    if any(type(uid) is not int or uid < 1 for uid in uids) or limit < 0:
        raise ValueError("UID 必须为正整数，limit 必须非负")
    _table(school_file)
    source = _source(raw_file, school_file)
    target_names = set(names)
    requested_uids = set(uids)
    seed_names = {}
    # 先由 UID 定位姓名，再用该姓名的全部记录分组。
    if requested_uids:
        for _, valid, parsed, _ in _records(raw_file):
            if valid in requested_uids:
                seed_names[valid] = parsed.name
                target_names.add(parsed.name)
    by_name = defaultdict(list)
    for physical, valid, parsed, fallback in _records(raw_file):
        if parsed.name in target_names:
            by_name[parsed.name].append((physical, valid, parsed, fallback))
    profiles = {}
    for name, rows in by_name.items():
        originals = {}
        records = []
        for row in rows:
            parsed = row[2]
            record = parsed.to_record(SimpleNamespace(name=name, identifier=parsed.identifier))
            originals[id(record)] = row
            records.append(record)
        for group in OIer.group_records(records):
            group_rows = sorted((originals[id(record)] for record in group), key=lambda row: row[1])
            uid = min(row[1] for row in group_rows)
            profiles[uid] = {
                "uid": uid,
                "name": name,
                "provinces": sorted({row[2].province for row in group_rows}),
                "schools": sorted({row[2].school_name for row in group_rows}),
                "estimated_enrollment_year": OIer.enrollment_year(group),
                "record_count": len(group_rows),
                "records_truncated": len(group_rows) > limit,
                "records": [_record_info(*row) for row in group_rows[:limit]],
            }
    requests = []
    selected = set()
    for uid in uids:
        found = [uid] if uid in profiles else []
        requests.append(
            {
                "kind": "uid",
                "value": uid,
                "uids": found,
                "status": "matched" if found else ("not_current_uid" if uid in seed_names else "not_found"),
            }
        )
        selected.update(found)
    for name in names:
        found = sorted(uid for uid, profile in profiles.items() if profile["name"] == name)
        requests.append(
            {
                "kind": "name",
                "value": name,
                "uids": found,
                "status": "not_found" if not found else ("multiple_matches" if len(found) > 1 else "matched"),
            }
        )
        selected.update(found)
    return {"source": source, "requests": requests, "matches": [profiles[uid] for uid in sorted(selected)]}


def lookup_schools(
    ids=(), names=(), province=None, *, raw_file=DEFAULT_RAW_FILE, school_file=DEFAULT_SCHOOL_FILE, limit=20
):
    """按学校 ID、正式名或别名精确查询。"""
    ids, names = list(dict.fromkeys(ids)), list(dict.fromkeys(names))
    if any(type(sid) is not int or sid < 0 for sid in ids) or limit < 0:
        raise ValueError("学校 ID 和 limit 必须为非负整数")
    rows = _table(school_file)
    source = _source(raw_file, school_file)
    profiles = {}
    for physical, valid, _, school in rows:
        profiles[school.id] = {
            "id": school.id,
            "name": school.name,
            "province": school.province,
            "city": school.city,
            "aliases": school.aliases,
            "placeholder": not school.name,
            "physical_line": physical,
            "valid_line": valid,
            "record_count": 0,
            "records": [],
            "records_truncated": False,
        }
    requests, selected = [], set()
    for sid in ids:
        found = [sid] if sid in profiles else []
        status = "not_found" if not found else ("placeholder" if profiles[sid]["placeholder"] else "matched")
        requests.append({"kind": "id", "value": sid, "status": status, "ids": found})
        selected.update(found)
    for name in names:
        found = [
            sid
            for sid, profile in profiles.items()
            if not profile["placeholder"]
            and (province is None or profile["province"] == province)
            and name in [profile["name"], *profile["aliases"]]
        ]
        requests.append(
            {
                "kind": "name",
                "value": name,
                "ids": found,
                "status": "not_found" if not found else ("multiple_matches" if len(found) > 1 else "matched"),
            }
        )
        selected.update(found)
    counts = defaultdict(Counter)
    members = defaultdict(set)
    for physical, valid, parsed, fallback in _records(raw_file):
        if parsed.school.id not in selected:
            continue
        profile = profiles[parsed.school.id]
        profile["record_count"] += 1
        counts[parsed.school.id][(parsed.school_name, parsed.province)] += 1
        members[parsed.school.id].add(parsed.name)
        if len(profile["records"]) < limit:
            profile["records"].append(_record_info(physical, valid, parsed, fallback))
    for sid in selected:
        profile = profiles[sid]
        profile["records_truncated"] = profile["record_count"] > limit
        profile["member_count"] = len(members[sid])
        profile["record_counts"] = [
            {"original_school_name": name, "province": prov, "count": count}
            for (name, prov), count in sorted(counts[sid].items())
        ]
    return {"source": source, "requests": requests, "matches": [profiles[sid] for sid in sorted(selected)]}


def search_schools(
    keyword, province=None, *, raw_file=DEFAULT_RAW_FILE, school_file=DEFAULT_SCHOOL_FILE, limit=20
):
    """按校名或别名片段搜索。"""
    if not keyword.strip() or not 1 <= limit <= 100:
        raise ValueError("请输入学校名称片段，limit 必须在 1 到 100 之间")
    rows = _table(school_file)
    matches = [
        {
            "id": school.id,
            "name": school.name,
            "province": school.province,
            "city": school.city,
            "aliases": school.aliases,
        }
        for _, _, _, school in rows
        if school.name
        and (province is None or school.province == province)
        and any(keyword in name for name in [school.name, *school.aliases])
    ]
    return {
        "source": _source(raw_file, school_file),
        "matches": matches[:limit],
        "match_count": len(matches),
        "matches_truncated": len(matches) > limit,
    }
