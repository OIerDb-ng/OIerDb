import type { DbParseResult } from '@oierdb/core/interface';

import { MemoryAdapter } from '../adapter';

// Mock data
const mockParseResult: DbParseResult = {
  oiers: [
    {
      uid: 1,
      name: '张三',
      lowered_name: '张三'.toLowerCase(),
      initials: 'zs',
      enroll_middle: 2020,
      gender: 1,
      provinces: ['北京市'],
      school_ids: [1],
      contest_ids: [1],
      oierdb_score: 100,
      ccf_level: 5,
      ccf_score: 500,
      rank: 0,
    },
    {
      uid: 2,
      name: '李四',
      lowered_name: '李四'.toLowerCase(),
      initials: 'ls',
      enroll_middle: 2019,
      gender: 0,
      provinces: ['上海市'],
      school_ids: [2],
      contest_ids: [1],
      oierdb_score: 95,
      ccf_level: 4,
      ccf_score: 450,
      rank: 1,
    },
  ],
  schools: [
    {
      id: 1,
      name: '北京市示例中学',
      province: '北京',
      city: '海淀区',
      score: 100,
      rank: 0,
      member_ids: [1],
      award_counts: {
        NOI: {
          '2023': {
            Au: 1,
          },
        },
      },
    },
    {
      id: 2,
      name: '上海市示例中学',
      province: '上海',
      city: '闵行区',
      score: 95,
      rank: 1,
      member_ids: [2],
      award_counts: {
        NOI: {
          '2023': {
            Ag: 1,
          },
        },
      },
    },
  ],
  contests: [
    {
      id: 1,
      name: 'NOI2023',
      year: 2023,
      type: 'NOI',
      contestant_ids: [1, 2],
      fall_semester: false,
      full_score: 600,
      capacity: 100,
      length: 50,
      level_counts: {
        Au: 1,
        Ag: 1,
      },
    },
  ],
  records: [
    {
      contest_id: 1,
      school_id: 1,
      uid: 1,
      level: 'Au',
      score: 600,
      rank: 1,
      province: '北京',
    },
    {
      contest_id: 1,
      school_id: 2,
      uid: 2,
      level: 'Ag',
      score: 550,
      rank: 2,
      province: '上海',
    },
  ],
  data_version: 'mock-version',
};

