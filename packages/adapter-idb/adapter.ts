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
} from '@oierdb/core';
import { Dexie, type EntityTable, type Table } from 'dexie';

import { DB_NAME, DB_VERSION, META_KEY_DATA_VERSION } from './constants';
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
      records: '[uid+contest_id], contest_id, school_id, uid, level, province',
      meta: 'key',
    });
  }

  // ==============================
  // IAdapterWithLoader Interface
  // ==============================

  async loadData(data: DbParseResult): Promise<void> {
    // TODO: load data incrementally

    const CHUNK_SIZE = 5000;

    const bulkAddInChunks = async <T, TKey, TInsertType = T>(
      table: Table<T, TKey, TInsertType>,
      items: readonly TInsertType[],
      chunkSize: number,
    ) => {
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        await table.bulkAdd(chunk);
      }
    };

    await this.db.transaction(
      'readwrite',
      [this.db.oiers, this.db.schools, this.db.contests, this.db.records, this.db.meta],
      async (tx) => {
        await Promise.all([
          tx.oiers.clear(),
          tx.schools.clear(),
          tx.contests.clear(),
          tx.records.clear(),
          tx.meta.clear(),
        ]);

        await Promise.all([
          bulkAddInChunks(tx.oiers, data.oiers, CHUNK_SIZE),
          bulkAddInChunks(tx.schools, data.schools, CHUNK_SIZE),
          bulkAddInChunks(tx.records, data.records, CHUNK_SIZE),
          tx.contests.bulkAdd(data.contests),
          tx.meta.bulkAdd(Object.entries(data.meta).map(([key, value]) => ({ key, value }))),
        ]);
      },
    );
  }

  // ==============================
  // IAdapter Interface
  // ==============================

  async checkAvailability(targetVersion: string): Promise<boolean> {
    return await this.db.meta
      .get(META_KEY_DATA_VERSION)
      .then((meta) => meta?.value === targetVersion);
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

  async getContest(id: number): Promise<GetContestResponse | null> {
    const contest = await this.db.contests.get(id);
    if (!contest) {
      return null;
    }

    const records = await this.db.records.where('contest_id').equals(id).toArray();
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
      schools: Object.fromEntries(schools.map((s) => [s.id, s])),
      oiers: Object.fromEntries(oiers.map((o) => [o.uid, o])),
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
