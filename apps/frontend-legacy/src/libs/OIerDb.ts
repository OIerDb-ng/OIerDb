/* eslint-disable @typescript-eslint/no-explicit-any */
import { openDB } from 'idb';
import { parseInfo, parseStatic, ResultParser } from '@oierdb/parser';
import type { DataInfo, ParsedContest, ParsedOIer, ParsedSchool, ParsedStatic } from '@oierdb/parser';
import { awards, contestTypes, provinces } from '@oierdb/core/constants';
import { trackEvent } from '@/libs/plausible';
import { Counter } from './Counter';
import promiseAny from '@/utils/promiseAny';

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

const infoUrls = [
  'http://localhost:30002',
  // 'https://oier.api.baoshuo.dev',
];

const urls = [
  'http://localhost:30002',
  // 'https://cos-1.cdn.baoshuo.xyz/oier',
  // 'https://oier.api.baoshuo.dev',
];

let __DATA__: OIerDbData = null;

const checkSha512 = (staticSha512: string, resultSha512: string) => {
  try {
    const { staticSha512: localStaticSha152, resultSha512: localResultSha512 }
      = localStorage;

    return (
      staticSha512 === localStaticSha152 && resultSha512 === localResultSha512
    );
  } catch (e) {
    console.error(e);
    return false;
  }
};

const saveDataToIndexedDb = async (
  name: 'parsed-static' | 'parsed-oiers',
  data: any
) => {
  const db = await openDB('OIerDb', 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('main')) {
        db.createObjectStore('main');
      }
    },
  });

  const os = db.transaction('main', 'readwrite').objectStore('main');

  await os.put(data, name);
};

const getDataFromIndexedDb = async (
  name: 'parsed-static' | 'parsed-oiers'
) => {
  const db = await openDB('OIerDb');

  if (!db.objectStoreNames.contains('main')) {
    return false;
  }

  const os = db.transaction('main').objectStore('main');

  return os.get(name);
};

const PROCESS_DATA_BATCH_SIZE = 8192;

const yieldToMainThread = () =>
  new Promise<void>(resolve => setTimeout(resolve));

export const processData = async (
  data: { static: ParsedStatic; oiers: ParsedOIer[] },
  setProgressPercent?: (p: number) => void
) => {
  const add_contestant = function (contest: Contest, record: Record) {
    contest.contestants.push(record);
    contest.level_counts.update(record.level);
  };

  const add_school_record = function (school: School, record: Record) {
    school.records.push(record);
    school.members.push(record.oier);
    school.award_counts[record.contest.type][record.contest.year].update(
      record.level
    );
  };

  // @ts-expect-error ...
  const result: OIerDbData = {};

  result.contests = data.static.contests.map(
    contest => new Contest(contest)
  );

  const originSchools: School[] = [];
  result.schools = data.static.schools.map((school) => {
    const instance = new School(school);
    originSchools[instance.id] = instance;
    return instance;
  });

  result.schools = result.schools
    .filter((school: School) => school.name)
    .sort((x: School, y: School) =>
      x.score == y.score ? x.id - y.id : y.score - x.score
    );
  result.schools.forEach((school, id) => {
    school.rank
      = id && school.score === result.schools[id - 1].score
        ? result.schools[id - 1].rank
        : id;

    result.contests.forEach((contest) => {
      if (!school.award_counts) school.award_counts = {};
      if (!(contest.type in school.award_counts))
        school.award_counts[contest.type] = {};
      if (!(contest.year in school.award_counts[contest.type]))
        school.award_counts[contest.type][contest.year] = new Counter();
    });
  });

  result.oiers = new Array(data.oiers.length);

  for (let i = 0; i < data.oiers.length; i += PROCESS_DATA_BATCH_SIZE) {
    const end = Math.min(i + PROCESS_DATA_BATCH_SIZE, data.oiers.length);

    for (let j = i; j < end; j++) {
      const parsed = data.oiers[j];
      const oier: any = new OIer({
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
        const legacy: any = {
          oier,
          contest: result.contests[record.contestId],
          school: originSchools[record.schoolId],
          level: awards[record.award],
          province: provinces[record.province],
          rank: record.rank,
        };
        if (record.score !== undefined) legacy.score = record.score;
        if (record.enrollMiddle !== undefined) {
          legacy.enroll_middle = {
            is_stay_down: record.isStayDown ?? false,
            value: record.enrollMiddle,
          };
        }
        return legacy;
      });

      oier.provinces = [
        ...new Set(oier.records.map(record => record.province)),
      ];

      oier.records.forEach((record) => {
        add_contestant(record.contest, record);
        add_school_record(record.school, record);
      });

      result.oiers[j] = oier;
    }

    if (data.oiers.length) {
      setProgressPercent?.(
        96 + Math.floor((end / data.oiers.length) * 3)
      );
    }

    if (end < data.oiers.length) await yieldToMainThread();
  }

  result.contests.forEach((contest) => {
    contest.contestants.sort((x, y) => x.rank - y.rank);
  });
  result.schools.forEach((school) => {
    school.members = [...new Set(school.members)];
  });

  result.enroll_middle_years = [
    ...new Set(result.oiers.map(oier => oier.enroll_middle)),
  ];

  setProgressPercent?.(100);

  return result;
};

