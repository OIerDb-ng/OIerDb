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
import {
  META_KEY_DATA_VERSION,
  META_KEY_LOADING_PROGRESS,
  normalizePaginationParams,
} from '@oierdb/core';
import { Dexie, type EntityTable, type Table } from 'dexie';

import { DB_NAME, DB_VERSION } from './constants';

const CHUNK_SIZE = 5000;

interface OIerDbDexie extends Dexie {
  oiers: EntityTable<DbOIer, 'uid'>;
  schools: EntityTable<DbSchool, 'id'>;
  contests: EntityTable<DbContest, 'id'>;
  records: Table<DbRecord, [number, number]>; // [uid, contest_id]
  meta: EntityTable<DbMetadata, 'key'>;
}

export class IDBAdapter implements IAdapterWithLoader {
  private db: OIerDbDexie;
  private cachedVersion: string | null = null;

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
  // Shared Helpers
  // ==============================

  private async getDataVersion(): Promise<string> {
    if (this.cachedVersion !== null) return this.cachedVersion;
    const meta = await this.db.meta.get(META_KEY_DATA_VERSION);
    return (this.cachedVersion = meta?.value || '');
  }

  private async bulkGetDefined<T>(
    table: { bulkGet(keys: readonly number[]): Promise<(T | undefined)[]> },
    keys: readonly number[],
  ): Promise<T[]> {
    const items = await table.bulkGet(keys);
    return items.filter((item): item is T => item !== undefined);
  }

  private async paginatedQuery<T, TKey, TInsertType>(
    table: Table<T, TKey, TInsertType>,
    where: Record<string, any>,
    sortField: string,
    sortDesc: boolean,
    page: number,
    perPage: number,
  ): Promise<{ items: T[]; total: number; totalPages: number }> {
    let items: T[];
    let total: number;

    if (Object.keys(where).length === 0) {
      const ordered = sortDesc ? table.orderBy(sortField).reverse() : table.orderBy(sortField);
      [items, total] = await Promise.all([
        ordered
          .offset((page - 1) * perPage)
          .limit(perPage)
          .toArray(),
        table.count(),
      ]);
    } else {
      // FIXME: Dexie 在 5.0 前尚不支持复合 orderBy 和 where 条件
      [items, total] = await Promise.all([
        table
          .where(where)
          .sortBy(sortField)
          .then((arr) => {
            if (sortDesc) arr.reverse();
            return arr.slice((page - 1) * perPage, page * perPage);
          }),
        table.where(where).count(),
      ]);
    }

    return { items, total, totalPages: Math.ceil(total / perPage) };
  }

  private async getLoadedOffset(key: string): Promise<number> {
    const meta = await this.db.meta.get(key);
    return meta ? parseInt(meta.value, 10) : 0;
  }

  private async setLoadedOffset(key: string, offset: number): Promise<void> {
    await this.db.meta.put({ key, value: offset.toString() });
  }

  private async loadTableIncrementally<T, TKey, TInsertType = T>(
    table: Table<T, TKey, TInsertType>,
    items: readonly TInsertType[],
    offsetKey: string,
    tableName: string,
  ): Promise<void> {
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

    // Load remaining data in chunks
    for (let i = loadedOffset; i < totalCount; i += CHUNK_SIZE) {
      const chunkEnd = Math.min(i + CHUNK_SIZE, totalCount);
      const chunk = items.slice(i, chunkEnd);

      // Load chunk and update offset in same transaction for consistency
      await this.db.transaction('readwrite', [table, this.db.meta], async (tx) => {
        await tx.table(table.name).bulkAdd(chunk);
        await tx.meta.put({ key: offsetKey, value: chunkEnd.toString() });
      });
    }
  }

  // ==============================
  // IAdapterWithLoader Interface
  // ==============================