describe('MemoryAdapter', () => {
  let adapter: MemoryAdapter;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.loadData(mockParseResult);
  });

  it('should return correct adapter type', () => {
    expect(adapter.getType()).toBe('memory');
  });

  it('checkAvailability', async () => {
    expect(await adapter.checkAvailability('mock-version')).toBe(true);
    expect(await adapter.checkAvailability('wrong-version')).toBe(false);
  });

  it('should get version', async () => {
    const version = await adapter.getVersion();
    expect(version.data_version).toBe('mock-version');
  });

  it('should get existing oier', async () => {
    const response = await adapter.getOIer(1);
    expect(response).not.toBeNull();
    expect(response!.uid).toBe(1);
    expect(response!.oier.name).toBe('张三');
    expect(response!.records.length).toBe(1);
    expect(Object.keys(response!.schools_map).length).toBe(1);
    expect(Object.keys(response!.contests_map).length).toBe(1);
    expect(response!.data_version).toBe('mock-version');
  });

  it('should return null for non-existing oier', async () => {
    const response = await adapter.getOIer(999);
    expect(response).toBeNull();
  });

  it('should list oiers without filters', async () => {
    const response = await adapter.listOIers({ page: 1, perPage: 10 });
    expect(response.oiers.length).toBe(2);
    expect(response.total).toBe(2);
    expect(response.totalPages).toBe(1);
    expect(response.page).toBe(1);
    expect(response.perPage).toBe(10);
  });

  it('should list oiers with name filter', async () => {
    const response = await adapter.listOIers({ name: '张三', page: 1, perPage: 10 });
    expect(response.oiers.length).toBe(1);
    expect(response.oiers[0].name).toBe('张三');
    expect(response.total).toBe(1);
  });

  it('should list oiers with initials filter', async () => {
    const response = await adapter.listOIers({ initials: 'zs', page: 1, perPage: 10 });
    expect(response.oiers.length).toBe(1);
    expect(response.oiers[0].initials).toBe('zs');
  });

  it('should list oiers with enroll_middle filter', async () => {
    const response = await adapter.listOIers({ enroll_middle: 2020, page: 1, perPage: 10 });
    expect(response.oiers.length).toBe(1);
    expect(response.oiers[0].enroll_middle).toBe(2020);
  });

  it('should list oiers with gender filter', async () => {
    const response = await adapter.listOIers({ gender: 1, page: 1, perPage: 10 });
    expect(response.oiers.length).toBe(1);
    expect(response.oiers[0].gender).toBe(1);
  });

  it('should list oiers with gender 0 filter', async () => {
    const response = await adapter.listOIers({ gender: 0, page: 1, perPage: 10 });
    expect(response.oiers.length).toBe(1);
    expect(response.oiers[0].gender).toBe(0);
  });

  it('should list oiers with province filter', async () => {
    const response = await adapter.listOIers({ province: '北京市', page: 1, perPage: 10 });
    expect(response.oiers.length).toBe(1);
    expect(response.oiers[0].provinces).toContain('北京市');
  });

  it('should list oiers with pagination', async () => {
    const response = await adapter.listOIers({ page: 1, perPage: 1 });
    expect(response.oiers.length).toBe(1);
    expect(response.total).toBe(2);
    expect(response.totalPages).toBe(2);
    expect(response.page).toBe(1);
    expect(response.perPage).toBe(1);
  });

  it('should sort oiers by rank', async () => {
    const response = await adapter.listOIers({ page: 1, perPage: 10 });
    expect(response.oiers[0].rank).toBe(0);
    expect(response.oiers[1].rank).toBe(1);
  });

  it('should get existing school', async () => {
    const response = await adapter.getSchool(1);
    expect(response).not.toBeNull();
    expect(response!.id).toBe(1);
    expect(response!.school.name).toBe('北京市示例中学');
    expect(Object.keys(response!.members_map).length).toBe(1);
    expect(Object.keys(response!.contests_map).length).toBe(1);
  });

  it('should return null for non-existing school', async () => {
    const response = await adapter.getSchool(999);
    expect(response).toBeNull();
  });

  it('should list schools without filters', async () => {
    const response = await adapter.listSchools({ page: 1, perPage: 10 });
    expect(response.schools.length).toBe(2);
    expect(response.total).toBe(2);
    expect(response.totalPages).toBe(1);
    expect(response.page).toBe(1);
    expect(response.perPage).toBe(10);
  });

  it('should list schools with name filter (substring match)', async () => {
    const response = await adapter.listSchools({ name: '示例', page: 1, perPage: 10 });
    expect(response.schools.length).toBe(2);
    expect(response.schools[0].name).toContain('示例');
  });

  it('should list schools with name filter (case-insensitive)', async () => {
    const response = await adapter.listSchools({ name: '北京市', page: 1, perPage: 10 });
    expect(response.schools.length).toBe(1);
    expect(response.schools[0].name).toContain('北京市');
  });

  it('should list schools with province filter', async () => {
    const response = await adapter.listSchools({ province: '北京', page: 1, perPage: 10 });
    expect(response.schools.length).toBe(1);
    expect(response.schools[0].province).toBe('北京');
  });

  it('should list schools with province and city filter', async () => {
    const response = await adapter.listSchools({
      province: '上海',
      city: '闵行区',
      page: 1,
      perPage: 10,
    });
    expect(response.schools.length).toBe(1);
    expect(response.schools[0].city).toBe('闵行区');
  });

  it('should sort schools by rank', async () => {
    const response = await adapter.listSchools({ page: 1, perPage: 10 });
    expect(response.schools[0].rank).toBe(0);
    expect(response.schools[1].rank).toBe(1);
  });

  it('should get existing contest', async () => {
    const response = await adapter.getContest(1);
    expect(response).not.toBeNull();
    expect(response!.id).toBe(1);
    expect(response!.contest.name).toBe('NOI2023');
    expect(response!.records.length).toBe(2);
    expect(Object.keys(response!.schools_map).length).toBe(2);
    expect(Object.keys(response!.oiers_map).length).toBe(2);
  });

  it('should return null for non-existing contest', async () => {
    const response = await adapter.getContest(999);
    expect(response).toBeNull();
  });

  it('should paginate contest records', async () => {
    const response = await adapter.getContest(1, 1, 1);
    expect(response).not.toBeNull();
    expect(response!.records.length).toBe(1);
    expect(response!.total).toBe(2);
    expect(response!.totalPages).toBe(2);
    expect(response!.page).toBe(1);
    expect(response!.perPage).toBe(1);
  });

  it('should sort contest records by rank', async () => {
    const response = await adapter.getContest(1);
    expect(response).not.toBeNull();
    expect(response!.records[0].rank).toBe(1);
    expect(response!.records[1].rank).toBe(2);
  });

  it('should list contests without filters', async () => {
    const response = await adapter.listContests({ page: 1, perPage: 10 });
    expect(response.contests.length).toBe(1);
    expect(response.total).toBe(1);
    expect(response.totalPages).toBe(1);
    expect(response.page).toBe(1);
    expect(response.perPage).toBe(10);
  });

  it('should list contests with type filter', async () => {
    const response = await adapter.listContests({ type: 'NOI', page: 1, perPage: 10 });
    expect(response.contests.length).toBe(1);
    expect(response.contests[0].type).toBe('NOI');
  });

  it('should list contests with year filter', async () => {
    const response = await adapter.listContests({ year: 2023, page: 1, perPage: 10 });
    expect(response.contests.length).toBe(1);
    expect(response.contests[0].year).toBe(2023);
  });

  it('should sort contests by id descending', async () => {
    // Add more contests to test sorting
    const dataWithMultipleContests: DbParseResult = {
      ...mockParseResult,
      contests: [
        { ...mockParseResult.contests[0], id: 1 },
        { ...mockParseResult.contests[0], id: 2, name: 'NOI2024', year: 2024 },
        { ...mockParseResult.contests[0], id: 3, name: 'NOI2025', year: 2025 },
      ],
    };
    await adapter.loadData(dataWithMultipleContests);

    const response = await adapter.listContests({ page: 1, perPage: 10 });
    expect(response.contests[0].id).toBe(3);
    expect(response.contests[1].id).toBe(2);
    expect(response.contests[2].id).toBe(1);
  });

  it('should handle empty query results', async () => {
    const response = await adapter.listOIers({ name: '不存在的姓名', page: 1, perPage: 10 });
    expect(response.oiers.length).toBe(0);
    expect(response.total).toBe(0);
  });

  it('should maintain referential integrity for oier records', async () => {
    const response = await adapter.getOIer(1);
    expect(response).not.toBeNull();

    const oier = response!.oier;
    oier.school_ids.forEach((schoolId) => {
      expect(response!.schools_map[schoolId]).toBeDefined();
    });

    response!.records.forEach((record) => {
      expect(response!.contests_map[record.contest_id]).toBeDefined();
    });
  });

  it('should maintain referential integrity for school records', async () => {
    const response = await adapter.getSchool(1);
    expect(response).not.toBeNull();

    const school = response!.school;
    school.member_ids.forEach((uid) => {
      expect(response!.members_map[uid]).toBeDefined();
    });
  });

  it('should maintain referential integrity for contest records', async () => {
    const response = await adapter.getContest(1);
    expect(response).not.toBeNull();

    const contest = response!.contest;
    contest.contestant_ids.forEach((uid) => {
      expect(response!.oiers_map[uid]).toBeDefined();
    });

    response!.records.forEach((record) => {
      expect(response!.schools_map[record.school_id]).toBeDefined();
    });
  });

  describe('Data Loading and Version Management', () => {
    it('should mark data as loaded after successful load', async () => {
      const freshAdapter = new MemoryAdapter();
      await freshAdapter.loadData(mockParseResult);

      const available = await freshAdapter.checkAvailability('mock-version');
      expect(available).toBe(true);
    });

    it('should return false for checkAvailability before data is loaded', async () => {
      const freshAdapter = new MemoryAdapter();
      const available = await freshAdapter.checkAvailability('mock-version');
      expect(available).toBe(false);
    });

    it('should reset and reload data when version changes', async () => {
      const freshAdapter = new MemoryAdapter();
      await freshAdapter.loadData(mockParseResult);

      expect(await freshAdapter.checkAvailability('mock-version')).toBe(true);
      const initialOiers = await freshAdapter.listOIers({ page: 1, perPage: 10 });
      expect(initialOiers.oiers.length).toBe(2);

      const newData = {
        ...mockParseResult,
        oiers: [mockParseResult.oiers[0]],
        data_version: 'new-version',
      };
      await freshAdapter.loadData(newData);

      expect(await freshAdapter.checkAvailability('mock-version')).toBe(false);
      expect(await freshAdapter.checkAvailability('new-version')).toBe(true);
      const newOiers = await freshAdapter.listOIers({ page: 1, perPage: 10 });
      expect(newOiers.oiers.length).toBe(1);
    });

    it('should clear all data when loading new dataset', async () => {
      const freshAdapter = new MemoryAdapter();
      await freshAdapter.loadData(mockParseResult);

      const emptyData: DbParseResult = {
        oiers: [],
        schools: [],
        contests: [],
        records: [],
        data_version: 'empty-version',
      };
      await freshAdapter.loadData(emptyData);

      const oiers = await freshAdapter.listOIers({ page: 1, perPage: 10 });
      const schools = await freshAdapter.listSchools({ page: 1, perPage: 10 });
      const contests = await freshAdapter.listContests({ page: 1, perPage: 10 });

      expect(oiers.oiers.length).toBe(0);
      expect(schools.schools.length).toBe(0);
      expect(contests.contests.length).toBe(0);
    });
  });

  describe('Pagination Edge Cases', () => {
    it('should handle default pagination params', async () => {
      const response = await adapter.listOIers({});
      expect(response.page).toBe(1);
      expect(response.perPage).toBe(20);
    });

    it('should enforce max perPage of 100', async () => {
      const response = await adapter.listOIers({ perPage: 200 });
      expect(response.perPage).toBe(100);
    });

    it('should enforce min perPage of 1', async () => {
      const response = await adapter.listOIers({ perPage: 0 });
      expect(response.perPage).toBe(20); // 0 is falsy, so defaults to 20
    });

    it('should enforce min page of 1', async () => {
      const response = await adapter.listOIers({ page: 0 });
      expect(response.page).toBe(1);
    });

    it('should handle page beyond total pages', async () => {
      const response = await adapter.listOIers({ page: 100, perPage: 10 });
      expect(response.oiers.length).toBe(0);
      expect(response.page).toBe(100);
      expect(response.total).toBe(2);
    });
  });

  describe('Multiple Filters', () => {
    it('should apply multiple filters with AND logic', async () => {
      const response = await adapter.listOIers({
        name: '张三',
        gender: 1,
        enroll_middle: 2020,
        province: '北京市',
      });
      expect(response.oiers.length).toBe(1);
      expect(response.oiers[0].name).toBe('张三');
    });

    it('should return empty when multiple filters dont match', async () => {
      const response = await adapter.listOIers({
        name: '张三',
        gender: 0, // Wrong gender
      });
      expect(response.oiers.length).toBe(0);
    });
  });
});
