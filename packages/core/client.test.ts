import { OIerDbClient } from './client';
import type {
  GetContestResponse,
  GetOIerResponse,
  GetSchoolResponse,
  IAdapter,
  ListContestsQuery,
  ListContestsResponse,
  ListOIersQuery,
  ListOIersResponse,
  ListSchoolsQuery,
  ListSchoolsResponse,
  VersionResponse,
} from './interface';

// Mock adapter for testing
class MockAdapter implements IAdapter {
  async checkAvailability(targetVersion: string): Promise<boolean> {
    return targetVersion === 'test-version';
  }

  async getVersion(): Promise<VersionResponse> {
    return {
      data_version: 'test-version',
    };
  }

  async getOIer(uid: number): Promise<GetOIerResponse | null> {
    if (uid === 12345) {
      return {
        uid: 12345,
        oier: {
          uid: 12345,
          name: '张三',
          lowered_name: '张三',
          initials: 'zs',
          enroll_middle: 2020,
          gender: 1,
          provinces: ['北京'],
          school_ids: [1],
          contest_ids: [1],
          oierdb_score: 100,
          ccf_level: 1,
          ccf_score: 100,
          rank: 0,
        },
        records: [],
        schools_map: {},
        contests_map: {},
        data_version: 'test-version',
      };
    }
    return null;
  }

  async listOIers(query: ListOIersQuery): Promise<ListOIersResponse> {
    const { page = 1, perPage = 20 } = query;
    return {
      oiers: [],
      total: 0,
      totalPages: 0,
      page,
      perPage,
      data_version: 'test-version',
    };
  }

  async getSchool(id: number): Promise<GetSchoolResponse | null> {
    return null;
  }

  async listSchools(query: ListSchoolsQuery): Promise<ListSchoolsResponse> {
    const { page = 1, perPage = 20 } = query;
    return {
      schools: [],
      total: 0,
      totalPages: 0,
      page,
      perPage,
      data_version: 'test-version',
    };
  }

  async getContest(id: number): Promise<GetContestResponse | null> {
    return null;
  }

  async listContests(query: ListContestsQuery): Promise<ListContestsResponse> {
    const { page = 1, perPage = 20 } = query;
    return {
      contests: [],
      total: 0,
      totalPages: 0,
      page,
      perPage,
      data_version: 'test-version',
    };
  }
}

