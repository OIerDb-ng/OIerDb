/**
 * @jest-environment jsdom
 */

import type { DbParseResult } from '@oierdb/core/interface';

import { IDBAdapter } from '../adapter';

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
      contest_ids: [2],
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

describe('IDBAdapter', () => {
  let adapter: IDBAdapter;

  beforeEach(async () => {
    // Create a new adapter instance before each test
    adapter = new IDBAdapter(indexedDB, IDBKeyRange);
    await adapter.loadData(mockParseResult);
  });

  afterEach(async () => {
    // Clear all databases
    if (indexedDB.databases) {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases.map((db) => {
          if (db.name) {
            const deleteReq = indexedDB.deleteDatabase(db.name);
            return new Promise<void>((resolve, reject) => {
              deleteReq.onsuccess = () => resolve();
              deleteReq.onerror = () => reject(deleteReq.error);
              deleteReq.onblocked = () => {
                setTimeout(() => resolve(), 100); // Simple timeout handling
              };
            });
          }
          return Promise.resolve();
        }),
      );
    }
  });

  it('checkAvailability', async () => {
    expect(await adapter.checkAvailability('mock-version')).toBe(true);
    expect(await adapter.checkAvailability('wrong-version')).toBe(false);
  });

  it('should expose the available loaded version', async () => {
    expect(await adapter.getAvailableVersion()).toBe('mock-version');
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

  it('should list oiers with gender filter', async () => {
    const response = await adapter.listOIers({ gender: 1, page: 1, perPage: 10 });
    expect(response.oiers.length).toBe(1);
    expect(response.oiers[0].gender).toBe(1);
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

  it('should handle database connection errors gracefully', async () => {
    // Close the database to simulate connection error
    adapter['db'].close();

    await expect(adapter.getOIer(1)).rejects.toThrow();
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

  describe('Resumable Loading', () => {
    it('should mark data as loaded after successful load', async () => {
      const freshAdapter = new IDBAdapter(indexedDB, IDBKeyRange);
      await freshAdapter.loadData(mockParseResult);

      // Check that loading progress is marked as 'loaded'
      const available = await freshAdapter.checkAvailability('mock-version');
      expect(available).toBe(true);
    });

    it('should return false for checkAvailability when data is incomplete', async () => {
      const freshAdapter = new IDBAdapter(indexedDB, IDBKeyRange);

      // Manually set loading progress to 'loading' to simulate incomplete load
      await freshAdapter['db'].meta.put({ key: 'data_version', value: 'mock-version' });
      await freshAdapter['db'].meta.put({ key: 'loading_progress', value: 'loading' });

      const available = await freshAdapter.checkAvailability('mock-version');
      expect(available).toBe(false);
    });

    it('should reset and reload data when version changes', async () => {
      const freshAdapter = new IDBAdapter(indexedDB, IDBKeyRange);
      await freshAdapter.loadData(mockParseResult);

      // Verify initial data
      expect(await freshAdapter.checkAvailability('mock-version')).toBe(true);
      const initialOiers = await freshAdapter.listOIers({ page: 1, perPage: 10 });
      expect(initialOiers.oiers.length).toBe(2);

      // Load data with new version
      const newData = {
        ...mockParseResult,
        oiers: [mockParseResult.oiers[0]], // Only one oier
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
    });

    it('should resume loading from saved offset', async () => {
      const freshAdapter = new IDBAdapter(indexedDB, IDBKeyRange);

      // Simulate partial load: set metadata indicating partial progress
      await freshAdapter['db'].transaction('readwrite', [freshAdapter['db'].meta], async (tx) => {
        await tx.meta.bulkAdd([
          { key: 'data_version', value: 'mock-version' },
          { key: 'loading_progress', value: 'loading' },
          { key: 'loaded_offset_oiers', value: '1' }, // 1 oier loaded
          { key: 'loaded_offset_schools', value: '0' }, // 0 schools loaded
          { key: 'loaded_offset_records', value: '0' },
          { key: 'loaded_offset_contests', value: '0' },
        ]);
      });

      // Add partial data (1 oier)
      await freshAdapter['db'].oiers.add(mockParseResult.oiers[0]);

      // Resume loading
      await freshAdapter.loadData(mockParseResult);

      // Verify all data is now loaded
      const oiers = await freshAdapter.listOIers({ page: 1, perPage: 10 });
      expect(oiers.oiers.length).toBe(2);
      expect(await freshAdapter.checkAvailability('mock-version')).toBe(true);
    });

    it('should validate data counts after loading', async () => {
      const freshAdapter = new IDBAdapter(indexedDB, IDBKeyRange);
      await freshAdapter.loadData(mockParseResult);

      // Verify counts match
      const [oiersCount, schoolsCount, recordsCount, contestsCount] = await Promise.all([
        freshAdapter['db'].oiers.count(),
        freshAdapter['db'].schools.count(),
        freshAdapter['db'].records.count(),
        freshAdapter['db'].contests.count(),
      ]);

      expect(oiersCount).toBe(mockParseResult.oiers.length);
      expect(schoolsCount).toBe(mockParseResult.schools.length);
      expect(recordsCount).toBe(mockParseResult.records.length);
      expect(contestsCount).toBe(mockParseResult.contests.length);
    });

    it('should handle corrupted offset by resetting', async () => {
      const freshAdapter = new IDBAdapter(indexedDB, IDBKeyRange);

      // Set corrupted offset (greater than expected count)
      await freshAdapter['db'].transaction('readwrite', [freshAdapter['db'].meta], async (tx) => {
        await tx.meta.bulkAdd([
          { key: 'data_version', value: 'mock-version' },
          { key: 'loading_progress', value: 'loading' },
          { key: 'loaded_offset_oiers', value: '999' }, // Corrupted offset
          { key: 'loaded_offset_schools', value: '0' },
          { key: 'loaded_offset_records', value: '0' },
          { key: 'loaded_offset_contests', value: '0' },
        ]);
      });

      // Load data - should detect corruption and reset
      await freshAdapter.loadData(mockParseResult);

      // Verify data is loaded correctly
      const oiers = await freshAdapter.listOIers({ page: 1, perPage: 10 });
      expect(oiers.oiers.length).toBe(2);
      expect(await freshAdapter.checkAvailability('mock-version')).toBe(true);
    });

    it('should handle parallel table loading correctly', async () => {
      const freshAdapter = new IDBAdapter(indexedDB, IDBKeyRange);

      // Create larger dataset to test parallel loading
      const largeDataset = {
        ...mockParseResult,
        oiers: Array.from({ length: 100 }, (_, i) => ({
          ...mockParseResult.oiers[0],
          uid: i + 1,
          name: `测试用户${i + 1}`,
          lowered_name: `测试用户${i + 1}`.toLowerCase(),
        })),
        schools: Array.from({ length: 50 }, (_, i) => ({
          ...mockParseResult.schools[0],
          id: i + 1,
          name: `测试学校${i + 1}`,
        })),
        records: Array.from({ length: 200 }, (_, i) => ({
          contest_id: 1,
          school_id: (i % 50) + 1,
          uid: (i % 100) + 1,
          level: 'Au' as const,
          score: 600,
          rank: i + 1,
          province: '北京',
        })),
      };

      // Load data
      await freshAdapter.loadData(largeDataset);

      // Verify all tables are loaded correctly
      const [oiersCount, schoolsCount, recordsCount, contestsCount] = await Promise.all([
        freshAdapter['db'].oiers.count(),
        freshAdapter['db'].schools.count(),
        freshAdapter['db'].records.count(),
        freshAdapter['db'].contests.count(),
      ]);

      expect(oiersCount).toBe(100);
      expect(schoolsCount).toBe(50);
      expect(recordsCount).toBe(200);
      expect(contestsCount).toBe(1);
      expect(await freshAdapter.checkAvailability('mock-version')).toBe(true);
    });
  });
});
