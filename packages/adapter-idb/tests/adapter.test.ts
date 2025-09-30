/**
 * @jest-environment jsdom
 */

import type { DbParseResult } from '@oierdb/core/interface';

import { IDBAdapter } from '../adapter';
import { DB_NAME, DB_VERSION } from '../constants';

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
      record_ids: [1],
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
      record_ids: [2],
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
      record_ids: [1],
      award_counts: {
        Au: {
          2023: 1,
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
      record_ids: [2],
      award_counts: {
        Ag: {
          2023: 1,
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
  metadata: [
    { key: 'data_version', value: 'mock-version' },
    { key: 'generated_at', value: new Date().toISOString() },
  ],
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
        })
      );
    }
  });

  it('should throw error for checkAvailability', async () => {
    await expect(adapter.checkAvailability()).rejects.toThrow('Method not implemented');
  });

  it('should get existing oier', async () => {
    const response = await adapter.getOIer(1);
    expect(response).not.toBeNull();
    expect(response!.uid).toBe(1);
    expect(response!.oier.name).toBe('张三');
    expect(response!.records.length).toBe(1);
    expect(Object.keys(response!.schools_map).length).toBe(1);
    expect(Object.keys(response!.contests_map).length).toBe(1);
  });

  it('should return null for non-existing oier', async () => {
    const response = await adapter.getOIer(999);
    expect(response).toBeNull();
  });

  it('should list oiers without filters', async () => {
    const response = await adapter.listOIers(null, null, null, null, null, 1, 10);
    expect(response.oiers.length).toBe(2);
    expect(response.total).toBe(2);
    expect(response.totalPages).toBe(1);
    expect(response.page).toBe(1);
    expect(response.perPage).toBe(10);
  });

  it('should list oiers with name filter', async () => {
    const response = await adapter.listOIers('张三', null, null, null, null, 1, 10);
    expect(response.oiers.length).toBe(1);
    expect(response.oiers[0].name).toBe('张三');
    expect(response.total).toBe(1);
  });

  it('should list oiers with gender filter', async () => {
    const response = await adapter.listOIers(null, null, null, 1, null, 1, 10);
    expect(response.oiers.length).toBe(1);
    expect(response.oiers[0].gender).toBe(1);
  });

  it('should list oiers with pagination', async () => {
    const response = await adapter.listOIers(null, null, null, null, null, 1, 1);
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
    const response = await adapter.listSchools(null, null, null, 1, 10);
    expect(response.schools.length).toBe(2);
    expect(response.total).toBe(2);
    expect(response.totalPages).toBe(1);
    expect(response.page).toBe(1);
    expect(response.perPage).toBe(10);
  });

  it('should list schools with province filter', async () => {
    const response = await adapter.listSchools(null, '北京', null, 1, 10);
    expect(response.schools.length).toBe(1);
    expect(response.schools[0].province).toBe('北京');
  });

  it('should get existing contest', async () => {
    const response = await adapter.getContest(1);
    expect(response).not.toBeNull();
    expect(response!.id).toBe(1);
    expect(response!.contest.name).toBe('NOI2023');
    expect(response!.records.length).toBe(2);
    expect(Object.keys(response!.schools).length).toBe(2);
    expect(Object.keys(response!.oiers).length).toBe(2);
  });

  it('should return null for non-existing contest', async () => {
    const response = await adapter.getContest(999);
    expect(response).toBeNull();
  });

  it('should list contests without filters', async () => {
    const response = await adapter.listContests(null, null, 1, 10);
    expect(response.contests.length).toBe(1);
    expect(response.total).toBe(1);
    expect(response.totalPages).toBe(1);
    expect(response.page).toBe(1);
    expect(response.perPage).toBe(10);
  });

  it('should list contests with type filter', async () => {
    const response = await adapter.listContests('NOI', null, 1, 10);
    expect(response.contests.length).toBe(1);
    expect(response.contests[0].type).toBe('NOI');
  });

  it('should list contests with year filter', async () => {
    const response = await adapter.listContests(null, 2023, 1, 10);
    expect(response.contests.length).toBe(1);
    expect(response.contests[0].year).toBe(2023);
  });

  it('should handle database connection errors gracefully', async () => {
    // Close the database to simulate connection error
    adapter['db'].close();

    await expect(adapter.getOIer(1)).rejects.toThrow();
  });

  it('should handle empty query results', async () => {
    const response = await adapter.listOIers('不存在的姓名', null, null, null, null, 1, 10);
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
      expect(response!.oiers[uid]).toBeDefined();
    });

    // Check that all records reference valid schools
    response!.records.forEach((record) => {
      expect(response!.schools[record.school_id]).toBeDefined();
    });
  });
});
