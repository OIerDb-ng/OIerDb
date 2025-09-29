/**
 * @jest-environment jsdom
 */

import { IDBAdapter } from '../adapter';
import type { ParseResult } from '@oierdb/core/interface';
import {
  DB_NAME,
  DB_VERSION,
  OIER_STORE,
  SCHOOL_STORE,
  CONTEST_STORE,
  RECORD_STORE,
} from '../constants';

// Mock data
const mockParseResult: ParseResult = {
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
      name: '北京市第一中学',
      province: '北京市',
      city: '北京市',
      score: 100,
      rank: 1,
      member_ids: [1],
      record_ids: [1],
      award_counts: new Map(),
    },
    {
      id: 2,
      name: '上海市第二中学',
      province: '上海市',
      city: '上海市',
      score: 95,
      rank: 2,
      member_ids: [2],
      record_ids: [2],
      award_counts: new Map(),
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
      level_counts: new Map([
        ['Au', 10],
        ['Ag', 20],
      ]),
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
      province: '北京市',
    },
    {
      contest_id: 1,
      school_id: 2,
      uid: 2,
      level: 'Ag',
      score: 550,
      rank: 2,
      province: '上海市',
    },
  ],
  metadata: [],
  needClearOldData: true,
};

describe('IDBAdapter', () => {
  let adapter: IDBAdapter;

  beforeEach(() => {
    // Create a new adapter instance before each test
    adapter = new IDBAdapter(indexedDB);
  });

  afterEach(async () => {
    // Close connection after each test
    await adapter.close();

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

  describe('Constructor', () => {
    it('should create instance with given IDBFactory', () => {
      expect(adapter).toBeInstanceOf(IDBAdapter);
      expect(adapter.getConnectionState()).toBe('disconnected');
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('Database Connection', () => {
    it('should initialize database successfully', async () => {
      expect(adapter.getConnectionState()).toBe('disconnected');

      // Loading data should initialize the database
      await adapter.loadData(mockParseResult);

      expect(adapter.getConnectionState()).toBe('connected');
      expect(adapter.isConnected()).toBe(true);
    }, 10000);

    it('should handle multiple connection attempts correctly', async () => {
      // Start multiple connection attempts
      const promises = [
        adapter.loadData(mockParseResult),
        adapter.loadData(mockParseResult),
        adapter.loadData(mockParseResult),
      ];

      await Promise.all(promises);

      expect(adapter.getConnectionState()).toBe('connected');
      expect(adapter.isConnected()).toBe(true);
    }, 10000);

    it('should properly close database connection', async () => {
      await adapter.loadData(mockParseResult);
      expect(adapter.isConnected()).toBe(true);

      await adapter.close();
      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getConnectionState()).toBe('disconnected');
    }, 10000);

    it('should not throw error when closing unconnected adapter', async () => {
      expect(adapter.isConnected()).toBe(false);

      await expect(adapter.close()).resolves.toBeUndefined();

      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('Data Loading', () => {
    it('should handle empty data', async () => {
      const emptyParseResult: ParseResult = {
        oiers: [],
        schools: [],
        contests: [],
        records: [],
        metadata: [],
        needClearOldData: false,
      };

      await expect(adapter.loadData(emptyParseResult)).resolves.toBeUndefined();
      expect(adapter.isConnected()).toBe(true);
    }, 10000);

    it('should verify data is actually stored in IndexedDB', async () => {
      await adapter.loadData(mockParseResult);

      // Directly read data from database for verification
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const openReq = indexedDB.open(DB_NAME, DB_VERSION);
        openReq.onsuccess = () => resolve(openReq.result);
        openReq.onerror = () => reject(openReq.error);
      });

      // Verify oiers data
      const oiersTransaction = db.transaction([OIER_STORE], 'readonly');
      const oiersStore = oiersTransaction.objectStore(OIER_STORE);
      const oiersCount = await new Promise<number>((resolve, reject) => {
        const countReq = oiersStore.count();
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => reject(countReq.error);
      });
      expect(oiersCount).toBe(2);

      // Verify schools data
      const schoolsTransaction = db.transaction([SCHOOL_STORE], 'readonly');
      const schoolsStore = schoolsTransaction.objectStore(SCHOOL_STORE);
      const schoolsCount = await new Promise<number>((resolve, reject) => {
        const countReq = schoolsStore.count();
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => reject(countReq.error);
      });
      expect(schoolsCount).toBe(2);

      db.close();
    }, 10000);
  });

  describe('Database Schema', () => {
    it('should create correct object stores during upgrade', async () => {
      await adapter.loadData(mockParseResult);

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const openReq = indexedDB.open(DB_NAME, DB_VERSION);
        openReq.onsuccess = () => resolve(openReq.result);
        openReq.onerror = () => reject(openReq.error);
      });

      // Verify all stores are created
      expect(db.objectStoreNames.contains(OIER_STORE)).toBe(true);
      expect(db.objectStoreNames.contains(SCHOOL_STORE)).toBe(true);
      expect(db.objectStoreNames.contains(CONTEST_STORE)).toBe(true);
      expect(db.objectStoreNames.contains(RECORD_STORE)).toBe(true);

      // Verify indexes
      const transaction = db.transaction([OIER_STORE], 'readonly');
      const oierStore = transaction.objectStore(OIER_STORE);

      expect(oierStore.indexNames.contains('name')).toBe(true);
      expect(oierStore.indexNames.contains('lowered_name')).toBe(true);
      expect(oierStore.indexNames.contains('initials')).toBe(true);
      expect(oierStore.indexNames.contains('enroll_middle')).toBe(true);
      expect(oierStore.indexNames.contains('gender')).toBe(true);
      expect(oierStore.indexNames.contains('rank')).toBe(true);

      db.close();
    }, 10000);
  });

  describe('Connection State Management', () => {
    it('should return correct connection states', () => {
      expect(adapter.getConnectionState()).toBe('disconnected');
      expect(adapter.isConnected()).toBe(false);
    });

    it('should update connection state during initialization', async () => {
      expect(adapter.getConnectionState()).toBe('disconnected');

      await adapter.loadData(mockParseResult);

      expect(adapter.getConnectionState()).toBe('connected');
      expect(adapter.isConnected()).toBe(true);
    }, 10000);
  });

  describe('Multiple Operations', () => {
    it('should handle multiple data loading operations', async () => {
      // First load
      await adapter.loadData(mockParseResult);
      expect(adapter.isConnected()).toBe(true);

      // Second load (should reuse connection)
      const secondLoadResult = { ...mockParseResult, needClearOldData: true };
      await adapter.loadData(secondLoadResult);
      expect(adapter.isConnected()).toBe(true);
    }, 10000);

    it('should handle operations after connection is closed', async () => {
      await adapter.loadData(mockParseResult);
      expect(adapter.isConnected()).toBe(true);

      await adapter.close();
      expect(adapter.isConnected()).toBe(false);

      // Loading after close should re-establish connection
      await adapter.loadData(mockParseResult);
      expect(adapter.isConnected()).toBe(true);
    }, 10000);
  });

  describe('Methods', () => {
    beforeEach(async () => {
      await adapter.loadData(mockParseResult);
    });

    it('should throw error for checkAvailability', async () => {
      await expect(adapter.checkAvailability()).rejects.toThrow('Method not implemented');
    });

    it('should throw error for getOIer', async () => {
      await expect(adapter.getOIer(1)).rejects.toThrow('Method not implemented');
    });

    it('should throw error for listOIers', async () => {
      await expect(adapter.listOIers(null, null, null, null, null, 1, 10)).rejects.toThrow(
        'Method not implemented'
      );
    });

    it('should throw error for getSchool', async () => {
      await expect(adapter.getSchool(1)).rejects.toThrow('Method not implemented');
    });

    it('should throw error for listSchools', async () => {
      await expect(adapter.listSchools(null, null, null, 1, 10)).rejects.toThrow(
        'Method not implemented'
      );
    });

    it('should throw error for getContest', async () => {
      await expect(adapter.getContest(1)).rejects.toThrow('Method not implemented');
    });

    it('should throw error for listContests', async () => {
      await expect(adapter.listContests(null, null, 1, 10)).rejects.toThrow(
        'Method not implemented'
      );
    });
  });
});
