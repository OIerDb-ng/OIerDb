import type {
  DbContest,
  DbMetadata,
  DbOIer,
  DbParseResult,
  DbRecord,
  DbSchool,
  GetContestResponse,
  GetOIerResponse,
  GetSchoolResponse,
  IAdapterWithLoader,
  ListContestsQuery,
  ListContestsResponse,
  ListOIersQuery,
  ListOIersResponse,
  ListSchoolsQuery,
  ListSchoolsResponse,
  VersionResponse,
} from '@oierdb/core';
import { Dexie, type EntityTable, type Table } from 'dexie';

import {
  DB_NAME,
  DB_VERSION,
  META_KEY_DATA_VERSION,
  META_KEY_LOADED_OFFSET_CONTESTS,
  META_KEY_LOADED_OFFSET_OIERS,
  META_KEY_LOADED_OFFSET_RECORDS,
  META_KEY_LOADED_OFFSET_SCHOOLS,
  META_KEY_LOADING_PROGRESS,
} from './constants';
import { normalizePaginationParams } from './util';

interface OIerDbDexie extends Dexie {
  oiers: EntityTable<DbOIer, 'uid'>;
  schools: EntityTable<DbSchool, 'id'>;
  contests: EntityTable<DbContest, 'id'>;
  records: Table<DbRecord, [number, number]>; // [uid, contest_id]
  meta: EntityTable<DbMetadata, 'key'>;
}

export class IDBAdapter implements IAdapterWithLoader {
  private db: OIerDbDexie;

  constructor(factory: IDBFactory, keyRange: typeof IDBKeyRange) {
    this.db = new Dexie(DB_NAME, {
      indexedDB: factory,
      IDBKeyRange: keyRange,
    }) as OIerDbDexie;

    // 改这里的定义之后，必须更新 DB_VERSION 的值
    this.db.version(DB_VERSION).stores({
      oiers: 'uid, name, lowered_name, initials, enroll_middle, gender, rank, *provinces',
      schools: 'id, name, province, city, rank, [province+city]',
      contests: 'id, name, year, type, [type+year]',
      records: '[uid+contest_id], contest_id, [contest_id+rank], school_id, uid, level, province',
      meta: 'key',
    });
  }

  getType(): string {
    return 'idb';
  }

  // ==============================
  // Helper Methods for Progress Tracking
  // ==============================

  private async getLoadedOffset(key: string): Promise<number> {
    const meta = await this.db.meta.get(key);
    return meta ? parseInt(meta.value, 10) : 0;
  }

  private async setLoadedOffset(key: string, offset: number): Promise<void> {
    await this.db.meta.put({ key, value: offset.toString() });
  }

  private async getLoadingProgress(): Promise<'loading' | 'loaded' | null> {
    const meta = await this.db.meta.get(META_KEY_LOADING_PROGRESS);
    return (meta?.value as 'loading' | 'loaded') || null;
  }

  private async setLoadingProgress(status: 'loading' | 'loaded'): Promise<void> {
    await this.db.meta.put({ key: META_KEY_LOADING_PROGRESS, value: status });
  }

  // ==============================
  // IAdapterWithLoader Interface
  // ==============================

