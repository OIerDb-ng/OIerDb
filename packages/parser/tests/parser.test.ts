import { Counter } from '../counter';
import { parseOIerDbData } from '../index';
import { parseResultText } from '../parser';

describe('OIerDb Parser', () => {
  const sampleStaticJson = JSON.stringify({
    contests: [
      {
        name: 'NOI2022',
        year: 2022,
        type: 'NOI',
        fall_semester: false,
        full_score: 100,
        capacity: 500,
        length: 100,
      },
      {
        name: 'NOIP2022',
        year: 2022,
        type: 'NOIP',
        fall_semester: true,
        full_score: 100,
        capacity: 1000,
        length: 200,
      },
    ],
    schools: [
      ['北京大学附属中学', '北京', '北京', 98.5],
      ['上海中学', '上海', '上海', 97.2],
      ['清华大学附属中学', '北京', '北京', 96.8],
    ],
  });

  const sampleResultText =
    '1,zs,张三,1,2018,100.0,95.0,3,0:0:80.0:1:1:0/1:1:75.0:2:21:1\n2,ls,李四,-1,2019,95.0,90.0,2,0:0:85.0:1:1:0';

  test('should parse OIerDb data correctly', () => {
    const result = parseOIerDbData(sampleResultText, sampleStaticJson);

    expect(result).toBeDefined();
    expect(result.oiers).toHaveLength(2);
    expect(result.schools).toHaveLength(3);
    expect(result.contests).toHaveLength(2);
    expect(result.records).toHaveLength(3);

    // 检查第一个选手
    const firstOier = result.oiers[0];
    expect(firstOier.uid).toBe(1);
    expect(firstOier.name).toBe('张三');
    expect(firstOier.gender).toBe(1);
    expect(firstOier.enroll_middle).toBe(2018);
    expect(firstOier.contest_ids).toHaveLength(2);
    expect(firstOier.contest_ids).toContain(0);
    expect(firstOier.contest_ids).toContain(1);

    // 检查学校排名
    expect(result.schools[0].rank).toBe(0);
    expect(result.schools[1].rank).toBe(1);
    expect(result.schools[2].rank).toBe(2);
  });

  test('should handle empty data', () => {
    const emptyStaticJson = JSON.stringify({
      contests: [],
      schools: [],
    });
    const emptyResultText = '';

    const result = parseOIerDbData(emptyResultText, emptyStaticJson);

    expect(result.oiers).toHaveLength(0);
    expect(result.schools).toHaveLength(0);
    expect(result.contests).toHaveLength(0);
    expect(result.records).toHaveLength(0);
  });

  test('should handle province mapping', () => {
    const result = parseOIerDbData(sampleResultText, sampleStaticJson);

    // 验证省份映射
    expect(result.oiers[0].provinces).toContain('北京');
    expect(result.oiers[0].provinces).toContain('上海');
  });

  test('should parse enroll_middle in DbRecord', () => {
    const staticJson = JSON.stringify({
      contests: [
        {
          name: 'NOI2022',
          year: 2022,
          type: 'NOI',
          fall_semester: false,
          full_score: 100,
          capacity: 500,
          length: 100,
        },
      ],
      schools: [['测试学校', '北京', '北京', 98.5]],
    });
    const resultText = '1,zs,张三,1,2018,100.0,95.0,3,0:0:80.0:1:1:0:2020';

    const result = parseOIerDbData(resultText, staticJson);

    expect(result.records).toHaveLength(1);
    expect(result.records[0].enroll_middle).toBeDefined();
    expect(result.records[0].enroll_middle?.is_stay_down).toBe(false);
    expect(result.records[0].enroll_middle?.value).toBe(2020);
  });

  test('should maintain correct award_counts structure', () => {
    const result = parseOIerDbData(sampleResultText, sampleStaticJson);

    // 检查学校奖项统计结构：比赛类型 -> 年份 -> 奖项 -> 数量
    const school = result.schools[0];
    expect(school.award_counts).toBeDefined();

    // 应该有 NOI 比赛类型
    expect(school.award_counts.NOI).toBeDefined();
    expect(school.award_counts.NOI['2022']).toBeDefined();

    // 应该有金牌统计
    expect(school.award_counts.NOI['2022']['金牌']).toBeGreaterThan(0);

    // 验证结构的完整性：比赛类型 -> 年份 -> 奖项 -> 数量
    for (const contestType in school.award_counts) {
      for (const year in school.award_counts[contestType]) {
        for (const awardLevel in school.award_counts[contestType][year]) {
          expect(typeof school.award_counts[contestType][year][awardLevel]).toBe('number');
        }
      }
    }
  });
});

describe('Text Parser', () => {
  test('should parse result text correctly', () => {
    const resultText = '1,zs,张三,1,2018,100.0,95.0,3,0:0:80.0:1:1:0';
    const parsed = parseResultText(resultText);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].uid).toBe(1);
    expect(parsed[0].name).toBe('张三');
    expect(parsed[0].records).toHaveLength(1);
    expect(parsed[0].records[0].province).toBe('北京');
  });

  test('should parse enroll_middle field correctly', () => {
    // 测试包含 enroll_middle 的记录
    const resultText = '1,zs,张三,1,2018,100.0,95.0,3,0:0:80.0:1:1:0:2020/1:1:75.0:2:21:1;2021';
    const parsed = parseResultText(resultText);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].records).toHaveLength(2);

    // 第一条记录：有 enroll_middle，不留级
    expect(parsed[0].records[0].enroll_middle).toBeDefined();
    expect(parsed[0].records[0].enroll_middle?.is_stay_down).toBe(false);
    expect(parsed[0].records[0].enroll_middle?.value).toBe(2020);

    // 第二条记录：有 enroll_middle，留级
    expect(parsed[0].records[1].enroll_middle).toBeDefined();
    expect(parsed[0].records[1].enroll_middle?.is_stay_down).toBe(true);
    expect(parsed[0].records[1].enroll_middle?.value).toBe(2021);
  });
});

describe('Counter', () => {
  test('should count correctly', () => {
    const counter = new Counter<string>();

    counter.update('gold');
    counter.update('silver');
    counter.update('gold');

    expect(counter.get('gold')).toBe(2);
    expect(counter.get('silver')).toBe(1);
    expect(counter.get('bronze')).toBe(0);
  });

  test('should convert to record correctly', () => {
    const counter = new Counter<string>();
    counter.update('gold', 2);
    counter.update('silver', 1);

    const record = counter.toRecord();
    expect(record).toEqual({
      gold: 2,
      silver: 1,
    });
  });
});
