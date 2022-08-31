/* eslint-disable @typescript-eslint/no-explicit-any */
import { openDB } from 'idb';
import { trackEvent } from '@/libs/plausible';
import { Counter } from './Counter';
import promiseAny from '@/utils/promiseAny';
import pinyin from 'tiny-pinyin';

export class OIer {
  constructor(settings: any) {
    for (const setting in settings) this[setting] = settings[setting];
  }

  uid: number;
  name: string;
  ccf_level: number;
  ccf_score: number;
  enroll_middle: number;
  initials: string;
  pinyin: string;
  oierdb_score: number;
  provinces: string[];
  rank: number;
  records: Record[];
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
  'https://sb.cdn.baoshuo.ren/oier',
  'https://oier.api.baoshuo.dev',
  'https://oierdb-ng.github.io/OIerDb-data-generator',
];

let __DATA__: OIerDbData = null;

const checkSha512 = (staticSha512: string, resultSha512: string) => {
  try {
    const { staticSha512: localStaticSha152, resultSha512: localResultSha512 } =
      localStorage;

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

const textToRaw = (text: string) => {
  const data: any[] = [];

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
    const records = compressed_records.split('/').map((record) => {
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
};

const processData = (data: any) => {
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

  const add_pinyin = (oier) => {
    oier.pinyin = pinyin.convertToPinyin(oier.name, null, true);
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
    school.rank =
      id && school.score === result.schools[id - 1].score
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

  result.oiers = data.oiers.map((oier) => {
    oier = new OIer(oier);

    oier.provinces = [
      ...new Set(oier.records.map((record) => record.province)),
    ];

    oier.records.forEach((record) => {
      record.contest = result.contests[record.contest];
      record.school = originSchools[record.school];
      record.oier = oier;
      add_contestant(record.contest, record);
      add_school_record(record.school, record);
      add_pinyin(oier);
    });

    return oier;
  });

  result.contests.forEach((contest) => {
    contest.contestants.sort((x, y) => x.rank - y.rank);
  });
  result.schools.forEach((school) => {
    school.members = [...new Set(school.members)];
  });

  result.enroll_middle_years = [
    ...new Set(result.oiers.map((oier) => oier.enroll_middle)),
  ];

  return result;
};

const getData = async (
  urls: string | string[],
  size: number,
  setProgressPercent?: (p: number) => void,
  start = 0,
  end = 100,
  trackLabel = ''
) => {
  const startTime = performance.now();

  if (!Array.isArray(urls)) urls = [urls];

  let response: Response = null;
  let realUrl: string = null;
  for (const url of urls) {
    try {
      response = await fetch(url);
      realUrl = url;
      if (response.ok) break;
    } catch (e) {
      console.error(e);
    }
  }

  let receivedSize = 0;
  const chunks: Uint8Array[] = [];

  const reader = response.body.getReader();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedSize += value.length;

    if (setProgressPercent) {
      setProgressPercent(
        Math.ceil(start + Math.min((receivedSize / size) * (end - start), end))
      );
    }
  }

  const chunksAll = new Uint8Array(receivedSize);
  let pos = 0;
  for (const chunk of chunks) {
    chunksAll.set(chunk, pos);
    pos += chunk.length;
  }

  const data = new TextDecoder().decode(chunksAll);

  if (trackLabel) {
    const timeUsed = performance.now() - startTime;

    trackEvent('Download: ' + trackLabel, {
      props: {
        url: realUrl,
        time:
          timeUsed < 100
            ? Math.floor(timeUsed / 25) * 25
            : Math.floor(timeUsed / 100) * 100,
      },
    });
  }

  return data;
};

export const initDb = async (setProgressPercent?: (p: number) => void) => {
  if (__DATA__) return __DATA__;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  if (!setProgressPercent) setProgressPercent = () => {};

  const {
    sha512: staticSha512,
    size: staticSize,
  }: { sha512: string; size: number } = await promiseAny(
    infoUrls.map((url) => fetch(`${url}/static.info.json`))
  ).then((res) => res.json());

  setProgressPercent(4);

  const {
    sha512: resultSha512,
    size: resultSize,
  }: { sha512: string; size: number } = await promiseAny(
    infoUrls.map((url) => fetch(`${url}/result.info.json`))
  ).then((res) => res.json());

  setProgressPercent(8);

  if (checkSha512(staticSha512, resultSha512)) {
    const staticData = await getDataFromIndexedDb('static');
    const oiers = await getDataFromIndexedDb('oiers');

    if (staticData && oiers) {
      return (__DATA__ = processData({ static: staticData, oiers }));
    }
  }

  setProgressPercent(10);

  const staticData = await getData(
    urls.map((url) => `${url}/static.${staticSha512.substring(0, 7)}.json`),
    staticSize,
    setProgressPercent,
    10,
    40,
    'static.json'
  ).then((res) => JSON.parse(res));

  const oiers = await getData(
    urls.map((url) => `${url}/result.${resultSha512.substring(0, 7)}.txt`),
    resultSize,
    setProgressPercent,
    40,
    90,
    'result.txt'
  ).then(textToRaw);

  await saveDataToIndexedDb('static', staticData);

  setProgressPercent(93);

  await saveDataToIndexedDb('oiers', oiers);

  setProgressPercent(96);

  localStorage.setItem('staticSha512', staticSha512);
  localStorage.setItem('resultSha512', resultSha512);

  setProgressPercent(97);

  __DATA__ = processData({ static: staticData, oiers });

  setProgressPercent(100);

  return __DATA__;
};

// 省份列表
export const provinces = [
  '安徽',
  '北京',
  '福建',
  '甘肃',
  '广东',
  '广西',
  '贵州',
  '海南',
  '河北',
  '河南',
  '黑龙江',
  '湖北',
  '湖南',
  '吉林',
  '江苏',
  '江西',
  '辽宁',
  '内蒙古',
  '山东',
  '山西',
  '陕西',
  '上海',
  '四川',
  '天津',
  '新疆',
  '浙江',
  '重庆',
  '宁夏',
  '云南',
  '澳门',
  '香港',
  '青海',
  '西藏',
  '台湾',
] as const;

// 奖项列表及颜色
export const awardColors = {
    金牌: '#ee961b',
    银牌: '#939291',
    铜牌: '#9c593b',
    一等奖: '#ee961b',
    二等奖: '#939291',
    三等奖: '#9c593b',
    国际金牌: '#ee961b',
    国际银牌: '#939291',
    国际铜牌: '#9c593b',
  },
  awardLevels = Object.keys(awardColors);
