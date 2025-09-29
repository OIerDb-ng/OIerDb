/**
 * @jest-environment jsdom
 */

import { runMigrations } from '../upgrades';
import {
  OIER_STORE,
  SCHOOL_STORE,
  CONTEST_STORE,
  RECORD_STORE,
  METADATA_STORE,
} from '../constants';

describe('Database Migrations', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    // Create a new database for each test
    const dbName = `test-db-${Date.now()}-${Math.random()}`;
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const openReq = indexedDB.open(dbName, 1);

      openReq.onupgradeneeded = () => {
        resolve(openReq.result);
      };

      openReq.onsuccess = () => {
        resolve(openReq.result);
      };

      openReq.onerror = () => {
        reject(openReq.error);
      };
    });
  });

  afterEach(() => {
    if (db) {
      const dbName = db.name;
      db.close();

      // Delete test database
      const deleteReq = indexedDB.deleteDatabase(dbName);
      return new Promise<void>((resolve) => {
        deleteReq.onsuccess = () => resolve();
        deleteReq.onerror = () => resolve(); // Continue even if deletion fails
        deleteReq.onblocked = () => resolve(); // Continue even if blocked
      });
    }
  });

  describe('Version 1 Migration', () => {
    it('should upgrade from version 0 to version 1', async () => {
      await runMigrations(db, 0, 1);

      // Verify all object stores are created
      expect(db.objectStoreNames.contains(OIER_STORE)).toBe(true);
      expect(db.objectStoreNames.contains(SCHOOL_STORE)).toBe(true);
      expect(db.objectStoreNames.contains(CONTEST_STORE)).toBe(true);
      expect(db.objectStoreNames.contains(RECORD_STORE)).toBe(true);
      expect(db.objectStoreNames.contains(METADATA_STORE)).toBe(true);
    });

    it('should not recreate existing object stores', async () => {
      // Run migration once
      await runMigrations(db, 0, 1);

      const storeCountBefore = db.objectStoreNames.length;

      // Run same migration again (simulate repeated execution)
      await runMigrations(db, 0, 1);

      const storeCountAfter = db.objectStoreNames.length;

      expect(storeCountAfter).toBe(storeCountBefore);
    });

    it('should perform no operation when versions are the same', async () => {
      const storeCountBefore = db.objectStoreNames.length;

      // Same version migration should do nothing
      await runMigrations(db, 1, 1);

      const storeCountAfter = db.objectStoreNames.length;

      expect(storeCountAfter).toBe(storeCountBefore);
    });

    it('should reject downgrade from version 1', async () => {
      await expect(runMigrations(db, 1, 0)).rejects.toThrow('Cannot downgrade from version 1');
    });
  });

  describe('Object Store Creation and Indexes', () => {
    it('should create all required object stores and set correct indexes', async () => {
      // Create a new database to test upgrade
      const testDB = new IDBFactory().open('test-upgrade-db', 1);

      return new Promise<void>((resolve, reject) => {
        testDB.onupgradeneeded = async (event) => {
          try {
            const db = testDB.result;
            await runMigrations(db, 0, 1);

            // Test OIER_STORE
            expect(db.objectStoreNames.contains(OIER_STORE)).toBe(true);
            const oierStore = testDB.transaction!.objectStore(OIER_STORE);
            expect(oierStore.keyPath).toBe('uid');
            expect(oierStore.indexNames.contains('name')).toBe(true);
            expect(oierStore.indexNames.contains('lowered_name')).toBe(true);
            expect(oierStore.indexNames.contains('initials')).toBe(true);
            expect(oierStore.indexNames.contains('enroll_middle')).toBe(true);
            expect(oierStore.indexNames.contains('gender')).toBe(true);
            expect(oierStore.indexNames.contains('rank')).toBe(true);

            // Test SCHOOL_STORE
            expect(db.objectStoreNames.contains(SCHOOL_STORE)).toBe(true);
            const schoolStore = testDB.transaction!.objectStore(SCHOOL_STORE);
            expect(schoolStore.keyPath).toBe('id');
            expect(schoolStore.indexNames.contains('name')).toBe(true);
            expect(schoolStore.indexNames.contains('province')).toBe(true);
            expect(schoolStore.indexNames.contains('city')).toBe(true);
            expect(schoolStore.indexNames.contains('rank')).toBe(true);

            // Test CONTEST_STORE
            expect(db.objectStoreNames.contains(CONTEST_STORE)).toBe(true);
            const contestStore = testDB.transaction!.objectStore(CONTEST_STORE);
            expect(contestStore.keyPath).toBe('id');
            expect(contestStore.indexNames.contains('name')).toBe(true);
            expect(contestStore.indexNames.contains('year')).toBe(true);
            expect(contestStore.indexNames.contains('type')).toBe(true);

            // Test RECORD_STORE
            expect(db.objectStoreNames.contains(RECORD_STORE)).toBe(true);
            const recordStore = testDB.transaction!.objectStore(RECORD_STORE);
            expect(recordStore.keyPath).toEqual(['uid', 'contest_id']);
            expect(recordStore.indexNames.contains('contest_id')).toBe(true);
            expect(recordStore.indexNames.contains('school_id')).toBe(true);
            expect(recordStore.indexNames.contains('uid')).toBe(true);
            expect(recordStore.indexNames.contains('level')).toBe(true);
            expect(recordStore.indexNames.contains('province')).toBe(true);

            // Test METADATA_STORE
            expect(db.objectStoreNames.contains(METADATA_STORE)).toBe(true);
            const metadataStore = testDB.transaction!.objectStore(METADATA_STORE);
            expect(metadataStore.keyPath).toBe('key');
          } catch (error) {
            reject(error);
          }
        };

        testDB.onsuccess = () => {
          testDB.result.close();
          resolve();
        };

        testDB.onerror = () => {
          reject(new Error('Database creation failed'));
        };
      });
    });
  });
});
