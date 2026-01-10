import type {
  DbContest,
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

import { AsyncDatabase } from './async-database';
import { META_KEY_DATA_VERSION, META_KEY_LOADING_PROGRESS } from './constants';
import { normalizePaginationParams } from './util';

export class SQLiteAdapter implements IAdapterWithLoader {
  private db: AsyncDatabase;

  constructor() {
    this.db = new AsyncDatabase(':memory:');
  }

  async initialize(): Promise<void> {
    // Create schema
    await this.createSchema();
  }

  private async createSchema(): Promise<void> {
    // Create tables and indexes
    await this.db.exec(`
      CREATE TABLE oiers (
        uid INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        lowered_name TEXT NOT NULL,
        initials TEXT NOT NULL,
        enroll_middle INTEGER NOT NULL,
        gender INTEGER NOT NULL,
        oierdb_score REAL NOT NULL,
        ccf_level INTEGER NOT NULL,
        ccf_score REAL NOT NULL,
        rank INTEGER NOT NULL
      );

      CREATE INDEX idx_oiers_name ON oiers(name);
      CREATE INDEX idx_oiers_lowered_name ON oiers(lowered_name);
      CREATE INDEX idx_oiers_initials ON oiers(initials);
      CREATE INDEX idx_oiers_enroll_middle ON oiers(enroll_middle);
      CREATE INDEX idx_oiers_gender ON oiers(gender);
      CREATE INDEX idx_oiers_rank ON oiers(rank);

      CREATE TABLE oier_provinces (
        uid INTEGER NOT NULL,
        province TEXT NOT NULL,
        PRIMARY KEY (uid, province),
        FOREIGN KEY (uid) REFERENCES oiers(uid)
      );

      CREATE INDEX idx_oier_provinces_province ON oier_provinces(province);

      CREATE TABLE oier_schools (
        uid INTEGER NOT NULL,
        school_id INTEGER NOT NULL,
        PRIMARY KEY (uid, school_id),
        FOREIGN KEY (uid) REFERENCES oiers(uid),
        FOREIGN KEY (school_id) REFERENCES schools(id)
      );

      CREATE INDEX idx_oier_schools_uid ON oier_schools(uid);
      CREATE INDEX idx_oier_schools_school_id ON oier_schools(school_id);

      CREATE TABLE oier_contests (
        uid INTEGER NOT NULL,
        contest_id INTEGER NOT NULL,
        PRIMARY KEY (uid, contest_id),
        FOREIGN KEY (uid) REFERENCES oiers(uid),
        FOREIGN KEY (contest_id) REFERENCES contests(id)
      );

      CREATE INDEX idx_oier_contests_uid ON oier_contests(uid);
      CREATE INDEX idx_oier_contests_contest_id ON oier_contests(contest_id);

      CREATE TABLE schools (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        province TEXT NOT NULL,
        city TEXT NOT NULL,
        score REAL NOT NULL,
        rank INTEGER NOT NULL,
        award_counts TEXT NOT NULL
      );

      CREATE INDEX idx_schools_name ON schools(name);
      CREATE INDEX idx_schools_province ON schools(province);
      CREATE INDEX idx_schools_city ON schools(city);
      CREATE INDEX idx_schools_rank ON schools(rank);
      CREATE INDEX idx_schools_province_city ON schools(province, city);

      CREATE TABLE contests (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        year INTEGER NOT NULL,
        type TEXT NOT NULL,
        fall_semester INTEGER NOT NULL,
        full_score REAL NOT NULL,
        capacity INTEGER,
        length INTEGER,
        level_counts TEXT NOT NULL
      );

      CREATE INDEX idx_contests_name ON contests(name);
      CREATE INDEX idx_contests_year ON contests(year);
      CREATE INDEX idx_contests_type ON contests(type);
      CREATE INDEX idx_contests_type_year ON contests(type, year);

      CREATE TABLE records (
        uid INTEGER NOT NULL,
        contest_id INTEGER NOT NULL,
        school_id INTEGER NOT NULL,
        level TEXT NOT NULL,
        score REAL NOT NULL,
        rank INTEGER NOT NULL,
        province TEXT NOT NULL,
        enroll_middle_is_stay_down INTEGER,
        enroll_middle_value INTEGER,
        PRIMARY KEY (uid, contest_id),
        FOREIGN KEY (uid) REFERENCES oiers(uid),
        FOREIGN KEY (contest_id) REFERENCES contests(id),
        FOREIGN KEY (school_id) REFERENCES schools(id)
      );

      CREATE INDEX idx_records_contest_id ON records(contest_id);
      CREATE INDEX idx_records_contest_id_rank ON records(contest_id, rank);
      CREATE INDEX idx_records_school_id ON records(school_id);
      CREATE INDEX idx_records_uid ON records(uid);
      CREATE INDEX idx_records_level ON records(level);
      CREATE INDEX idx_records_province ON records(province);

      CREATE TABLE meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  getType(): string {
    return 'sqlite';
  }

  // ==============================
  // Helper Methods for Metadata
  // ==============================

  private async getMetadata(key: string): Promise<string | null> {
    const result = await this.db.get<{ value: string }>(
      'SELECT value FROM meta WHERE key = ?',
      key,
    );
    return result?.value || null;
  }

  private async setMetadata(key: string, value: string): Promise<void> {
    await this.db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
  }

  private async clearAllData(): Promise<void> {
    await this.db.exec(`
      DELETE FROM oier_provinces;
      DELETE FROM oier_schools;
      DELETE FROM oier_contests;
      DELETE FROM records;
      DELETE FROM oiers;
      DELETE FROM schools;
      DELETE FROM contests;
      DELETE FROM meta;
    `);
  }

  // ==============================
  // IAdapterWithLoader Interface
  // ==============================

  async loadData(data: DbParseResult): Promise<void> {
    // Check if we need to start fresh (version change)
    const currentVersion = await this.getMetadata(META_KEY_DATA_VERSION);
    const needsReset = currentVersion !== data.data_version;

    if (needsReset) {
      await this.clearAllData();
    }

    // Load all data in a single transaction using serialize
    await this.db.serialize(async () => {
      await this.db.run('BEGIN TRANSACTION');

      try {
        // Set metadata
        await this.setMetadata(META_KEY_DATA_VERSION, data.data_version);
        await this.setMetadata(META_KEY_LOADING_PROGRESS, 'loading');

        // Insert oiers and their relationships
        for (const oier of data.oiers) {
          await this.db.run(
            `INSERT INTO oiers (uid, name, lowered_name, initials, enroll_middle, gender,
                               oierdb_score, ccf_level, ccf_score, rank)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            oier.uid,
            oier.name,
            oier.lowered_name,
            oier.initials,
            oier.enroll_middle,
            oier.gender,
            oier.oierdb_score,
            oier.ccf_level,
            oier.ccf_score,
            oier.rank,
          );

          // Insert provinces
          for (const province of oier.provinces) {
            await this.db.run(
              'INSERT INTO oier_provinces (uid, province) VALUES (?, ?)',
              oier.uid,
              province,
            );
          }

          // Insert schools
          for (const schoolId of oier.school_ids) {
            await this.db.run(
              'INSERT INTO oier_schools (uid, school_id) VALUES (?, ?)',
              oier.uid,
              schoolId,
            );
          }

          // Insert contests
          for (const contestId of oier.contest_ids) {
            await this.db.run(
              'INSERT INTO oier_contests (uid, contest_id) VALUES (?, ?)',
              oier.uid,
              contestId,
            );
          }
        }

        // Insert schools
        for (const school of data.schools) {
          await this.db.run(
            `INSERT INTO schools (id, name, province, city, score, rank, award_counts)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            school.id,
            school.name,
            school.province,
            school.city,
            school.score,
            school.rank,
            JSON.stringify(school.award_counts),
          );
        }

        // Insert contests
        for (const contest of data.contests) {
          await this.db.run(
            `INSERT INTO contests (id, name, year, type, fall_semester, full_score, capacity, length, level_counts)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            contest.id,
            contest.name,
            contest.year,
            contest.type,
            contest.fall_semester ? 1 : 0,
            contest.full_score,
            contest.capacity ?? null,
            contest.length ?? null,
            JSON.stringify(contest.level_counts),
          );
        }

        // Insert records
        for (const record of data.records) {
          await this.db.run(
            `INSERT INTO records (uid, contest_id, school_id, level, score, rank, province,
                                 enroll_middle_is_stay_down, enroll_middle_value)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            record.uid,
            record.contest_id,
            record.school_id,
            record.level,
            record.score,
            record.rank,
            record.province,
            record.enroll_middle ? (record.enroll_middle.is_stay_down ? 1 : 0) : null,
            record.enroll_middle?.value ?? null,
          );
        }

        // Validate counts
        const oiersCount = (await this.db.get<{ count: number }>(
          'SELECT COUNT(*) as count FROM oiers',
        ))!.count;
        const schoolsCount = (await this.db.get<{ count: number }>(
          'SELECT COUNT(*) as count FROM schools',
        ))!.count;
        const contestsCount = (await this.db.get<{ count: number }>(
          'SELECT COUNT(*) as count FROM contests',
        ))!.count;
        const recordsCount = (await this.db.get<{ count: number }>(
          'SELECT COUNT(*) as count FROM records',
        ))!.count;

        if (
          oiersCount !== data.oiers.length ||
          schoolsCount !== data.schools.length ||
          contestsCount !== data.contests.length ||
          recordsCount !== data.records.length
        ) {
          throw new Error(
            'Data validation failed: actual counts do not match expected counts. Data may be corrupted.',
          );
        }

        // Mark loading as complete
        await this.setMetadata(META_KEY_LOADING_PROGRESS, 'loaded');

        await this.db.run('COMMIT');
      } catch (error) {
        await this.db.run('ROLLBACK');
        throw error;
      }
    });
  }

  // ==============================
  // IAdapter Interface
  // ==============================

  async checkAvailability(targetVersion: string): Promise<boolean> {
    const version = await this.getMetadata(META_KEY_DATA_VERSION);
    const progress = await this.getMetadata(META_KEY_LOADING_PROGRESS);

    return version === targetVersion && progress === 'loaded';
  }

  async getVersion(): Promise<VersionResponse> {
    const version = (await this.getMetadata(META_KEY_DATA_VERSION)) || '';

    return {
      data_version: version,
    };
  }

  async getOIer(uid: number): Promise<GetOIerResponse | null> {
    const oier = await this.db.get<any>('SELECT * FROM oiers WHERE uid = ?', uid);

    if (!oier) {
      return null;
    }

    // Reconstruct arrays from junction tables
    const provinces = await this.db.all<{ province: string }>(
      'SELECT province FROM oier_provinces WHERE uid = ? ORDER BY province',
      uid,
    );

    const schoolIds = await this.db.all<{ school_id: number }>(
      'SELECT school_id FROM oier_schools WHERE uid = ? ORDER BY school_id',
      uid,
    );

    const contestIds = await this.db.all<{ contest_id: number }>(
      'SELECT contest_id FROM oier_contests WHERE uid = ? ORDER BY contest_id',
      uid,
    );

    oier.provinces = provinces.map((p) => p.province);
    oier.school_ids = schoolIds.map((s) => s.school_id);
    oier.contest_ids = contestIds.map((c) => c.contest_id);

    // Get records
    const records = await this.db.all<any>('SELECT * FROM records WHERE uid = ?', uid);

    // Reconstruct enroll_middle objects
    const reconstructedRecords: DbRecord[] = records.map((r) => ({
      uid: r.uid,
      contest_id: r.contest_id,
      school_id: r.school_id,
      level: r.level,
      score: r.score,
      rank: r.rank,
      province: r.province,
      enroll_middle:
        r.enroll_middle_is_stay_down !== null && r.enroll_middle_value !== null
          ? {
              is_stay_down: r.enroll_middle_is_stay_down === 1,
              value: r.enroll_middle_value,
            }
          : undefined,
    }));

    // Get schools
    const schools =
      oier.school_ids.length > 0
        ? await this.db.all<any>(
            `SELECT * FROM schools WHERE id IN (${oier.school_ids.map(() => '?').join(',')})`,
            ...oier.school_ids,
          )
        : [];

    const schoolsMap: Record<number, DbSchool> = {};
    for (const school of schools) {
      const memberIds = await this.db.all<{ uid: number }>(
        'SELECT uid FROM oier_schools WHERE school_id = ? ORDER BY uid',
        school.id,
      );

      schoolsMap[school.id] = {
        ...school,
        award_counts: JSON.parse(school.award_counts),
        member_ids: memberIds.map((m) => m.uid),
      };
    }

    // Get contests
    const contests =
      oier.contest_ids.length > 0
        ? await this.db.all<any>(
            `SELECT * FROM contests WHERE id IN (${oier.contest_ids.map(() => '?').join(',')})`,
            ...oier.contest_ids,
          )
        : [];

    const contestsMap: Record<number, DbContest> = {};
    for (const contest of contests) {
      const contestantIds = await this.db.all<{ uid: number }>(
        'SELECT uid FROM oier_contests WHERE contest_id = ? ORDER BY uid',
        contest.id,
      );

      contestsMap[contest.id] = {
        ...contest,
        fall_semester: contest.fall_semester === 1,
        level_counts: JSON.parse(contest.level_counts),
        contestant_ids: contestantIds.map((c) => c.uid),
      };
    }

    const version = (await this.getMetadata(META_KEY_DATA_VERSION)) || '';

    return {
      uid,
      oier,
      records: reconstructedRecords,
      schools_map: schoolsMap,
      contests_map: contestsMap,
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

    let sql = 'SELECT o.* FROM oiers o';
    const params: any[] = [];
    const whereClauses: string[] = [];

    // Handle province filter (requires JOIN)
    if (province) {
      sql += ' INNER JOIN oier_provinces op ON o.uid = op.uid';
      whereClauses.push('op.province = ?');
      params.push(province);
    }

    // Add other filters
    if (name) {
      whereClauses.push('o.name = ?');
      params.push(name);
    }
    if (initials) {
      whereClauses.push('o.initials = ?');
      params.push(initials.toLowerCase());
    }
    if (enroll_middle) {
      whereClauses.push('o.enroll_middle = ?');
      params.push(enroll_middle);
    }
    if (gender !== null && gender !== undefined) {
      whereClauses.push('o.gender = ?');
      params.push(gender);
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Add ordering and pagination
    sql += ' ORDER BY o.rank LIMIT ? OFFSET ?';
    params.push(perPage, (page - 1) * perPage);

    const oiers = await this.db.all<any>(sql, ...params);

    // Count total (remove LIMIT/OFFSET for count)
    let countSql = sql
      .replace(/SELECT o\.\*/, 'SELECT COUNT(DISTINCT o.uid) as count')
      .replace(/ ORDER BY.*$/, '');
    const countParams = params.slice(0, -2); // Remove LIMIT and OFFSET params
    const totalResult = await this.db.get<{ count: number }>(countSql, ...countParams);
    const total = totalResult!.count;

    // Reconstruct arrays for each oier
    const reconstructedOiers: DbOIer[] = await Promise.all(
      oiers.map(async (oier) => {
        const provinces = await this.db.all<{ province: string }>(
          'SELECT province FROM oier_provinces WHERE uid = ? ORDER BY province',
          oier.uid,
        );

        const schoolIds = await this.db.all<{ school_id: number }>(
          'SELECT school_id FROM oier_schools WHERE uid = ? ORDER BY school_id',
          oier.uid,
        );

        const contestIds = await this.db.all<{ contest_id: number }>(
          'SELECT contest_id FROM oier_contests WHERE uid = ? ORDER BY contest_id',
          oier.uid,
        );

        return {
          ...oier,
          provinces: provinces.map((p) => p.province),
          school_ids: schoolIds.map((s) => s.school_id),
          contest_ids: contestIds.map((c) => c.contest_id),
        };
      }),
    );

    const version = (await this.getMetadata(META_KEY_DATA_VERSION)) || '';

    return {
      oiers: reconstructedOiers,
      total,
      totalPages: Math.ceil(total / perPage),
      page,
      perPage,
      data_version: version,
    };
  }

  async getSchool(id: number): Promise<GetSchoolResponse | null> {
    const school = await this.db.get<any>('SELECT * FROM schools WHERE id = ?', id);

    if (!school) {
      return null;
    }

    // Reconstruct member_ids from junction table
    const memberIds = await this.db.all<{ uid: number }>(
      'SELECT uid FROM oier_schools WHERE school_id = ? ORDER BY uid',
      id,
    );

    const reconstructedSchool: DbSchool = {
      ...school,
      award_counts: JSON.parse(school.award_counts),
      member_ids: memberIds.map((m) => m.uid),
    };

    // Get all records for this school
    const records = await this.db.all<any>('SELECT * FROM records WHERE school_id = ?', id);

    // Get members
    const members =
      reconstructedSchool.member_ids.length > 0
        ? await this.db.all<any>(
            `SELECT * FROM oiers WHERE uid IN (${reconstructedSchool.member_ids.map(() => '?').join(',')})`,
            ...reconstructedSchool.member_ids,
          )
        : [];

    const membersMap: Record<number, DbOIer> = {};
    for (const member of members) {
      const provinces = await this.db.all<{ province: string }>(
        'SELECT province FROM oier_provinces WHERE uid = ? ORDER BY province',
        member.uid,
      );

      const schoolIds = await this.db.all<{ school_id: number }>(
        'SELECT school_id FROM oier_schools WHERE uid = ? ORDER BY school_id',
        member.uid,
      );

      const contestIds = await this.db.all<{ contest_id: number }>(
        'SELECT contest_id FROM oier_contests WHERE uid = ? ORDER BY contest_id',
        member.uid,
      );

      membersMap[member.uid] = {
        ...member,
        provinces: provinces.map((p) => p.province),
        school_ids: schoolIds.map((s) => s.school_id),
        contest_ids: contestIds.map((c) => c.contest_id),
      };
    }

    // Get unique contest IDs from records
    const contestIds = Array.from(new Set(records.map((r) => r.contest_id)));

    // Get contests
    const contests =
      contestIds.length > 0
        ? await this.db.all<any>(
            `SELECT * FROM contests WHERE id IN (${contestIds.map(() => '?').join(',')})`,
            ...contestIds,
          )
        : [];

    const contestsMap: Record<number, DbContest> = {};
    for (const contest of contests) {
      const contestantIds = await this.db.all<{ uid: number }>(
        'SELECT uid FROM oier_contests WHERE contest_id = ? ORDER BY uid',
        contest.id,
      );

      contestsMap[contest.id] = {
        ...contest,
        fall_semester: contest.fall_semester === 1,
        level_counts: JSON.parse(contest.level_counts),
        contestant_ids: contestantIds.map((c) => c.uid),
      };
    }

    const version = (await this.getMetadata(META_KEY_DATA_VERSION)) || '';

    return {
      id,
      school: reconstructedSchool,
      members_map: membersMap,
      contests_map: contestsMap,
      data_version: version,
    };
  }

  async listSchools(query: ListSchoolsQuery): Promise<ListSchoolsResponse> {
    const { name = null, province = null, city = null } = query;
    const { page, perPage } = normalizePaginationParams(query.page, query.perPage);

    let sql = 'SELECT * FROM schools';
    const params: any[] = [];
    const whereClauses: string[] = [];

    if (name) {
      whereClauses.push('name LIKE ?');
      params.push(`%${name}%`);
    }
    if (province) {
      whereClauses.push('province = ?');
      params.push(province);
    }
    if (province && city) {
      whereClauses.push('city = ?');
      params.push(city);
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ' ORDER BY rank LIMIT ? OFFSET ?';
    params.push(perPage, (page - 1) * perPage);

    const schools = await this.db.all<any>(sql, ...params);

    // Count total
    let countSql = sql.replace(/SELECT \*/, 'SELECT COUNT(*) as count').replace(/ ORDER BY.*$/, '');
    const countParams = params.slice(0, -2);
    const totalResult = await this.db.get<{ count: number }>(countSql, ...countParams);
    const total = totalResult!.count;

    // Reconstruct member_ids for each school
    const reconstructedSchools: DbSchool[] = await Promise.all(
      schools.map(async (school) => {
        const memberIds = await this.db.all<{ uid: number }>(
          'SELECT uid FROM oier_schools WHERE school_id = ? ORDER BY uid',
          school.id,
        );

        return {
          ...school,
          award_counts: JSON.parse(school.award_counts),
          member_ids: memberIds.map((m) => m.uid),
        };
      }),
    );

    const version = (await this.getMetadata(META_KEY_DATA_VERSION)) || '';

    return {
      schools: reconstructedSchools,
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
    const contest = await this.db.get<any>('SELECT * FROM contests WHERE id = ?', id);

    if (!contest) {
      return null;
    }

    // Reconstruct contestant_ids from junction table
    const contestantIds = await this.db.all<{ uid: number }>(
      'SELECT uid FROM oier_contests WHERE contest_id = ? ORDER BY uid',
      id,
    );

    const reconstructedContest: DbContest = {
      ...contest,
      fall_semester: contest.fall_semester === 1,
      level_counts: JSON.parse(contest.level_counts),
      contestant_ids: contestantIds.map((c) => c.uid),
    };

    const { page, perPage } = normalizePaginationParams(_page, _perPage);

    // Get records with pagination
    const records = await this.db.all<any>(
      'SELECT * FROM records WHERE contest_id = ? ORDER BY rank LIMIT ? OFFSET ?',
      id,
      perPage,
      (page - 1) * perPage,
    );

    const totalResult = await this.db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM records WHERE contest_id = ?',
      id,
    );
    const total = totalResult!.count;

    // Reconstruct enroll_middle objects
    const reconstructedRecords: DbRecord[] = records.map((r) => ({
      uid: r.uid,
      contest_id: r.contest_id,
      school_id: r.school_id,
      level: r.level,
      score: r.score,
      rank: r.rank,
      province: r.province,
      enroll_middle:
        r.enroll_middle_is_stay_down !== null && r.enroll_middle_value !== null
          ? {
              is_stay_down: r.enroll_middle_is_stay_down === 1,
              value: r.enroll_middle_value,
            }
          : undefined,
    }));

    // Get unique school and oier IDs from records
    const schoolIds = Array.from(new Set(records.map((r) => r.school_id)));
    const uids = Array.from(new Set(records.map((r) => r.uid)));

    // Get schools
    const schools =
      schoolIds.length > 0
        ? await this.db.all<any>(
            `SELECT * FROM schools WHERE id IN (${schoolIds.map(() => '?').join(',')})`,
            ...schoolIds,
          )
        : [];

    const schoolsMap: Record<number, DbSchool> = {};
    for (const school of schools) {
      const memberIds = await this.db.all<{ uid: number }>(
        'SELECT uid FROM oier_schools WHERE school_id = ? ORDER BY uid',
        school.id,
      );

      schoolsMap[school.id] = {
        ...school,
        award_counts: JSON.parse(school.award_counts),
        member_ids: memberIds.map((m) => m.uid),
      };
    }

    // Get oiers
    const oiers =
      uids.length > 0
        ? await this.db.all<any>(
            `SELECT * FROM oiers WHERE uid IN (${uids.map(() => '?').join(',')})`,
            ...uids,
          )
        : [];

    const oiersMap: Record<number, DbOIer> = {};
    for (const oier of oiers) {
      const provinces = await this.db.all<{ province: string }>(
        'SELECT province FROM oier_provinces WHERE uid = ? ORDER BY province',
        oier.uid,
      );

      const schoolIds = await this.db.all<{ school_id: number }>(
        'SELECT school_id FROM oier_schools WHERE uid = ? ORDER BY school_id',
        oier.uid,
      );

      const contestIds = await this.db.all<{ contest_id: number }>(
        'SELECT contest_id FROM oier_contests WHERE uid = ? ORDER BY contest_id',
        oier.uid,
      );

      oiersMap[oier.uid] = {
        ...oier,
        provinces: provinces.map((p) => p.province),
        school_ids: schoolIds.map((s) => s.school_id),
        contest_ids: contestIds.map((c) => c.contest_id),
      };
    }

    const version = (await this.getMetadata(META_KEY_DATA_VERSION)) || '';

    return {
      id,
      contest: reconstructedContest,
      records: reconstructedRecords,
      schools_map: schoolsMap,
      oiers_map: oiersMap,
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

    let sql = 'SELECT * FROM contests';
    const params: any[] = [];
    const whereClauses: string[] = [];

    if (type) {
      whereClauses.push('type = ?');
      params.push(type);
    }
    if (year) {
      whereClauses.push('year = ?');
      params.push(year);
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(perPage, (page - 1) * perPage);

    const contests = await this.db.all<any>(sql, ...params);

    // Count total
    let countSql = sql.replace(/SELECT \*/, 'SELECT COUNT(*) as count').replace(/ ORDER BY.*$/, '');
    const countParams = params.slice(0, -2);
    const totalResult = await this.db.get<{ count: number }>(countSql, ...countParams);
    const total = totalResult!.count;

    // Reconstruct contestant_ids for each contest
    const reconstructedContests: DbContest[] = await Promise.all(
      contests.map(async (contest) => {
        const contestantIds = await this.db.all<{ uid: number }>(
          'SELECT uid FROM oier_contests WHERE contest_id = ? ORDER BY uid',
          contest.id,
        );

        return {
          ...contest,
          fall_semester: contest.fall_semester === 1,
          level_counts: JSON.parse(contest.level_counts),
          contestant_ids: contestantIds.map((c) => c.uid),
        };
      }),
    );

    const version = (await this.getMetadata(META_KEY_DATA_VERSION)) || '';

    return {
      contests: reconstructedContests,
      total,
      totalPages: Math.ceil(total / perPage),
      page,
      perPage,
      data_version: version,
    };
  }
}
