/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ParsedContest, ParsedOIer, ParsedSchool, ParsedStatic } from '@oierdb/parser';
import { awards, contestTypes, provinces } from '@oierdb/core/constants';
import { Counter } from './Counter';

export class OIer {
  constructor(settings: any) {
    for (const setting in settings) this[setting] = settings[setting];
  }

  uid: number;
  name: string;
  lowered_name: string;
  ccf_level: number;
  ccf_score: number;
  enroll_middle: number;
  initials: string;
  oierdb_score: number;
  provinces: string[];
  rank: number;
  records: Record[];
  gender: number;
}

export interface Record {
  oier: OIer;
  contest: Contest;
  level: string;
  province: string;
  rank: number;
  school: School;
  score: number;
  enroll_middle?: {
    is_stay_down: boolean;
    value: number;
  };
}

export class Contest {
  constructor(settings: ParsedContest) {
    this.id = settings.id;
    this.name = settings.name;
    this.year = settings.year;
    this.type = contestTypes[settings.type] || '';
    this.fall_semester = settings.fallSemester;
    this.full_score = settings.fullScore;
    this.capacity = settings.capacity;
    this.contestants = [];
    this.level_counts = new Counter();
  }

  id: number;
  name: string;
  year: number;
  type: string;
  contestants: Record[];
  fall_semester: boolean;
  full_score: number;
  capacity: number;
  length: number;
  level_counts: Counter<string>;

  school_year(): number {
    return this.fall_semester ? this.year : this.year - 1;
  }

  n_contestants(): number {
    return this.capacity ? this.capacity : this.contestants.length;
  }
}

export class School {
  constructor(settings: ParsedSchool) {
    this.id = settings.id;
    this.rank = 0;
    this.name = settings.name;
    this.province = provinces[settings.province] || '';
    this.city = settings.city;
    this.score = settings.score;
    this.members = [];
    this.records = [];
    this.award_counts = {};
  }

  id: number;
  name: string;
  province: string;
  score: number;
  city: string;
  rank: number;
  members: OIer[];
  records: Record[];
  award_counts: { [key: string]: { [key: number]: Counter<string> } };
}

export interface OIerDbData {
  oiers: OIer[];
  schools: School[];
  contests: Contest[];
  enroll_middle_years: number[];
}

export class OIerDbDataBuilder {
  private readonly result: OIerDbData;
  private readonly originSchools: School[] = [];
  private readonly enrollMiddleYears = new Set<number>();
  private finished = false;

  constructor(staticData: ParsedStatic) {
    const contests = staticData.contests.map(contest => new Contest(contest));
    const schools = staticData.schools.map((school) => {
      const instance = new School(school);
      this.originSchools[instance.id] = instance;
      return instance;
    });

    const rankedSchools = schools
      .filter(school => school.name)
      .sort((x, y) => x.score == y.score ? x.id - y.id : y.score - x.score);

    rankedSchools.forEach((school, id) => {
      school.rank
        = id && school.score === rankedSchools[id - 1].score
          ? rankedSchools[id - 1].rank
          : id;

      contests.forEach((contest) => {
        if (!(contest.type in school.award_counts)) school.award_counts[contest.type] = {};
        if (!(contest.year in school.award_counts[contest.type])) {
          school.award_counts[contest.type][contest.year] = new Counter();
        }
      });
    });

    this.result = {
      oiers: [],
      schools: rankedSchools,
      contests,
      enroll_middle_years: [],
    };
  }

  push(parsedOIers: readonly ParsedOIer[]): void {
    if (this.finished) throw new Error('Cannot push data after the builder has finished');

    for (const parsed of parsedOIers) {
      const oier: OIer = new OIer({
        uid: parsed.uid,
        name: parsed.name,
        lowered_name: parsed.loweredName,
        initials: parsed.initials,
        gender: parsed.gender,
        enroll_middle: parsed.enrollMiddle,
        oierdb_score: parsed.oierdbScore,
        ccf_score: parsed.ccfScore,
        ccf_level: parsed.ccfLevel,
        rank: parsed.rank,
      });

      oier.records = parsed.records.map((record): Record => {
        const legacy = {
          oier,
          contest: this.result.contests[record.contestId],
          school: this.originSchools[record.schoolId],
          level: awards[record.award],
          province: provinces[record.province],
          rank: record.rank,
        } as Record;
        if (record.score !== undefined) legacy.score = record.score;
        if (record.enrollMiddle !== undefined) {
          legacy.enroll_middle = {
            is_stay_down: record.isStayDown ?? false,
            value: record.enrollMiddle,
          };
        }
        return legacy;
      });

      oier.provinces = [...new Set(oier.records.map(record => record.province))];

      for (const record of oier.records) {
        record.contest.contestants.push(record);
        record.contest.level_counts.update(record.level);
        record.school.records.push(record);
        record.school.members.push(oier);
        record.school.award_counts[record.contest.type][record.contest.year].update(record.level);
      }

      this.enrollMiddleYears.add(oier.enroll_middle);
      this.result.oiers.push(oier);
    }
  }

  finish(): OIerDbData {
    if (this.finished) throw new Error('The builder has already finished');
    this.finished = true;

    for (const contest of this.result.contests) {
      contest.contestants.sort((x, y) => x.rank - y.rank);
    }
    for (const school of this.result.schools) {
      school.members = [...new Set(school.members)];
    }
    this.result.enroll_middle_years = [...this.enrollMiddleYears];

    return this.result;
  }
}
