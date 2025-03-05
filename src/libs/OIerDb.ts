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

export class PinyinQueryer extends Map<string, string[]> {
  //也许需要些什么...?
  constructor(entries?: any) {
    super(entries);
  }
  getFull(char: string) {
    return this.get(char) || [];
  }
  getInitial(char: string) {
    //首字母 不去重！！(可提升效率)
    return (this.get(char) || []).map((p) => p[0]);
  }
}

export interface OIerDbData {
  oiers: OIer[];
  schools: School[];
  contests: Contest[];
  pinyins: PinyinQueryer;
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

const checkSha512 = (
  staticSha512: string,
  resultSha512: string,
  pinyinSha512: string
) => {
  try {
    const {
      staticSha512: localStaticSha152,
      resultSha512: localResultSha512,
      pinyinSha512: localPinyinSha512,
    } = localStorage;

    return (
      staticSha512 === localStaticSha152 &&
      resultSha512 === localResultSha512 &&
      pinyinSha512 === localPinyinSha512
    );
  } catch (e) {
    console.error(e);
    return false;
  }
};

const saveDataToIndexedDb = async (
  name: 'static' | 'oiers' | 'pinyins',
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

const getDataFromIndexedDb = async (name: 'static' | 'oiers' | 'pinyins') => {
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
};
const textToPinyinMap = (text: string) => {
  const textToPinyinMap = new Map<string, string[]>();
  text.split('\n').forEach((line) => {
    const list = line.split(',');
    textToPinyinMap.set(list[0], list.slice(1));
  });
  return textToPinyinMap;
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

  result.pinyins = new PinyinQueryer(data.pinyins);

  return result;
};

const getData = async (
  urls: string | string[],
  size: number,
  setProgress?: (p: number) => void,
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

    if (setProgress) {
      setProgress(receivedSize / size);
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
const progressManager = (
  begin: number,
  end: number,
  setProgressPercent: (p: number) => void
) => {
  let total = 0;
  const childCount: number[] = [];
  const update = () => {
    setProgressPercent(
      begin +
        Math.ceil(
          (end - begin) * (childCount.reduce((s, v) => s + v, 0) / total)
        )
    );
  };
  return (size: number) => {
    total += size;
    childCount.push(0);
    const i = childCount.length - 1;
    return (p: number) => {
      childCount[i] = p * size;
      update();
    };
  };
};

export const initDb = async (setProgressPercent?: (p: number) => void) => {
  if (__DATA__) return __DATA__;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  if (!setProgressPercent) setProgressPercent = () => {};

  const {
    sha512: staticSha512,
    size: staticSize,
  }: { sha512: string; size: number } = await promiseAny(
    infoUrls.map((url) => fetch(`${url}/static.info.json?_=${+new Date()}`))
  ).then((res) => res.json());

  setProgressPercent(4);

  const {
    sha512: resultSha512,
    size: resultSize,
  }: { sha512: string; size: number } = await promiseAny(
    infoUrls.map((url) => fetch(`${url}/result.info.json?_=${+new Date()}`))
  ).then((res) => res.json());

  setProgressPercent(8);

  const {
    sha512: pinyinSha512,
    size: pinyinSize,
  }: { sha512: string; size: number } = await promiseAny(
    infoUrls.map((url) => fetch(`${url}/pinyin.info.json?_=${+new Date()}`))
  ).then((res) => res.json());

  if (checkSha512(staticSha512, resultSha512, pinyinSha512)) {
    setProgressPercent(91);

    const [staticData, oiers, pinyins] = await Promise.all([
      await getDataFromIndexedDb('static'),
      await getDataFromIndexedDb('oiers'),
      await getDataFromIndexedDb('pinyins'),
    ]);

    setProgressPercent(96);

    if (staticData && oiers && pinyins) {
      return (__DATA__ = processData({
        static: staticData,
        oiers,
        pinyins: pinyins,
      }));
    }
  }

  setProgressPercent(10);
  const setDownlodProgressFunc = progressManager(10, 90, setProgressPercent);
  const [staticData, oiers, pinyins] = await Promise.all([
    getData(
      urls.map((url) => `${url}/static.${staticSha512.substring(0, 7)}.json`),
      staticSize,
      setDownlodProgressFunc(staticSize),
      'static.json'
    ).then((res) => JSON.parse(res)),
    getData(
      urls.map((url) => `${url}/result.${resultSha512.substring(0, 7)}.txt`),
      resultSize,
      setDownlodProgressFunc(resultSize),
      'result.txt'
    ).then(textToRaw),
    getData(
      urls.map((url) => `${url}/pinyin.${pinyinSha512.substring(0, 7)}.txt`),
      pinyinSize,
      setDownlodProgressFunc(pinyinSize),
      'pinyin.txt'
    ).then(textToPinyinMap),
  ]);

  setProgressPercent(91);

  await saveDataToIndexedDb('static', staticData);

  setProgressPercent(93);

  await saveDataToIndexedDb('oiers', oiers);

  setProgressPercent(95);

  await saveDataToIndexedDb('pinyins', pinyins);

  setProgressPercent(96);

  localStorage.setItem('staticSha512', staticSha512);
  localStorage.setItem('resultSha512', resultSha512);
  localStorage.setItem('pinyinSha512', pinyinSha512);

  setProgressPercent(97);

  __DATA__ = processData({ static: staticData, oiers, pinyins: pinyins });

  setProgressPercent(100);

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
  金牌: '#ee961b',
  银牌: '#939291',
  铜牌: '#9c593b',
  一等奖: '#ee961b',
  二等奖: '#939291',
  三等奖: '#9c593b',
  国际金牌: '#ee961b',
  国际银牌: '#939291',
  国际铜牌: '#9c593b',
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
