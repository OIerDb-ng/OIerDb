import type { DbContest, DbOIer, DbParseResult, DbRecord, DbSchool, Gender } from '@oierdb/core';
import md5 from 'md5';

import { awardLevels, provinces } from './constants';
import { Counter } from './counter';

interface ParsedRecordData {
  contest: number;
  school: number;
  score?: number;
  rank: number;
  province: string;
  level: string;
  enroll_middle?: {
    is_stay_down: boolean;
    value: number;
  };
}

interface ParsedOIerData {
  rank: number;
  uid: number;
  initials: string;
  name: string;
  lowered_name: string;
  gender: number;
  enroll_middle: number;
  oierdb_score: number;
  ccf_score: number;
  ccf_level: number;
  records: ParsedRecordData[];
}

export function parseResultText(text: string): ParsedOIerData[] {
  const data: ParsedOIerData[] = [];

  text.split('\n').forEach((line) => {
    const fields = line.split(',');
    if (fields.length !== 9) return;

    const [
      uid,
      initials,
      name,
      gender,
      enroll_middle,
      _oierdb_score,
      ccf_score,
      ccf_level,
      compressed_records,
    ] = fields;

    const records: ParsedRecordData[] = compressed_records.split('/').map((record) => {
      const [
        contest,
        ,
        school,
        ,
        score,
        ,
        rank,
        ,
        province_id,
        ,
        award_level_id,
        is_stay_down,
        enroll_middle,
      ] = record.split(/([:;])/);

      return {
        contest: parseInt(contest),
        school: parseInt(school),
        ...(score !== '' && { score: parseFloat(score) }),
        rank: parseInt(rank),
        province: province_id in provinces ? provinces[province_id] : province_id,
        level: award_level_id in awardLevels ? awardLevels[award_level_id] : award_level_id,
        ...(enroll_middle != null && {
          enroll_middle: {
            is_stay_down: is_stay_down === ';',
            value: parseInt(enroll_middle),
          },
        }),
      };
    });

    const oierdb_score = parseFloat(_oierdb_score);
    const oier: ParsedOIerData = {
      rank:
        data.length && oierdb_score === data[data.length - 1].oierdb_score
          ? data[data.length - 1].rank
          : data.length,
      uid: parseInt(uid),
      initials,
      name,
      lowered_name: name.toLowerCase(),
      gender: parseInt(gender),
      enroll_middle: parseInt(enroll_middle),
      oierdb_score,
      ccf_score: parseFloat(ccf_score),
      ccf_level: parseInt(ccf_level),
      records,
    };

    data.push(oier);
  });

  return data;
}

