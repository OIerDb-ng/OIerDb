import { OIER_STORE, SCHOOL_STORE, CONTEST_STORE, RECORD_STORE, METADATA_STORE } from './constants';

interface Upgrades {
  [version: number]: {
    // upgrade from previous version
    upgrade: (db: IDBDatabase) => Promise<void>;
    // downgrade to previous version
    downgrade: (db: IDBDatabase) => Promise<void>;
  };
}

const upgrades: Upgrades = {
  1: {
    // from version 0 (non-existent) to version 1
    async upgrade(db: IDBDatabase) {
      if (!db.objectStoreNames.contains(OIER_STORE)) {
        const oierStore = db.createObjectStore(OIER_STORE, { keyPath: 'uid' });
        oierStore.createIndex('name', 'name', { unique: false });
        oierStore.createIndex('lowered_name', 'lowered_name', { unique: false });
        oierStore.createIndex('initials', 'initials', { unique: false });
        oierStore.createIndex('enroll_middle', 'enroll_middle', { unique: false });
        oierStore.createIndex('gender', 'gender', { unique: false });
        oierStore.createIndex('rank', 'rank', { unique: false });
      }

      if (!db.objectStoreNames.contains(SCHOOL_STORE)) {
        const schoolStore = db.createObjectStore(SCHOOL_STORE, { keyPath: 'id' });
        schoolStore.createIndex('name', 'name', { unique: false });
        schoolStore.createIndex('province', 'province', { unique: false });
        schoolStore.createIndex('city', 'city', { unique: false });
        schoolStore.createIndex('rank', 'rank', { unique: false });
      }

      if (!db.objectStoreNames.contains(CONTEST_STORE)) {
        const contestStore = db.createObjectStore(CONTEST_STORE, { keyPath: 'id' });
        contestStore.createIndex('name', 'name', { unique: false });
        contestStore.createIndex('year', 'year', { unique: false });
        contestStore.createIndex('type', 'type', { unique: false });
      }

      if (!db.objectStoreNames.contains(RECORD_STORE)) {
        const recordStore = db.createObjectStore(RECORD_STORE, { keyPath: ['uid', 'contest_id'] });
        recordStore.createIndex('contest_id', 'contest_id', { unique: false });
        recordStore.createIndex('school_id', 'school_id', { unique: false });
        recordStore.createIndex('uid', 'uid', { unique: false });
        recordStore.createIndex('level', 'level', { unique: false });
        recordStore.createIndex('province', 'province', { unique: false });
      }

      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
      }
    },
    async downgrade(db: IDBDatabase) {
      throw new Error('Cannot downgrade from version 1');
    },
  },
};

export async function runMigrations(db: IDBDatabase, oldVersion: number, newVersion: number) {
  if (oldVersion < newVersion) {
    for (let v = oldVersion + 1; v <= newVersion; v++) {
      if (upgrades[v]) {
        await upgrades[v].upgrade(db);
      }
    }
  } else if (oldVersion > newVersion) {
    for (let v = oldVersion; v > newVersion; v--) {
      if (upgrades[v]) {
        await upgrades[v].downgrade(db);
      }
    }
  }
}