interface GetDataOptions {
  size: number;
  onProgress?: (receivedBytes: number) => void;
  onChunk?: (text: string) => void;
  onRetry?: () => void;
  trackLabel?: string;
}

const getData = async (
  urls: string | string[],
  options: GetDataOptions
) => {
  const startTime = performance.now();

  if (!Array.isArray(urls)) urls = [urls];

  for (const url of urls) {
    try {
      options.onRetry?.();

      const response = await fetch(url);
      const realUrl = url;

      if (!response.ok) continue;

      let receivedSize = 0;
      let chunkProcessTime = 0;
      const decoder = new TextDecoder();
      const buffered: string[] = [];
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedSize += value.length;

        const text = decoder.decode(value, { stream: true });
        if (options.onChunk) {
          const processStartTime = performance.now();
          options.onChunk(text);
          chunkProcessTime += performance.now() - processStartTime;
        } else {
          buffered.push(text);
        }

        options.onProgress?.(receivedSize);
      }

      const rest = decoder.decode();
      if (rest) {
        if (options.onChunk) {
          const processStartTime = performance.now();
          options.onChunk(rest);
          chunkProcessTime += performance.now() - processStartTime;
        } else {
          buffered.push(rest);
        }
      }

      if (options.trackLabel) {
        const timeUsed = performance.now() - startTime - chunkProcessTime;

        trackEvent('Download: ' + options.trackLabel, {
          props: {
            url: realUrl,
            time:
              timeUsed < 100
                ? Math.floor(timeUsed / 25) * 25
                : Math.floor(timeUsed / 100) * 100,
          },
        });
      }

      return buffered.join('');
    } catch (e) {
      console.error(e);
    }
  }

  throw new Error('Failed to fetch data');
};

export const initDb = async (setProgressPercent?: (p: number) => void) => {
  if (__DATA__) return __DATA__;

  if (!setProgressPercent) setProgressPercent = () => {};

  const [staticInfo, resultInfo]: DataInfo[] = await Promise.all([
    promiseAny(
      infoUrls.map(url => fetch(`${url}/static.info.json?_=${+new Date()}`))
    ).then(res => res.text()).then(parseInfo),
    promiseAny(
      infoUrls.map(url => fetch(`${url}/result.info.json?_=${+new Date()}`))
    ).then(res => res.text()).then(parseInfo),
  ]);

  const {
    sha512: staticSha512,
    size: staticSize,
  } = staticInfo;
  const {
    sha512: resultSha512,
    size: resultSize,
  } = resultInfo;

  setProgressPercent(4);

  if (checkSha512(staticSha512, resultSha512)) {
    setProgressPercent(91);

    const [staticData, oiers] = await Promise.all([
      getDataFromIndexedDb('parsed-static'),
      getDataFromIndexedDb('parsed-oiers'),
    ]);

    setProgressPercent(96);

    if (staticData && oiers) {
      return (__DATA__ = await processData(
        { static: staticData, oiers },
        setProgressPercent
      ));
    }
  }

  const received = {
    static: 0,
    result: 0,
  };
  const totalSize = staticSize + resultSize;
  const reportProgress = () => {
    const receivedSize = Math.min(received.static + received.result, totalSize);
    const progress = totalSize
      ? 4 + Math.floor((receivedSize / totalSize) * 86)
      : 90;

    setProgressPercent(progress);
  };

  const parser = new ResultParser();

  const [staticData, oiers] = await Promise.all([
    getData(
      urls.map(url => `${url}/static.${staticSha512.substring(0, 7)}.json`),
      {
        size: staticSize,
        onProgress: (receivedBytes) => {
          received.static = receivedBytes;
          reportProgress();
        },
        onRetry: () => {
          received.static = 0;
          reportProgress();
        },
        trackLabel: 'static.json',
      }
    ).then(parseStatic),
    getData(
      urls.map(url => `${url}/result.${resultSha512.substring(0, 7)}.txt`),
      {
        size: resultSize,
        onProgress: (receivedBytes) => {
          received.result = receivedBytes;
          reportProgress();
        },
        onChunk: text => parser.push(text),
        onRetry: () => {
          parser.reset();
          received.result = 0;
          reportProgress();
        },
        trackLabel: 'result.txt',
      }
    ).then(() => parser.finish()),
  ]);

  setProgressPercent(91);

  await saveDataToIndexedDb('parsed-static', staticData);

  setProgressPercent(93);

  await saveDataToIndexedDb('parsed-oiers', oiers);

  setProgressPercent(96);

  localStorage.setItem('staticSha512', staticSha512);
  localStorage.setItem('resultSha512', resultSha512);

  __DATA__ = await processData(
    { static: staticData, oiers },
    setProgressPercent
  );

  return __DATA__;
};

// 展示用常量统一来自 @oierdb/core，保持原有的导出名不变
export { awardColors, contestTypes, provinces } from '@oierdb/core/constants';
export { awards as awardLevels } from '@oierdb/core/constants';
export { provincesIdMap as provincesWithId } from '@oierdb/core/constants';

// 性别（与数据解析无关的展示常量）
export const genders = {
  [-1]: '女',
  1: '男',
  0: '不详',
};

export const gendersKeys = [-1, 0, 1];

export const searchableGenderKeys = [-1, 1];
