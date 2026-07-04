/* eslint-disable @typescript-eslint/no-explicit-any */
import { openDB } from 'idb';
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
  constructor(id: number, settings: any) {
    this.id = id;
    for (const setting in settings) this[setting] = settings[setting];
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

  n_contestants() {
    return this.capacity ? this.capacity : this.contestants.length;
  }
}

export class School {
  constructor(id: number, settings: any[]) {
    this.id = id;
    this.rank = 0;
    [this.name, this.province, this.city, this.score] = settings;
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
  'https://oier.api.baoshuo.dev',
  'https://oierdb-ng.github.io/OIerDb-data-generator',
];

const urls = [
  'https://cos-1.cdn.baoshuo.xyz/oier',
  'https://oier.api.baoshuo.dev',
  'https://oierdb-ng.github.io/OIerDb-data-generator',
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

const saveDataToIndexedDb = async (name: 'static' | 'oiers', data: any) => {
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

const getDataFromIndexedDb = async (name: 'static' | 'oiers') => {
  const db = await openDB('OIerDb');

  if (!db.objectStoreNames.contains('main')) {
    return false;
  }

  const os = db.transaction('main').objectStore('main');

  return os.get(name);
};

const parseResultLine = (line: string, data: any[]) => {
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
  const records = compressed_records.split('/').map((record) => {
    const [
      contest,,
      school,,
      score,,
      rank,,
      province_id,,
      award_level_id,
      is_stay_down,
      enroll_middle,
    ] = record.split(/([:;])/);
    return {
      contest,
      school,
      ...(score !== '' && { score: parseFloat(score) }),
      rank: parseInt(rank),
      province:
        province_id in provinces ? provinces[province_id] : province_id,
      level:
        award_level_id in awardLevels
          ? awardLevels[award_level_id]
          : award_level_id,
      ...(enroll_middle != null && {
        enroll_middle: {
          is_stay_down: is_stay_down === ';',
          value: parseInt(enroll_middle),
        },
      }),
    };
  });
  const oierdb_score = parseFloat(_oierdb_score);
  const oier = {
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
};

const createResultParser = () => {
  let data: any[] = [];
  let tail = '';

  return {
    push(text: string) {
      const lines = (tail + text).split('\n');
      tail = lines.pop() || '';
      lines.forEach(line => parseResultLine(line, data));
    },
    finish() {
      if (tail) parseResultLine(tail, data);
      tail = '';
      return data;
    },
    reset() {
      data = [];
      tail = '';
    },
  };
};

const PROCESS_DATA_BATCH_SIZE = 8192;

const yieldToMainThread = () =>
  new Promise<void>(resolve => setTimeout(resolve));

const processData = async (
  data: any,
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
    (x, id: number) => new Contest(id, x)
  );

  const originSchools = (result.schools = data.static.schools.map(
    (x: any[], id: number) => new School(id, x)
  ));

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
      const oier: any = new OIer(data.oiers[j]);

      oier.provinces = [
        ...new Set(oier.records.map(record => record.province)),
      ];

      oier.records.forEach((record) => {
        record.contest = result.contests[record.contest];
        record.school = originSchools[record.school];
        record.oier = oier;
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

type DataInfo = {
  sha512: string;
  size: number;
};

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
    ).then(res => res.json()),
    promiseAny(
      infoUrls.map(url => fetch(`${url}/result.info.json?_=${+new Date()}`))
    ).then(res => res.json()),
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
      getDataFromIndexedDb('static'),
      getDataFromIndexedDb('oiers'),
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

  const parser = createResultParser();

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
    ).then(res => JSON.parse(res)),
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

  await saveDataToIndexedDb('static', staticData);

  setProgressPercent(93);

  await saveDataToIndexedDb('oiers', oiers);

  setProgressPercent(96);

  localStorage.setItem('staticSha512', staticSha512);
  localStorage.setItem('resultSha512', resultSha512);

  __DATA__ = await processData(
    { static: staticData, oiers },
    setProgressPercent
  );

  return __DATA__;
};

// 省份列表
export const provincesWithId = {
  AH: '安徽',
  BJ: '北京',
  FJ: '福建',
  GS: '甘肃',
  GD: '广东',
  GX: '广西',
  GZ: '贵州',
  HI: '海南',
  HE: '河北',
  HA: '河南',
  HL: '黑龙江',
  HB: '湖北',
  HN: '湖南',
  JL: '吉林',
  JS: '江苏',
  JX: '江西',
  LN: '辽宁',
  NM: '内蒙古',
  SD: '山东',
  SX: '山西',
  SN: '陕西',
  SH: '上海',
  SC: '四川',
  TJ: '天津',
  XJ: '新疆',
  ZJ: '浙江',
  CQ: '重庆',
  NX: '宁夏',
  YN: '云南',
  MO: '澳门',
  HK: '香港',
  QH: '青海',
  XC: '西藏',
  TW: '台湾',
} as const;

export const provinces = Object.values(
  provincesWithId
) as (typeof provincesWithId)[keyof typeof provincesWithId][];

// 奖项列表及颜色
export const awardColors = {
  '金牌': '#ee961b',
  '银牌': '#939291',
  '铜牌': '#9c593b',
  '一等奖': '#ee961b',
  '二等奖': '#939291',
  '三等奖': '#9c593b',
  '国际金牌': '#ee961b',
  '国际银牌': '#939291',
  '国际铜牌': '#9c593b',
  '前5%': '#ee961b',
  '前15%': '#939291',
  '前25%': '#9c593b',
};

export const awardLevels = Object.keys(awardColors);

export const genders = {
  [-1]: '女',
  1: '男',
  0: '不详',
};

export const gendersKeys = [-1, 0, 1];

export const searchableGenderKeys = [-1, 1];