export function processData(parsedOiers: ParsedOIerData[], staticData: any): DbParseResult {
  // 创建比赛对象
  const contests: DbContest[] = staticData.contests.map((contestData: any, id: number) => ({
    id,
    name: contestData.name,
    year: contestData.year,
    type: contestData.type,
    contestant_ids: [],
    fall_semester: contestData.fall_semester,
    full_score: contestData.full_score,
    capacity: contestData.capacity,
    length: contestData.length,
    level_counts: {},
  }));

  // 创建学校对象
  const schools: DbSchool[] = staticData.schools
    .map((schoolData: any[], id: number) => ({
      id,
      name: schoolData[0] || '',
      province: schoolData[1] || '',
      city: schoolData[2] || '',
      score: schoolData[3] || 0,
      rank: 0,
      member_ids: [],
      award_counts: {},
    }))
    .filter((school: DbSchool) => school.name);

  // 按分数排序学校并设置排名
  schools.sort((x, y) => (x.score === y.score ? x.id - y.id : y.score - x.score));
  schools.forEach((school, index) => {
    school.rank =
      index && school.score === schools[index - 1].score ? schools[index - 1].rank : index;
  });

  // 初始化计数器
  const contestLevelCounters = new Map<number, Counter<string>>();
  const schoolAwardCounters = new Map<number, Map<string, Map<number, Counter<string>>>>();

  contests.forEach((contest) => {
    contestLevelCounters.set(contest.id, new Counter<string>());
  });

  schools.forEach((school) => {
    const schoolCounters = new Map<string, Map<number, Counter<string>>>();
    contests.forEach((contest) => {
      if (!schoolCounters.has(contest.type)) {
        schoolCounters.set(contest.type, new Map<number, Counter<string>>());
      }
      if (!schoolCounters.get(contest.type)!.has(contest.year)) {
        schoolCounters.get(contest.type)!.set(contest.year, new Counter<string>());
      }
    });
    schoolAwardCounters.set(school.id, schoolCounters);
  });

  // 处理选手数据并生成记录
  const dbOiers: DbOIer[] = [];
  const records: DbRecord[] = [];

  parsedOiers.forEach((oierData) => {
    const contestIds = new Set<number>();
    const schoolIds = new Set<number>();
    const provinces = new Set<string>();

    oierData.records.forEach((recordData) => {
      const record: DbRecord = {
        contest_id: recordData.contest,
        school_id: recordData.school,
        uid: oierData.uid,
        level: recordData.level,
        score: recordData.score || 0,
        rank: recordData.rank,
        province: recordData.province,
        ...(recordData.enroll_middle && {
          enroll_middle: recordData.enroll_middle,
        }),
      };

      records.push(record);
      contestIds.add(recordData.contest);
      schoolIds.add(recordData.school);
      provinces.add(recordData.province);

      // 更新比赛的参赛者列表和奖项统计
      const contest = contests[recordData.contest];
      if (contest) {
        if (!contest.contestant_ids.includes(oierData.uid)) {
          contest.contestant_ids.push(oierData.uid);
        }
        contestLevelCounters.get(contest.id)!.update(recordData.level);
      }

      // 更新学校的成员列表
      const school = schools.find((s) => s.id === recordData.school);
      if (school) {
        if (!school.member_ids.includes(oierData.uid)) {
          school.member_ids.push(oierData.uid);
        }

        // 更新学校奖项统计
        const contest = contests[recordData.contest];
        if (contest) {
          schoolAwardCounters
            .get(school.id)!
            .get(contest.type)!
            .get(contest.year)!
            .update(recordData.level);
        }
      }
    });

    dbOiers.push({
      uid: oierData.uid,
      name: oierData.name,
      lowered_name: oierData.lowered_name,
      initials: oierData.initials,
      enroll_middle: oierData.enroll_middle,
      gender: oierData.gender as Gender,
      provinces: Array.from(provinces),
      school_ids: Array.from(schoolIds),
      contest_ids: Array.from(contestIds),
      oierdb_score: oierData.oierdb_score,
      ccf_level: oierData.ccf_level,
      ccf_score: oierData.ccf_score,
      rank: oierData.rank,
    } satisfies DbOIer);
  });

  // 设置比赛的奖项统计
  contests.forEach((contest) => {
    const counter = contestLevelCounters.get(contest.id)!;
    contest.level_counts = counter.toRecord();
  });

  // 设置学校的奖项统计
  schools.forEach((school) => {
    const schoolCounters = schoolAwardCounters.get(school.id)!;
    const awardCounts: Record<string, Record<string, Record<string, number>>> = {};

    for (const [contestType, yearMap] of schoolCounters.entries()) {
      awardCounts[contestType] = {};
      for (const [year, levelCounter] of yearMap.entries()) {
        awardCounts[contestType][year.toString()] = levelCounter.toRecord();
      }
    }

    school.award_counts = awardCounts;
  });

  return {
    oiers: dbOiers,
    schools,
    contests,
    records,
    meta: {
      enroll_middle_years: JSON.stringify([...new Set(dbOiers.map((oier) => oier.enroll_middle))]),
    },
  };
}

export function parseOIerDbData(resultText: string, staticJsonText: string): DbParseResult {
  const staticData = JSON.parse(staticJsonText);
  const parsedOiers = parseResultText(resultText);

  const parsed = processData(parsedOiers, staticData);

  parsed.meta['data_version'] = md5(resultText + staticJsonText);

  return parsed;
}
