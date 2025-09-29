import type { IAdapterWithLoader, ParseResult } from '@oierdb/core';

import {
  DB_VERSION,
  CONTEST_STORE,
  OIER_STORE,
  RECORD_STORE,
  SCHOOL_STORE,
  DB_NAME,
} from './constants';
import { runMigrations } from './upgrades';

enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export class IDBAdapter implements IAdapterWithLoader {
  private factory: IDBFactory;
  private db: IDBDatabase | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private connectionPromise: Promise<IDBDatabase> | null = null;

  constructor(factory: IDBFactory) {
    this.factory = factory;
  }

  private async initializeDatabase(): Promise<IDBDatabase> {
    if (this.connectionState === ConnectionState.CONNECTED && this.db) {
      return this.db;
    }

    if (this.connectionState === ConnectionState.CONNECTING && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionState = ConnectionState.CONNECTING;

    this.connectionPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const openReq = this.factory.open(DB_NAME, DB_VERSION);

      openReq.onerror = () => {
        this.connectionState = ConnectionState.ERROR;
        reject(new Error(`Failed to open database: ${openReq.error?.message || 'Unknown error'}`));
      };

      openReq.onblocked = () => {
        console.warn('Database upgrade blocked. Please close other tabs using this database.');
      };

      openReq.onupgradeneeded = async (event) => {
        try {
          const db = openReq.result;
          const oldVersion = event.oldVersion;
          const newVersion = event.newVersion || DB_VERSION;

          console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);
          await runMigrations(db, oldVersion, newVersion);
          console.log('Database upgrade completed successfully');
        } catch (error) {
          console.error('Database upgrade failed:', error);
          reject(error);
        }
      };

      openReq.onsuccess = () => {
        this.db = openReq.result;
        this.connectionState = ConnectionState.CONNECTED;

        this.db.onclose = () => {
          console.warn('Database connection closed unexpectedly');
          this.connectionState = ConnectionState.DISCONNECTED;
          this.db = null;
          this.connectionPromise = null;
        };

        this.db.onversionchange = () => {
          console.warn(
            'Database version changed by another connection.',
            'Closing current connection.'
          );
          this.db?.close();
          this.connectionState = ConnectionState.DISCONNECTED;
          this.db = null;
          this.connectionPromise = null;
        };

        resolve(this.db);
      };
    });

    return this.connectionPromise;
  }

  private async ensureConnection(): Promise<IDBDatabase> {
    if (this.connectionState === ConnectionState.ERROR) {
      this.connectionState = ConnectionState.DISCONNECTED;
      this.connectionPromise = null;
    }

    return this.initializeDatabase();
  }

  async loadData(result: ParseResult): Promise<void> {
    const db = await this.ensureConnection();

    return new Promise(async (resolve, reject) => {
      try {
        const tx = db.transaction(
          [OIER_STORE, SCHOOL_STORE, CONTEST_STORE, RECORD_STORE],
          'readwrite'
        );

        tx.onerror = () => {
          reject(new Error(`Transaction failed: ${tx.error?.message || 'Unknown error'}`));
        };

        tx.onabort = () => {
          reject(new Error('Transaction was aborted'));
        };

        const oiersStore = tx.objectStore(OIER_STORE);
        const schoolsStore = tx.objectStore(SCHOOL_STORE);
        const contestsStore = tx.objectStore(CONTEST_STORE);
        const recordsStore = tx.objectStore(RECORD_STORE);

        // 在一些情况下需要清空旧数据
        if (result.needClearOldData) {
          console.log('Clearing old data...');
          oiersStore.clear();
          schoolsStore.clear();
          contestsStore.clear();
          recordsStore.clear();
        }

        console.log(
          'Loading:',
          `${result.oiers.length} oiers,`,
          `${result.schools.length} schools,`,
          `${result.contests.length} contests,`,
          `${result.records.length} records`
        );

        result.oiers.forEach((oier) => {
          oiersStore.put(oier);
        });
        result.schools.forEach((school) => {
          schoolsStore.put(school);
        });
        result.contests.forEach((contest) => {
          contestsStore.put(contest);
        });
        result.records.forEach((record) => {
          recordsStore.put(record);
        });

        tx.oncomplete = () => {
          console.log('Data loading completed successfully');
          resolve();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.connectionState = ConnectionState.DISCONNECTED;
      this.connectionPromise = null;
      console.log('Database connection closed');
    }
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED && this.db !== null;
  }

  // ==============================
  // IAdapter Interface
  // ==============================

  async checkAvailability(): Promise<boolean> {
    // TODO: 实现检查可用性的逻辑
    throw new Error('Method not implemented');
  }

  async getOIer(uid: number): Promise<any> {
    // TODO: 实现获取选手信息的逻辑
    throw new Error('Method not implemented');
  }

  async listOIers(
    name: string | null,
    initials: string | null,
    enroll_middle: number | null,
    gender: any,
    province: string | null,
    page: number,
    perPage: number
  ): Promise<any> {
    // TODO: 实现列出选手的逻辑
    throw new Error('Method not implemented');
  }

  async getSchool(id: number): Promise<any> {
    // TODO: 实现获取学校信息的逻辑
    throw new Error('Method not implemented');
  }

  async listSchools(
    name: string | null,
    province: string | null,
    city: string | null,
    page: number,
    perPage: number
  ): Promise<any> {
    // TODO: 实现列出学校的逻辑
    throw new Error('Method not implemented');
  }

  async getContest(id: number): Promise<any> {
    // TODO: 实现获取比赛信息的逻辑
    throw new Error('Method not implemented');
  }

  async listContests(
    type: string | null,
    year: number | null,
    page: number,
    perPage: number
  ): Promise<any> {
    // TODO: 实现列出比赛的逻辑
    throw new Error('Method not implemented');
  }
}
