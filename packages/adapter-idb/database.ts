import type { DbContest, DbOIer, DbRecord, DbSchool } from '@oierdb/core';
import Dexie, { type Table } from 'dexie';

export type StoredOIer = Omit<DbOIer, 'provinces'>;

export interface OIerProvince {
  uid: number;
  province: number;
  rank: number;
  /** Preserve the order of provinces in the result stream. */
  position: number;
}

interface MetadataRecord {
  key: string;
  value: unknown;
}

interface LoaderStateRecord {
  key: string;
  value: string | number;
}

export interface OIerDbDexie extends Dexie {
  oiers: Table<StoredOIer, number>;
  oierProvinces: Table<OIerProvince, [number, number]>;
  schools: Table<DbSchool, number>;
  contests: Table<DbContest, number>;
  recordEntries: Table<DbRecord, [number, number]>;
  meta: Table<MetadataRecord, string>;
  loaderState: Table<LoaderStateRecord, string>;
}

export function createDatabase(): OIerDbDexie {
  if (!globalThis.indexedDB || !globalThis.IDBKeyRange) {
    throw new TypeError('IndexedDB is not available in this environment');
  }

  const db = new Dexie('oierdb-ng') as OIerDbDexie;

  db.version(2).stores({
    oiers: 'uid, name, initials, enrollMiddle, gender, [rank+uid]',
    oierProvinces: '[uid+province], [province+rank+uid]',
    schools: 'id, name, city, [rank+id], [province+city], [province+rank+id]',
    contests: 'id, name, year, type, [type+year]',
    recordEntries: '[uid+contestId], contestId, [contestId+rank], schoolId, uid',
    meta: 'key',
    loaderState: 'key',
  }).upgrade(async (transaction) => {
    await Promise.all([
      transaction.table('oiers').clear(),
      transaction.table('schools').clear(),
      transaction.table('contests').clear(),
      transaction.table('recordEntries').clear(),
      transaction.table('meta').clear(),
      transaction.table('loaderState').clear(),
    ]);
  });

  return db;
}
