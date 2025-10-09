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
import { Dexie, type EntityTable } from 'dexie';

import { DB_NAME, DB_VERSION, META_KEY_DATA_VERSION } from './constants';
import { normalizePaginationParams, whereClauseToFilter } from './util';

interface OIerDbDexie extends Dexie {
  oiers: EntityTable<DbOIer, 'uid'>;
  schools: EntityTable<DbSchool, 'id'>;
  contests: EntityTable<DbContest, 'id'>;
  records: EntityTable<DbRecord, 'uid' | 'contest_id'>;
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
      schools: 'id, name, province, city, rank',
      contests: 'id, name, year, type',
      records: '[uid+contest_id], contest_id, school_id, uid, level, province',
      meta: 'key',
    });
  }

  // ==============================
  // IAdapterWithLoader Interface
  // ==============================
  async loadData(data: DbParseResult): Promise<void> {
    await this.db.transaction(
      'readwrite',
      [this.db.oiers, this.db.schools, this.db.contests, this.db.records, this.db.meta],
      async (tx) => {
        await tx.oiers.clear();
        await tx.oiers.bulkAdd(data.oiers);

        await tx.schools.clear();
        await tx.schools.bulkAdd(data.schools);

        await tx.contests.clear();
        await tx.contests.bulkAdd(data.contests);

        await tx.records.clear();
        await tx.records.bulkAdd(data.records);

        await tx.meta.clear();
        await tx.meta.bulkAdd(Object.entries(data.meta).map(([key, value]) => ({ key, value })));
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
      this.db.schools.where('id').anyOf(oier.school_ids).toArray(),
      this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
    ]);
    const contests = await this.db.contests
      .where('id')
      .anyOf(records.map((r) => r.contest_id))
      .toArray();

    return {
      uid,
      oier,
      records,
      schools_map: Object.fromEntries(schools.map((s) => [s.id, s])),
      contests_map: Object.fromEntries(contests.map((c) => [c.id, c])),
      backend_data_version: version,
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
    if (initials) where.initials = initials;
    if (enroll_middle) where.enroll_middle = enroll_middle;
    if (gender) where.gender = gender;
    if (province) where.province = province;

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
        .orderBy('rank')
        .filter(whereClauseToFilter(where))
        .offset((page - 1) * perPage)
        .limit(perPage)
        .toArray(),
      this.db.oiers.orderBy('rank').filter(whereClauseToFilter(where)).count(),
      this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
    ]);

    return {
      oiers,
      total,
      totalPages: Math.ceil(total / perPage),
      page,
      perPage,
      backend_data_version: version,
    };
  }

  async getSchool(id: number): Promise<GetSchoolResponse | null> {
    const school = await this.db.schools.get(id);
    if (!school) {
      return null;
    }

    const contest_ids = await this.db.records
      .where('school_id')
      .equals(id)
      .toArray()
      .then((records) => records.map((r) => r.contest_id));
    const [members, contests, version] = await Promise.all([
      this.db.oiers.where('uid').anyOf(school.member_ids).toArray(),
      this.db.contests.where('id').anyOf(contest_ids).toArray(),
      this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
    ]);

    return {
      id,
      school,
      members_map: Object.fromEntries(members.map((m) => [m.uid, m])),
      contests_map: Object.fromEntries(contests.map((c) => [c.id, c])),
      backend_data_version: version,
    };
  }

  async listSchools(query: ListSchoolsQuery): Promise<ListSchoolsResponse> {
    const { name = null, province = null, city = null } = query;
    const { page, perPage } = normalizePaginationParams(query.page, query.perPage);

    const where: Record<string, any> = {};
    if (name) where.name = name;
    if (province) where.province = province;
    if (city) where.city = city;

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
        .orderBy('rank')
        .filter(whereClauseToFilter(where))
        .offset((page - 1) * perPage)
        .limit(perPage)
        .toArray(),
      this.db.schools.orderBy('rank').filter(whereClauseToFilter(where)).count(),
      this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
    ]);

    return {
      schools,
      total,
      totalPages: Math.ceil(total / perPage),
      page,
      perPage,
      backend_data_version: version,
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
      this.db.schools.where('id').anyOf(school_ids).toArray(),
      this.db.oiers.where('uid').anyOf(uids).toArray(),
      this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
    ]);

    return {
      id,
      contest,
      records,
      schools: Object.fromEntries(schools.map((s) => [s.id, s])),
      oiers: Object.fromEntries(oiers.map((o) => [o.uid, o])),
      backend_data_version: version,
    };
  }

  async listContests(query: ListContestsQuery): Promise<ListContestsResponse> {
    const { type = null, year = null } = query;
    const { page, perPage } = normalizePaginationParams(query.page, query.perPage);

    const where: Record<string, any> = {};
    if (type) where.type = type;
    if (year) where.year = year;

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
        .orderBy('id')
        .reverse()
        .filter(whereClauseToFilter(where))
        .offset((page - 1) * perPage)
        .limit(perPage)
        .toArray(),
      this.db.contests.orderBy('id').reverse().filter(whereClauseToFilter(where)).count(),
      this.db.meta.get(META_KEY_DATA_VERSION).then((meta) => meta?.value || ''),
    ]);

    return {
      contests,
      total,
      totalPages: Math.ceil(total / perPage),
      page,
      perPage,
      backend_data_version: version,
    };
  }
}