  async loadData(data: DbParseResult): Promise<void> {
    const currentVersion = await this.getDataVersion();
    const needsReset = currentVersion !== data.data_version;

    if (needsReset) {
      // Single atomic transaction: clear data + initialize metadata
      await this.db.transaction(
        'readwrite',
        [this.db.oiers, this.db.schools, this.db.contests, this.db.records, this.db.meta],
        async (tx) => {
          await Promise.all([
            tx.oiers.clear(),
            tx.schools.clear(),
            tx.contests.clear(),
            tx.records.clear(),
          ]);
          await Promise.all([
            tx.meta.put({ key: META_KEY_DATA_VERSION, value: data.data_version }),
            tx.meta.put({ key: META_KEY_LOADING_PROGRESS, value: 'loading' }),
            tx.meta.put({ key: 'loaded_offset_oiers', value: '0' }),
            tx.meta.put({ key: 'loaded_offset_schools', value: '0' }),
            tx.meta.put({ key: 'loaded_offset_records', value: '0' }),
            tx.meta.put({ key: 'loaded_offset_contests', value: '0' }),
          ]);
        },
      );
    }

    // Load all tables in parallel
    await Promise.all([
      this.loadTableIncrementally(this.db.oiers, data.oiers, 'loaded_offset_oiers', 'oiers'),
      this.loadTableIncrementally(
        this.db.schools,
        data.schools,
        'loaded_offset_schools',
        'schools',
      ),
      this.loadTableIncrementally(
        this.db.records,
        data.records,
        'loaded_offset_records',
        'records',
      ),
      this.loadTableIncrementally(
        this.db.contests,
        data.contests,
        'loaded_offset_contests',
        'contests',
      ),
    ]);

    // Validate that actual counts match expected counts
    const expected: [{ count(): Promise<number> }, number, string][] = [
      [this.db.oiers, data.oiers.length, 'oiers'],
      [this.db.schools, data.schools.length, 'schools'],
      [this.db.records, data.records.length, 'records'],
      [this.db.contests, data.contests.length, 'contests'],
    ];
    const counts = await Promise.all(expected.map(([table]) => table.count()));
    for (let i = 0; i < expected.length; i++) {
      if (counts[i] !== expected[i][1]) {
        throw new Error(
          `Data validation failed for ${expected[i][2]}: expected ${expected[i][1]}, got ${counts[i]}.`,
        );
      }
    }

    // Mark loading as complete
    await this.db.meta.put({ key: META_KEY_LOADING_PROGRESS, value: 'loaded' });
    this.cachedVersion = data.data_version;
  }

  async checkAvailability(targetVersion: string): Promise<boolean> {
    const [versionMeta, progressMeta] = await Promise.all([
      this.db.meta.get(META_KEY_DATA_VERSION),
      this.db.meta.get(META_KEY_LOADING_PROGRESS),
    ]);

    const versionMatches = versionMeta?.value === targetVersion;
    const loadingComplete = progressMeta?.value === 'loaded';

    if (versionMatches && loadingComplete) {
      this.cachedVersion = targetVersion;
    }

    return versionMatches && loadingComplete;
  }

  async getVersion(): Promise<VersionResponse> {
    return { data_version: await this.getDataVersion() };
  }

  // ==============================
  // IAdapter Interface
  // ==============================

  async getOIer(uid: number): Promise<GetOIerResponse | null> {
    const oier = await this.db.oiers.get(uid);
    if (!oier) {
      return null;
    }

    const [records, schools, version] = await Promise.all([
      this.db.records.where('uid').equals(uid).toArray(),
      this.bulkGetDefined(this.db.schools, oier.school_ids),
      this.getDataVersion(),
    ]);
    const contests = await this.bulkGetDefined(
      this.db.contests,
      Array.from(new Set(records.map((r) => r.contest_id))),
    );

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
    if (gender != null) where.gender = gender;

    const [version, { items: oiers, total, totalPages }] = await Promise.all([
      this.getDataVersion(),
      this.paginatedQuery(this.db.oiers, where, 'rank', false, page, perPage),
    ]);

    return { oiers, total, totalPages, page, perPage, data_version: version };
  }

  async getSchool(id: number): Promise<GetSchoolResponse | null> {
    const school = await this.db.schools.get(id);
    if (!school) {
      return null;
    }

    // records, members, and version have no inter-dependencies — fetch in parallel
    const [records, members, version] = await Promise.all([
      this.db.records.where('school_id').equals(id).toArray(),
      this.bulkGetDefined(this.db.oiers, school.member_ids),
      this.getDataVersion(),
    ]);
    const contests = await this.bulkGetDefined(
      this.db.contests,
      Array.from(new Set(records.map((r) => r.contest_id))),
    );

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

    const [version, { items: schools, total, totalPages }] = await Promise.all([
      this.getDataVersion(),
      this.paginatedQuery(this.db.schools, where, 'rank', false, page, perPage),
    ]);

    return { schools, total, totalPages, page, perPage, data_version: version };
  }

  async getContest(
    id: number,
    _page?: number,
    _perPage?: number,
  ): Promise<GetContestResponse | null> {
    // Fetch contest and version in parallel — version doesn't depend on contest data
    const [contest, version] = await Promise.all([this.db.contests.get(id), this.getDataVersion()]);
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
    const [schools, oiers] = await Promise.all([
      this.bulkGetDefined(this.db.schools, school_ids),
      this.bulkGetDefined(this.db.oiers, uids),
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

    const [version, { items: contests, total, totalPages }] = await Promise.all([
      this.getDataVersion(),
      this.paginatedQuery(this.db.contests, where, 'id', true, page, perPage),
    ]);

    return { contests, total, totalPages, page, perPage, data_version: version };
  }
}