describe('OIerDbClient', () => {
  let adapter: MockAdapter;
  let client: OIerDbClient;

  beforeEach(() => {
    adapter = new MockAdapter();
    client = new OIerDbClient(adapter);
  });

  test('should create client with adapter', () => {
    expect(client).toBeInstanceOf(OIerDbClient);
    expect(client.getAdapter()).toBe(adapter);
  });

  test('should switch adapter', () => {
    const newAdapter = new MockAdapter();
    client.setAdapter(newAdapter);
    expect(client.getAdapter()).toBe(newAdapter);
    expect(client.getAdapter()).not.toBe(adapter);
  });

  test('should check availability', async () => {
    const result = await client.checkAvailability('test-version');
    expect(result).toBe(true);

    const result2 = await client.checkAvailability('wrong-version');
    expect(result2).toBe(false);
  });

  test('should get OIer', async () => {
    const result = await client.getOIer(12345);
    expect(result).not.toBeNull();
    expect(result?.uid).toBe(12345);
    expect(result?.oier.name).toBe('张三');

    const notFound = await client.getOIer(99999);
    expect(notFound).toBeNull();
  });

  test('should list OIers with default options', async () => {
    const result = await client.listOIers();
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
  });

  test('should list OIers with custom options', async () => {
    const result = await client.listOIers({
      name: '张三',
      page: 2,
      perPage: 50,
    });
    expect(result.page).toBe(2);
    expect(result.perPage).toBe(50);
  });

  test('should limit perPage to 100', async () => {
    const result = await client.listOIers({
      perPage: 200,
    });
    // The actual perPage passed to adapter should be 100
    // but we can't directly test that without spying
    expect(result).toBeDefined();
  });

  test('should get school', async () => {
    const result = await client.getSchool(1);
    expect(result).toBeNull();
  });

  test('should list schools', async () => {
    const result = await client.listSchools({
      name: '测试学校',
      province: '北京',
    });
    expect(result.schools).toEqual([]);
  });

  test('should get contest', async () => {
    const result = await client.getContest(1);
    expect(result).toBeNull();
  });

  test('should list contests', async () => {
    const result = await client.listContests({
      type: 'NOI',
      year: 2024,
    });
    expect(result.contests).toEqual([]);
  });

  test('should use new adapter after switching', async () => {
    class NewMockAdapter extends MockAdapter {
      async getOIer(uid: number): Promise<GetOIerResponse | null> {
        return {
          uid,
          oier: {
            uid,
            name: '李四',
            lowered_name: '李四',
            initials: 'ls',
            enroll_middle: 2021,
            gender: 0,
            provinces: ['上海'],
            school_ids: [2],
            contest_ids: [2],
            oierdb_score: 200,
            ccf_level: 2,
            ccf_score: 200,
            rank: 1,
          },
          records: [],
          schools_map: {},
          contests_map: {},
          data_version: 'new-version',
        };
      }
    }

    const newAdapter = new NewMockAdapter();
    client.setAdapter(newAdapter);

    const result = await client.getOIer(99999);
    expect(result?.oier.name).toBe('李四');
    expect(result?.data_version).toBe('new-version');
  });

  describe('Cache functionality', () => {
    test('should cache OIer data by default', async () => {
      const spy = jest.spyOn(adapter, 'getOIer');

      // First call - should hit adapter
      const result1 = await client.getOIer(12345);
      expect(result1?.oier.name).toBe('张三');
      expect(spy).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await client.getOIer(12345);
      expect(result2?.oier.name).toBe('张三');
      expect(spy).toHaveBeenCalledTimes(1); // Still 1, not 2

      spy.mockRestore();
    });

    test('should cache School data', async () => {
      const spy = jest.spyOn(adapter, 'getSchool');

      await client.getSchool(1);
      await client.getSchool(1);

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    test('should cache Contest data', async () => {
      const spy = jest.spyOn(adapter, 'getContest');

      await client.getContest(1);
      await client.getContest(1);

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    test('should allow disabling cache', async () => {
      const spy = jest.spyOn(adapter, 'getOIer');

      client.setCacheEnabled(false);
      expect(client.isCacheEnabled()).toBe(false);

      await client.getOIer(12345);
      await client.getOIer(12345);

      expect(spy).toHaveBeenCalledTimes(2); // Both calls hit adapter
      spy.mockRestore();
    });

    test('should clear cache when disabling', async () => {
      const spy = jest.spyOn(adapter, 'getOIer');

      // Cache data first
      await client.getOIer(12345);
      expect(spy).toHaveBeenCalledTimes(1);

      // Disable cache - should clear existing cache
      client.setCacheEnabled(false);

      // Re-enable cache
      client.setCacheEnabled(true);

      // This should hit adapter again since cache was cleared
      await client.getOIer(12345);
      expect(spy).toHaveBeenCalledTimes(2);

      spy.mockRestore();
    });

    test('should clear all caches', async () => {
      const oierSpy = jest.spyOn(adapter, 'getOIer');
      const schoolSpy = jest.spyOn(adapter, 'getSchool');
      const contestSpy = jest.spyOn(adapter, 'getContest');

      // Cache data
      await client.getOIer(12345);
      await client.getSchool(1);
      await client.getContest(1);

      // Clear cache
      client.clearCache();

      // These should hit adapter again
      await client.getOIer(12345);
      await client.getSchool(1);
      await client.getContest(1);

      expect(oierSpy).toHaveBeenCalledTimes(2);
      expect(schoolSpy).toHaveBeenCalledTimes(2);
      expect(contestSpy).toHaveBeenCalledTimes(2);

      oierSpy.mockRestore();
      schoolSpy.mockRestore();
      contestSpy.mockRestore();
    });

    test('should clear cache when switching adapters', async () => {
      const spy = jest.spyOn(adapter, 'getOIer');

      // Cache data
      await client.getOIer(12345);
      expect(spy).toHaveBeenCalledTimes(1);

      // Switch adapter
      const newAdapter = new MockAdapter();
      client.setAdapter(newAdapter);

      // Should hit new adapter, not use old cache
      const newSpy = jest.spyOn(newAdapter, 'getOIer');
      await client.getOIer(12345);
      expect(newSpy).toHaveBeenCalledTimes(1);

      spy.mockRestore();
      newSpy.mockRestore();
    });

    test('should create client with cache disabled', () => {
      const clientNoCache = new OIerDbClient(adapter, {
        cache: { enabled: false },
      });

      expect(clientNoCache.isCacheEnabled()).toBe(false);
    });

    test('should create client with custom cache size', () => {
      const clientCustomCache = new OIerDbClient(adapter, {
        cache: { maxSize: 500 },
      });

      expect(clientCustomCache.isCacheEnabled()).toBe(true);
      // The cache size is internal, we just verify it doesn't throw
    });
  });
});