  async loadData(data: DbParseResult): Promise<void> {
    const CHUNK_SIZE = 5000;

    // Check if we need to start fresh (version change or corruption)
    const currentVersion = await this.db.meta
      .get(META_KEY_DATA_VERSION)
      .then((meta) => meta?.value || '');

    const needsReset = currentVersion !== data.data_version;

    if (needsReset) {
      // Version changed: clear data_version first, then initialize metadata
      await this.db.transaction('readwrite', [this.db.meta], async (tx) => {
        // Clear data_version to signal invalid state
        await tx.meta.delete(META_KEY_DATA_VERSION);
      });

      // Clear all data tables
      await this.db.transaction(
        'readwrite',
        [this.db.oiers, this.db.schools, this.db.contests, this.db.records],
        async (tx) => {
          await Promise.all([
            tx.oiers.clear(),
            tx.schools.clear(),
            tx.contests.clear(),
            tx.records.clear(),
          ]);
        },
      );

      // Initialize metadata for new version
      await this.db.transaction('readwrite', [this.db.meta], async (tx) => {
        await Promise.all([
          tx.meta.put({ key: META_KEY_DATA_VERSION, value: data.data_version }),
          tx.meta.put({ key: META_KEY_LOADING_PROGRESS, value: 'loading' }),
          tx.meta.put({ key: META_KEY_LOADED_OFFSET_OIERS, value: '0' }),
          tx.meta.put({ key: META_KEY_LOADED_OFFSET_SCHOOLS, value: '0' }),
          tx.meta.put({ key: META_KEY_LOADED_OFFSET_RECORDS, value: '0' }),
          tx.meta.put({ key: META_KEY_LOADED_OFFSET_CONTESTS, value: '0' }),
        ]);
      });
    }

    // Helper function to load a table incrementally with resume support
    const loadTableIncrementally = async <T, TKey, TInsertType = T>(
      table: Table<T, TKey, TInsertType>,
      items: readonly TInsertType[],
      offsetKey: string,
      tableName: string,
    ) => {
      const totalCount = items.length;
      let loadedOffset = await this.getLoadedOffset(offsetKey);

      // Validate offset: if corrupted (> total), reset to 0
      if (loadedOffset > totalCount) {
        console.warn(
          `Corrupted offset detected for ${tableName}: ${loadedOffset} > ${totalCount}. Resetting.`,
        );
        loadedOffset = 0;
        await this.setLoadedOffset(offsetKey, 0);
      }

      // If already complete, skip
      if (loadedOffset >= totalCount) {
        return;
      }

      console.log(`Loading ${tableName}: starting from offset ${loadedOffset} / ${totalCount}`);

      // Load remaining data in chunks
      for (let i = loadedOffset; i < totalCount; i += CHUNK_SIZE) {
        console.log(
          `Loading ${tableName}: processing items ${i} to ${Math.min(i + CHUNK_SIZE, totalCount)} / ${totalCount}`,
        );

        const chunkEnd = Math.min(i + CHUNK_SIZE, totalCount);
        const chunk = items.slice(i, chunkEnd);

        // Load chunk and update offset in same transaction for consistency
        await this.db.transaction('readwrite', [table, this.db.meta], async (tx) => {
          await tx.table(table.name).bulkAdd(chunk);
          await tx.meta.put({ key: offsetKey, value: chunkEnd.toString() });
        });
      }
    };

    // Load all tables in parallel
    await Promise.all([
      loadTableIncrementally(this.db.oiers, data.oiers, META_KEY_LOADED_OFFSET_OIERS, 'oiers'),
      loadTableIncrementally(
        this.db.schools,
        data.schools,
        META_KEY_LOADED_OFFSET_SCHOOLS,
        'schools',
      ),
      loadTableIncrementally(
        this.db.records,
        data.records,
        META_KEY_LOADED_OFFSET_RECORDS,
        'records',
      ),
      loadTableIncrementally(
        this.db.contests,
        data.contests,
        META_KEY_LOADED_OFFSET_CONTESTS,
        'contests',
      ),
    ]);

    // Final validation: check that actual counts match expected counts
    const [actualOiersCount, actualSchoolsCount, actualRecordsCount, actualContestsCount] =
      await Promise.all([
        this.db.oiers.count(),
        this.db.schools.count(),
        this.db.records.count(),
        this.db.contests.count(),
      ]);

    if (
      actualOiersCount !== data.oiers.length ||
      actualSchoolsCount !== data.schools.length ||
      actualRecordsCount !== data.records.length ||
      actualContestsCount !== data.contests.length
    ) {
      throw new Error(
        'Data validation failed: actual counts do not match expected counts. Data may be corrupted.',
      );
    }

    // Mark loading as complete
    await this.setLoadingProgress('loaded');
  }

  // ==============================
  // IAdapter Interface
  // ==============================

  async checkAvailability(targetVersion: string): Promise<boolean> {
    const [versionMeta, progressMeta] = await Promise.all([
      this.db.meta.get(META_KEY_DATA_VERSION),
      this.db.meta.get(META_KEY_LOADING_PROGRESS),
    ]);

    const versionMatches = versionMeta?.value === targetVersion;
    const loadingComplete = progressMeta?.value === 'loaded';

    return versionMatches && loadingComplete;
  }

