import type { DbParseResult } from '@oierdb/core/interface';

import { SQLiteAdapter } from '../adapter';

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
      rank: 1,
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
      rank: 2,
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

describe('SQLiteAdapter', () => {
  let adapter: SQLiteAdapter;

  beforeEach(async () => {
    // Create a new adapter instance before each test
    adapter = new SQLiteAdapter();
    await adapter.initialize();
    await adapter.loadData(mockParseResult);
  });

  afterEach(async () => {
    // Close database connection
    await adapter['db'].close();
  });

  it('should return correct adapter type', () => {
    expect(adapter.getType()).toBe('sqlite');
  });

  it('checkAvailability', async () => {
    expect(await adapter.checkAvailability('mock-version')).toBe(true);
    expect(await adapter.checkAvailability('wrong-version')).toBe(false);
  });

  it('should get existing oier', async () => {
    const response = await adapter.getOIer(1);
    expect(response).not.toBeNull();
    expect(response!.uid).toBe(1);
    expect(response!.oier.name).toBe('张三');
    expect(response!.oier.provinces).toEqual(['北京市']);
    expect(response!.oier.school_ids).toEqual([1]);
    expect(response!.oier.contest_ids).toEqual([1]);
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
    // Verify arrays are reconstructed
    expect(response.oiers[0].provinces).toEqual(['北京市']);
    expect(response.oiers[0].school_ids).toEqual([1]);
  });

  it('should list oiers with name filter', async () => {
    const response = await adapter.listOIers({ name: '张三', page: 1, perPage: 10 });
    expect(response.oiers.length).toBe(1);
    expect(response.oiers[0].name).toBe('张三');
    expect(response.total).toBe(1);
  });

  it('should list oiers with gender filter', async () => {
    const response = await adapter.listOIers({ gender: 1, page: 1, perPage: 10 });
    expect(response.oiers.length).toBe(1);
    expect(response.oiers[0].gender).toBe(1);
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

  it('should get existing school', async () => {
    const response = await adapter.getSchool(1);
    expect(response).not.toBeNull();
    expect(response!.id).toBe(1);
    expect(response!.school.name).toBe('北京市示例中学');
    expect(response!.school.member_ids).toEqual([1]);
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
    // Verify member_ids are reconstructed
    expect(response.schools[0].member_ids).toEqual([1]);
  });

  it('should list schools with province filter', async () => {
    const response = await adapter.listSchools({ province: '北京', page: 1, perPage: 10 });
    expect(response.schools.length).toBe(1);
    expect(response.schools[0].province).toBe('北京');
  });

  it('should get existing contest', async () => {
    const response = await adapter.getContest(1);
    expect(response).not.toBeNull();
    expect(response!.id).toBe(1);
    expect(response!.contest.name).toBe('NOI2023');
    expect(response!.contest.contestant_ids).toEqual([1, 2]);
    expect(response!.records.length).toBe(2);
    expect(Object.keys(response!.schools_map).length).toBe(2);
    expect(Object.keys(response!.oiers_map).length).toBe(2);
  });

  it('should return null for non-existing contest', async () => {
    const response = await adapter.getContest(999);
    expect(response).toBeNull();
  });

  it('should list contests without filters', async () => {
    const response = await adapter.listContests({ page: 1, perPage: 10 });
    expect(response.contests.length).toBe(1);
    expect(response.total).toBe(1);
    expect(response.totalPages).toBe(1);
    expect(response.page).toBe(1);
    expect(response.perPage).toBe(10);
    // Verify contestant_ids are reconstructed
    expect(response.contests[0].contestant_ids).toEqual([1, 2]);
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

  it('should handle empty query results', async () => {
    const response = await adapter.listOIers({ name: '不存在的姓名', page: 1, perPage: 10 });
    expect(response.oiers.length).toBe(0);
    expect(response.total).toBe(0);
  });

  it('should maintain referential integrity for oier records', async () => {
    const response = await adapter.getOIer(1);
    expect(response).not.toBeNull();

    // Check that all referenced school IDs exist in schools_map
    const oier = response!.oier;
    oier.school_ids.forEach((schoolId) => {
      expect(response!.schools_map[schoolId]).toBeDefined();
    });

    // Check that all record contest IDs exist in contests_map
    response!.records.forEach((record) => {
      expect(response!.contests_map[record.contest_id]).toBeDefined();
    });
  });

  it('should maintain referential integrity for school records', async () => {
    const response = await adapter.getSchool(1);
    expect(response).not.toBeNull();

    const school = response!.school;

    // Check that all member IDs exist in members_map
    school.member_ids.forEach((uid) => {
      expect(response!.members_map[uid]).toBeDefined();
    });
  });

  it('should maintain referential integrity for contest records', async () => {
    const response = await adapter.getContest(1);
    expect(response).not.toBeNull();

    const contest = response!.contest;

    // Check that all contestant IDs exist in oiers
    contest.contestant_ids.forEach((uid) => {
      expect(response!.oiers_map[uid]).toBeDefined();
    });

    // Check that all records reference valid schools
    response!.records.forEach((record) => {
      expect(response!.schools_map[record.school_id]).toBeDefined();
    });
  });

  describe('Data Loading', () => {
    it('should mark data as loaded after successful load', async () => {
      const freshAdapter = new SQLiteAdapter();
      await freshAdapter.initialize();
      await freshAdapter.loadData(mockParseResult);

      // Check that loading progress is marked as 'loaded'
      const available = await freshAdapter.checkAvailability('mock-version');
      expect(available).toBe(true);

      await freshAdapter['db'].close();
    });

    it('should return false for checkAvailability when data is incomplete', async () => {
      const freshAdapter = new SQLiteAdapter();
      await freshAdapter.initialize();

      // Manually set loading progress to 'loading' to simulate incomplete load
      await freshAdapter['setMetadata']('data_version', 'mock-version');
      await freshAdapter['setMetadata']('loading_progress', 'loading');

      const available = await freshAdapter.checkAvailability('mock-version');
      expect(available).toBe(false);

      await freshAdapter['db'].close();
    });

    it('should reset and reload data when version changes', async () => {
      const freshAdapter = new SQLiteAdapter();
      await freshAdapter.initialize();
      await freshAdapter.loadData(mockParseResult);

      // Verify initial data
      expect(await freshAdapter.checkAvailability('mock-version')).toBe(true);
      const initialOiers = await freshAdapter.listOIers({ page: 1, perPage: 10 });
      expect(initialOiers.oiers.length).toBe(2);

      // Load data with new version
      const newData: DbParseResult = {
        ...mockParseResult,
        oiers: [mockParseResult.oiers[0]], // Only one oier
        schools: [mockParseResult.schools[0]],
        records: [mockParseResult.records[0]],
        data_version: 'new-version',
      };
      await freshAdapter.loadData(newData);

      // Verify old version is no longer available
      expect(await freshAdapter.checkAvailability('mock-version')).toBe(false);
      // Verify new version is available
      expect(await freshAdapter.checkAvailability('new-version')).toBe(true);
      // Verify data was replaced
      const newOiers = await freshAdapter.listOIers({ page: 1, perPage: 10 });
      expect(newOiers.oiers.length).toBe(1);

      await freshAdapter['db'].close();
    });

    it('should validate data counts after loading', async () => {
      const freshAdapter = new SQLiteAdapter();
      await freshAdapter.initialize();
      await freshAdapter.loadData(mockParseResult);

      // Verify counts match
      const [oiersCount, schoolsCount, recordsCount, contestsCount] = await Promise.all([
        freshAdapter['db'].get<{ count: number }>('SELECT COUNT(*) as count FROM oiers'),
        freshAdapter['db'].get<{ count: number }>('SELECT COUNT(*) as count FROM schools'),
        freshAdapter['db'].get<{ count: number }>('SELECT COUNT(*) as count FROM records'),
        freshAdapter['db'].get<{ count: number }>('SELECT COUNT(*) as count FROM contests'),
      ]);

      expect(oiersCount!.count).toBe(mockParseResult.oiers.length);
      expect(schoolsCount!.count).toBe(mockParseResult.schools.length);
      expect(recordsCount!.count).toBe(mockParseResult.records.length);
      expect(contestsCount!.count).toBe(mockParseResult.contests.length);

      await freshAdapter['db'].close();
    });

    it('should handle large dataset correctly', async () => {
      const freshAdapter = new SQLiteAdapter();
      await freshAdapter.initialize();

      // Create larger dataset
      const largeDataset: DbParseResult = {
        ...mockParseResult,
        oiers: Array.from({ length: 100 }, (_, i) => ({
          ...mockParseResult.oiers[0],
          uid: i + 1,
          name: `测试用户${i + 1}`,
          lowered_name: `测试用户${i + 1}`.toLowerCase(),
          school_ids: [1],
          contest_ids: [1],
        })),
        schools: Array.from({ length: 50 }, (_, i) => ({
          ...mockParseResult.schools[0],
          id: i + 1,
          name: `测试学校${i + 1}`,
          member_ids: [],
        })),
        // Each record must have unique (uid, contest_id) combination
        records: Array.from({ length: 100 }, (_, i) => ({
          contest_id: 1,
          school_id: 1,
          uid: i + 1, // Unique uid for each record
          level: 'Au' as const,
          score: 600 - i,
          rank: i + 1,
          province: '北京',
        })),
      };

      // Load data
      await freshAdapter.loadData(largeDataset);

      // Verify all tables are loaded correctly
      const [oiersCount, schoolsCount, recordsCount, contestsCount] = await Promise.all([
        freshAdapter['db'].get<{ count: number }>('SELECT COUNT(*) as count FROM oiers'),
        freshAdapter['db'].get<{ count: number }>('SELECT COUNT(*) as count FROM schools'),
        freshAdapter['db'].get<{ count: number }>('SELECT COUNT(*) as count FROM records'),
        freshAdapter['db'].get<{ count: number }>('SELECT COUNT(*) as count FROM contests'),
      ]);

      expect(oiersCount!.count).toBe(100);
      expect(schoolsCount!.count).toBe(50);
      expect(recordsCount!.count).toBe(100);
      expect(contestsCount!.count).toBe(1);
      expect(await freshAdapter.checkAvailability('mock-version')).toBe(true);

      await freshAdapter['db'].close();
    });
  });

  describe('Junction Tables', () => {
    it('should correctly populate oier_provinces junction table', async () => {
      const provinces = await adapter['db'].all<{ province: string }>(
        'SELECT province FROM oier_provinces WHERE uid = 1',
      );
      expect(provinces.map((p) => p.province)).toEqual(['北京市']);
    });

    it('should correctly populate oier_schools junction table', async () => {
      const schools = await adapter['db'].all<{ school_id: number }>(
        'SELECT school_id FROM oier_schools WHERE uid = 1',
      );
      expect(schools.map((s) => s.school_id)).toEqual([1]);
    });

    it('should correctly populate oier_contests junction table', async () => {
      const contests = await adapter['db'].all<{ contest_id: number }>(
        'SELECT contest_id FROM oier_contests WHERE uid = 1',
      );
      expect(contests.map((c) => c.contest_id)).toEqual([1]);
    });

    it('should use junction table for province filtering', async () => {
      // Test that province filter works via JOIN
      const response = await adapter.listOIers({ province: '上海市', page: 1, perPage: 10 });
      expect(response.oiers.length).toBe(1);
      expect(response.oiers[0].name).toBe('李四');
    });
  });

  describe('JSON Serialization', () => {
    it('should correctly serialize and deserialize award_counts', async () => {
      const response = await adapter.getSchool(1);
      expect(response).not.toBeNull();
      expect(response!.school.award_counts).toEqual({
        NOI: {
          '2023': {
            Au: 1,
          },
        },
      });
    });

    it('should correctly serialize and deserialize level_counts', async () => {
      const response = await adapter.getContest(1);
      expect(response).not.toBeNull();
      expect(response!.contest.level_counts).toEqual({
        Au: 1,
        Ag: 1,
      });
    });

    it('should correctly handle boolean fields', async () => {
      const response = await adapter.getContest(1);
      expect(response).not.toBeNull();
      expect(response!.contest.fall_semester).toBe(false);
    });
  });

  describe('Async Operations', () => {
    it('should handle concurrent queries correctly', async () => {
      // Run multiple queries concurrently
      const results = await Promise.all([
        adapter.getOIer(1),
        adapter.getOIer(2),
        adapter.getSchool(1),
        adapter.getContest(1),
      ]);

      expect(results[0]).not.toBeNull();
      expect(results[1]).not.toBeNull();
      expect(results[2]).not.toBeNull();
      expect(results[3]).not.toBeNull();
    });

    it('should handle errors in async operations', async () => {
      // Create a new adapter and close it before query
      const errorAdapter = new SQLiteAdapter();
      await errorAdapter.initialize();
      await errorAdapter['db'].close();

      // This should throw an error because database is closed
      await expect(errorAdapter.getOIer(1)).rejects.toThrow();
    });
  });
});