  async getVersion(): Promise<VersionResponse> {
    const version = await this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || '');

    return {
      data_version: version,
    };
  }

  async getOIer(uid: number): Promise<GetOIerResponse | null> {
    const oier = await this.db.oiers.get(uid);
    if (!oier) {
      return null;
    }

    const [records, schools, version] = await Promise.all([
      this.db.records.where('uid').equals(uid).toArray(),
      this.db.schools
        .bulkGet(oier.school_ids)
        .then((items) => items.filter((s): s is DbSchool => s !== undefined)),
      this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
    ]);
    const contests = await this.db.contests
      .bulkGet(records.map((r) => r.contest_id))
      .then((items) => items.filter((c): c is DbContest => c !== undefined));

    return {
      uid,
      oier,
      records,
      schools_map: Object.fromEntries(schools.map((s) => [s.id, s])),
      contests_map: Object.fromEntries(contests.map((c) => [c.id, c])),
      data_version: version,
    };
  }

  async listOIers(query: ListOIersQuery): Promise<ListOIersResponse> {
    const {
      name = null,
      initials = null,
      enroll_middle = null,
      gender = null,
      province = null,
    } = query;
    const { page, perPage } = normalizePaginationParams(query.page, query.perPage);

    const where: Record<string, any> = {};
    if (name) where.name = name;
    if (initials) where.initials = initials.toLowerCase();
    if (enroll_middle) where.enroll_middle = enroll_middle;
    if (province) where.provinces = province;
    if (gender) where.gender = gender;

    if (Object.keys(where).length === 0) {
      const [oiers, total, version] = await Promise.all([
        this.db.oiers
          .orderBy('rank')
          .offset((page - 1) * perPage)
          .limit(perPage)
          .toArray(),
        this.db.oiers.count(),
        this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
      ]);

      return {
        oiers,
        total,
        totalPages: Math.ceil(total / perPage),
        page,
        perPage,
        data_version: version,
      };
    }

    // FIXME: Dexie 在 5.0 前尚不支持复合 orderBy 和 where 条件
    // const [oiers, total] = await Promise.all([
    //   this.db.oiers
    //     .where(where)
    //     .orderBy('rank')
    //     .offset((page - 1) * perPage)
    //     .limit(perPage)
    //     .toArray(),
    //   this.db.oiers.where(where).orderBy('rank').count(),
    // ]);
    const [oiers, total, version] = await Promise.all([
      this.db.oiers
        .where(where)
        .sortBy('rank')
        .then((arr) => arr.slice((page - 1) * perPage, page * perPage)),
      this.db.oiers.where(where).count(),
      this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
    ]);

    return {
      oiers,
      total,
      totalPages: Math.ceil(total / perPage),
      page,
      perPage,
      data_version: version,
    };
  }

  async getSchool(id: number): Promise<GetSchoolResponse | null> {
    const school = await this.db.schools.get(id);
    if (!school) {
      return null;
    }

    const records = await this.db.records.where('school_id').equals(id).toArray();
    const [members, contests, version] = await Promise.all([
      this.db.oiers
        .bulkGet(school.member_ids)
        .then((items) => items.filter((m): m is DbOIer => m !== undefined)),
      this.db.contests
        .bulkGet(Array.from(new Set(records.map((r) => r.contest_id))))
        .then((items) => items.filter((c): c is DbContest => c !== undefined)),
      this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
    ]);

    return {
      id,
      school,
      members_map: Object.fromEntries(members.map((m) => [m.uid, m])),
      contests_map: Object.fromEntries(contests.map((c) => [c.id, c])),
      data_version: version,
    };
  }

  async listSchools(query: ListSchoolsQuery): Promise<ListSchoolsResponse> {
    const { name = null, province = null, city = null } = query;
    const { page, perPage } = normalizePaginationParams(query.page, query.perPage);

    const where: Record<string, any> = {};
    if (name) where.name = name;
    if (province) where.province = province;
    if (province && city) where.city = city;

    if (Object.keys(where).length === 0) {
      const [schools, total, version] = await Promise.all([
        this.db.schools
          .orderBy('rank')
          .offset((page - 1) * perPage)
          .limit(perPage)
          .toArray(),
        this.db.schools.count(),
        this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
      ]);

      return {
        schools,
        total,
        totalPages: Math.ceil(total / perPage),
        page,
        perPage,
        data_version: version,
      };
    }

    // FIXME: Dexie 在 5.0 前尚不支持复合 orderBy 和 where 条件
    // const [schools, total] = await Promise.all([
    //   this.db.schools
    //     .where(where)
    //     .orderBy('rank')
    //     .offset((page - 1) * perPage)
    //     .limit(perPage)
    //     .toArray(),
    //   this.db.schools.where(where).orderBy('rank').count(),
    // ]);
    const [schools, total, version] = await Promise.all([
      this.db.schools
        .where(where)
        .sortBy('rank')
        .then((arr) => arr.slice((page - 1) * perPage, page * perPage)),
      this.db.schools.where(where).count(),
      this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
    ]);

    return {
      schools,
      total,
      totalPages: Math.ceil(total / perPage),
      page,
      perPage,
      data_version: version,
    };
  }

  async getContest(
    id: number,
    _page?: number,
    _perPage?: number,
  ): Promise<GetContestResponse | null> {
    const contest = await this.db.contests.get(id);
    if (!contest) {
      return null;
    }

    const { page, perPage } = normalizePaginationParams(_page, _perPage);

    const [records, total] = await Promise.all([
      this.db.records
        .where('[contest_id+rank]')
        .between([id, Dexie.minKey], [id, Dexie.maxKey], true, true)
        .offset((page - 1) * perPage)
        .limit(perPage)
        .toArray(),
      this.db.records.where('contest_id').equals(id).count(),
    ]);

    const school_ids = Array.from(new Set(records.map((r) => r.school_id)));
    const uids = Array.from(new Set(records.map((r) => r.uid)));
    const [schools, oiers, version] = await Promise.all([
      this.db.schools
        .bulkGet(school_ids)
        .then((items) => items.filter((s): s is DbSchool => s !== undefined)),
      this.db.oiers
        .bulkGet(uids)
        .then((items) => items.filter((o): o is DbOIer => o !== undefined)),
      this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
    ]);

    return {
      id,
      contest,
      records,
      schools_map: Object.fromEntries(schools.map((s) => [s.id, s])),
      oiers_map: Object.fromEntries(oiers.map((o) => [o.uid, o])),
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
      data_version: version,
    };
  }

  async listContests(query: ListContestsQuery): Promise<ListContestsResponse> {
    const { type = null, year = null } = query;
    const { page, perPage } = normalizePaginationParams(query.page, query.perPage);

    const where: Record<string, any> = {};
    if (type) where.type = type;
    if (year) where.year = year;

    if (Object.keys(where).length === 0) {
      const [contests, total, version] = await Promise.all([
        this.db.contests
          .orderBy('id')
          .reverse()
          .offset((page - 1) * perPage)
          .limit(perPage)
          .toArray(),
        this.db.contests.count(),
        this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
      ]);

      return {
        contests,
        total,
        totalPages: Math.ceil(total / perPage),
        page,
        perPage,
        data_version: version,
      };
    }

    // FIXME: Dexie 在 5.0 前尚不支持复合 orderBy 和 where 条件
    // const [contests, total] = await Promise.all([
    //   this.db.contests
    //     .where(where)
    //     .orderBy('id')
    //     .reverse()
    //     .offset((page - 1) * perPage)
    //     .limit(perPage)
    //     .toArray(),
    //   this.db.contests.where(where).orderBy('id').reverse().count(),
    // ]);
    const [contests, total, version] = await Promise.all([
      this.db.contests
        .where(where)
        .sortBy('id')
        .then((arr) => arr.reverse().slice((page - 1) * perPage, page * perPage)),
      this.db.contests.where(where).count(),
      this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
    ]);

    return {
      contests,
      total,
      totalPages: Math.ceil(total / perPage),
      page,
      perPage,
      data_version: version,
    };
  }
}
