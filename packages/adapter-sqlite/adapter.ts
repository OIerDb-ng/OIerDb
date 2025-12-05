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
import { DatabaseSync } from 'node:sqlite';

import { META_KEY_DATA_VERSION, META_KEY_LOADING_PROGRESS } from './constants';
import { normalizePaginationParams } from './util';

export class SQLiteAdapter implements IAdapterWithLoader {
  private db: DatabaseSync;

  constructor() {
    // Initialize :memory: database
    this.db = new DatabaseSync(':memory:');

    // Create schema
    this.createSchema();
  }

  private createSchema(): void {
    // Create tables
    this.db.exec(`
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
        length INTEGER NOT NULL,
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

  private getMetadata(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM meta WHERE key = ?');
    const result = stmt.get(key) as { value: string } | undefined;
    return result?.value || null;
  }

  private setMetadata(key: string, value: string): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
    stmt.run(key, value);
  }

  private clearAllData(): void {
    this.db.exec(`
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
    const currentVersion = this.getMetadata(META_KEY_DATA_VERSION);
    const needsReset = currentVersion !== data.data_version;

    if (needsReset) {
      this.clearAllData();
    }

    // Load all data in a single transaction
    this.db.exec('BEGIN TRANSACTION');

    try {
      // Set metadata
      this.setMetadata(META_KEY_DATA_VERSION, data.data_version);
      this.setMetadata(META_KEY_LOADING_PROGRESS, 'loading');

      // Prepare statements
      const insertOier = this.db.prepare(`
        INSERT INTO oiers (uid, name, lowered_name, initials, enroll_middle, gender,
                           oierdb_score, ccf_level, ccf_score, rank)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertOierProvince = this.db.prepare(
        'INSERT INTO oier_provinces (uid, province) VALUES (?, ?)',
      );
      const insertOierSchool = this.db.prepare(
        'INSERT INTO oier_schools (uid, school_id) VALUES (?, ?)',
      );
      const insertOierContest = this.db.prepare(
        'INSERT INTO oier_contests (uid, contest_id) VALUES (?, ?)',
      );
      const insertSchool = this.db.prepare(`
        INSERT INTO schools (id, name, province, city, score, rank, award_counts)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const insertContest = this.db.prepare(`
        INSERT INTO contests (id, name, year, type, fall_semester, full_score, capacity, length, level_counts)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertRecord = this.db.prepare(`
        INSERT INTO records (uid, contest_id, school_id, level, score, rank, province,
                             enroll_middle_is_stay_down, enroll_middle_value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Insert oiers and their relationships
      for (const oier of data.oiers) {
        insertOier.run(
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
          insertOierProvince.run(oier.uid, province);
        }

        // Insert schools
        for (const schoolId of oier.school_ids) {
          insertOierSchool.run(oier.uid, schoolId);
        }

        // Insert contests
        for (const contestId of oier.contest_ids) {
          insertOierContest.run(oier.uid, contestId);
        }
      }

      // Insert schools
      for (const school of data.schools) {
        insertSchool.run(
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
        insertContest.run(
          contest.id,
          contest.name,
          contest.year,
          contest.type,
          contest.fall_semester ? 1 : 0,
          contest.full_score,
          contest.capacity ?? null,
          contest.length,
          JSON.stringify(contest.level_counts),
        );
      }

      // Insert records
      for (const record of data.records) {
        insertRecord.run(
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
      const oiersCount = (
        this.db.prepare('SELECT COUNT(*) as count FROM oiers').get() as { count: number }
      ).count;
      const schoolsCount = (
        this.db.prepare('SELECT COUNT(*) as count FROM schools').get() as { count: number }
      ).count;
      const contestsCount = (
        this.db.prepare('SELECT COUNT(*) as count FROM contests').get() as { count: number }
      ).count;
      const recordsCount = (
        this.db.prepare('SELECT COUNT(*) as count FROM records').get() as { count: number }
      ).count;

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
      this.setMetadata(META_KEY_LOADING_PROGRESS, 'loaded');

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  // ==============================
  // IAdapter Interface
  // ==============================

  async checkAvailability(targetVersion: string): Promise<boolean> {
    const version = this.getMetadata(META_KEY_DATA_VERSION);
    const progress = this.getMetadata(META_KEY_LOADING_PROGRESS);

    return version === targetVersion && progress === 'loaded';
  }

  async getVersion(): Promise<VersionResponse> {
    const version = this.getMetadata(META_KEY_DATA_VERSION) || '';

    return {
      data_version: version,
    };
  }

  async getOIer(uid: number): Promise<GetOIerResponse | null> {
    const oier = this.db.prepare('SELECT * FROM oiers WHERE uid = ?').get(uid) as
      | DbOIer
      | undefined;

    if (!oier) {
      return null;
    }

    // Reconstruct arrays from junction tables
    const provinces = this.db
      .prepare('SELECT province FROM oier_provinces WHERE uid = ? ORDER BY province')
      .all(uid) as { province: string }[];

    const schoolIds = this.db
      .prepare('SELECT school_id FROM oier_schools WHERE uid = ? ORDER BY school_id')
      .all(uid) as { school_id: number }[];

    const contestIds = this.db
      .prepare('SELECT contest_id FROM oier_contests WHERE uid = ? ORDER BY contest_id')
      .all(uid) as { contest_id: number }[];

    oier.provinces = provinces.map((p) => p.province);
    oier.school_ids = schoolIds.map((s) => s.school_id);
    oier.contest_ids = contestIds.map((c) => c.contest_id);

    // Get records
    const records = this.db.prepare('SELECT * FROM records WHERE uid = ?').all(uid) as any[];

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
    const schools = this.db
      .prepare(`SELECT * FROM schools WHERE id IN (${oier.school_ids.map(() => '?').join(',')})`)
      .all(...oier.school_ids) as any[];

    const schoolsMap: Record<number, DbSchool> = {};
    for (const school of schools) {
      const memberIds = this.db
        .prepare('SELECT uid FROM oier_schools WHERE school_id = ? ORDER BY uid')
        .all(school.id) as { uid: number }[];

      schoolsMap[school.id] = {
        ...school,
        award_counts: JSON.parse(school.award_counts),
        member_ids: memberIds.map((m) => m.uid),
      };
    }

    // Get contests
    const contests = this.db
      .prepare(`SELECT * FROM contests WHERE id IN (${oier.contest_ids.map(() => '?').join(',')})`)
      .all(...oier.contest_ids) as any[];

    const contestsMap: Record<number, DbContest> = {};
    for (const contest of contests) {
      const contestantIds = this.db
        .prepare('SELECT uid FROM oier_contests WHERE contest_id = ? ORDER BY uid')
        .all(contest.id) as { uid: number }[];

      contestsMap[contest.id] = {
        ...contest,
        fall_semester: contest.fall_semester === 1,
        level_counts: JSON.parse(contest.level_counts),
        contestant_ids: contestantIds.map((c) => c.uid),
      };
    }

    const version = this.getMetadata(META_KEY_DATA_VERSION) || '';

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

    const oiers = this.db.prepare(sql).all(...params) as any[];

    // Count total (remove LIMIT/OFFSET for count)
    let countSql = sql
      .replace(/SELECT o\.\*/, 'SELECT COUNT(DISTINCT o.uid) as count')
      .replace(/ ORDER BY.*$/, '');
    const countParams = params.slice(0, -2); // Remove LIMIT and OFFSET params
    const totalResult = this.db.prepare(countSql).get(...countParams) as { count: number };
    const total = totalResult.count;

    // Reconstruct arrays for each oier
    const reconstructedOiers: DbOIer[] = oiers.map((oier) => {
      const provinces = this.db
        .prepare('SELECT province FROM oier_provinces WHERE uid = ? ORDER BY province')
        .all(oier.uid) as { province: string }[];

      const schoolIds = this.db
        .prepare('SELECT school_id FROM oier_schools WHERE uid = ? ORDER BY school_id')
        .all(oier.uid) as { school_id: number }[];

      const contestIds = this.db
        .prepare('SELECT contest_id FROM oier_contests WHERE uid = ? ORDER BY contest_id')
        .all(oier.uid) as { contest_id: number }[];

      return {
        ...oier,
        provinces: provinces.map((p) => p.province),
        school_ids: schoolIds.map((s) => s.school_id),
        contest_ids: contestIds.map((c) => c.contest_id),
      };
    });

    const version = this.getMetadata(META_KEY_DATA_VERSION) || '';

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
    const school = this.db.prepare('SELECT * FROM schools WHERE id = ?').get(id) as any;

    if (!school) {
      return null;
    }

    // Reconstruct member_ids from junction table
    const memberIds = this.db
      .prepare('SELECT uid FROM oier_schools WHERE school_id = ? ORDER BY uid')
      .all(id) as { uid: number }[];

    const reconstructedSchool: DbSchool = {
      ...school,
      award_counts: JSON.parse(school.award_counts),
      member_ids: memberIds.map((m) => m.uid),
    };

    // Get all records for this school
    const records = this.db.prepare('SELECT * FROM records WHERE school_id = ?').all(id) as any[];

    // Get members
    const members = this.db
      .prepare(
        `SELECT * FROM oiers WHERE uid IN (${reconstructedSchool.member_ids.map(() => '?').join(',')})`,
      )
      .all(...reconstructedSchool.member_ids) as any[];

    const membersMap: Record<number, DbOIer> = {};
    for (const member of members) {
      const provinces = this.db
        .prepare('SELECT province FROM oier_provinces WHERE uid = ? ORDER BY province')
        .all(member.uid) as { province: string }[];

      const schoolIds = this.db
        .prepare('SELECT school_id FROM oier_schools WHERE uid = ? ORDER BY school_id')
        .all(member.uid) as { school_id: number }[];

      const contestIds = this.db
        .prepare('SELECT contest_id FROM oier_contests WHERE uid = ? ORDER BY contest_id')
        .all(member.uid) as { contest_id: number }[];

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
    const contests = this.db
      .prepare(`SELECT * FROM contests WHERE id IN (${contestIds.map(() => '?').join(',')})`)
      .all(...contestIds) as any[];

    const contestsMap: Record<number, DbContest> = {};
    for (const contest of contests) {
      const contestantIds = this.db
        .prepare('SELECT uid FROM oier_contests WHERE contest_id = ? ORDER BY uid')
        .all(contest.id) as { uid: number }[];

      contestsMap[contest.id] = {
        ...contest,
        fall_semester: contest.fall_semester === 1,
        level_counts: JSON.parse(contest.level_counts),
        contestant_ids: contestantIds.map((c) => c.uid),
      };
    }

    const version = this.getMetadata(META_KEY_DATA_VERSION) || '';

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

    const schools = this.db.prepare(sql).all(...params) as any[];

    // Count total
    let countSql = sql.replace(/SELECT \*/, 'SELECT COUNT(*) as count').replace(/ ORDER BY.*$/, '');
    const countParams = params.slice(0, -2);
    const totalResult = this.db.prepare(countSql).get(...countParams) as { count: number };
    const total = totalResult.count;

    // Reconstruct member_ids for each school
    const reconstructedSchools: DbSchool[] = schools.map((school) => {
      const memberIds = this.db
        .prepare('SELECT uid FROM oier_schools WHERE school_id = ? ORDER BY uid')
        .all(school.id) as { uid: number }[];

      return {
        ...school,
        award_counts: JSON.parse(school.award_counts),
        member_ids: memberIds.map((m) => m.uid),
      };
    });

    const version = this.getMetadata(META_KEY_DATA_VERSION) || '';

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
    const contest = this.db.prepare('SELECT * FROM contests WHERE id = ?').get(id) as any;

    if (!contest) {
      return null;
    }

    // Reconstruct contestant_ids from junction table
    const contestantIds = this.db
      .prepare('SELECT uid FROM oier_contests WHERE contest_id = ? ORDER BY uid')
      .all(id) as { uid: number }[];

    const reconstructedContest: DbContest = {
      ...contest,
      fall_semester: contest.fall_semester === 1,
      level_counts: JSON.parse(contest.level_counts),
      contestant_ids: contestantIds.map((c) => c.uid),
    };

    const { page, perPage } = normalizePaginationParams(_page, _perPage);

    // Get records with pagination
    const records = this.db
      .prepare('SELECT * FROM records WHERE contest_id = ? ORDER BY rank LIMIT ? OFFSET ?')
      .all(id, perPage, (page - 1) * perPage) as any[];

    const totalResult = this.db
      .prepare('SELECT COUNT(*) as count FROM records WHERE contest_id = ?')
      .get(id) as {
      count: number;
    };
    const total = totalResult.count;

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
    const schools = this.db
      .prepare(`SELECT * FROM schools WHERE id IN (${schoolIds.map(() => '?').join(',')})`)
      .all(...schoolIds) as any[];

    const schoolsMap: Record<number, DbSchool> = {};
    for (const school of schools) {
      const memberIds = this.db
        .prepare('SELECT uid FROM oier_schools WHERE school_id = ? ORDER BY uid')
        .all(school.id) as { uid: number }[];

      schoolsMap[school.id] = {
        ...school,
        award_counts: JSON.parse(school.award_counts),
        member_ids: memberIds.map((m) => m.uid),
      };
    }

    // Get oiers
    const oiers = this.db
      .prepare(`SELECT * FROM oiers WHERE uid IN (${uids.map(() => '?').join(',')})`)
      .all(...uids) as any[];

    const oiersMap: Record<number, DbOIer> = {};
    for (const oier of oiers) {
      const provinces = this.db
        .prepare('SELECT province FROM oier_provinces WHERE uid = ? ORDER BY province')
        .all(oier.uid) as { province: string }[];

      const schoolIds = this.db
        .prepare('SELECT school_id FROM oier_schools WHERE uid = ? ORDER BY school_id')
        .all(oier.uid) as { school_id: number }[];

      const contestIds = this.db
        .prepare('SELECT contest_id FROM oier_contests WHERE uid = ? ORDER BY contest_id')
        .all(oier.uid) as { contest_id: number }[];

      oiersMap[oier.uid] = {
        ...oier,
        provinces: provinces.map((p) => p.province),
        school_ids: schoolIds.map((s) => s.school_id),
        contest_ids: contestIds.map((c) => c.contest_id),
      };
    }

    const version = this.getMetadata(META_KEY_DATA_VERSION) || '';

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

    const contests = this.db.prepare(sql).all(...params) as any[];

    // Count total
    let countSql = sql.replace(/SELECT \*/, 'SELECT COUNT(*) as count').replace(/ ORDER BY.*$/, '');
    const countParams = params.slice(0, -2);
    const totalResult = this.db.prepare(countSql).get(...countParams) as { count: number };
    const total = totalResult.count;

    // Reconstruct contestant_ids for each contest
    const reconstructedContests: DbContest[] = contests.map((contest) => {
      const contestantIds = this.db
        .prepare('SELECT uid FROM oier_contests WHERE contest_id = ? ORDER BY uid')
        .all(contest.id) as { uid: number }[];

      return {
        ...contest,
        fall_semester: contest.fall_semester === 1,
        level_counts: JSON.parse(contest.level_counts),
        contestant_ids: contestantIds.map((c) => c.uid),
      };
    });

    const version = this.getMetadata(META_KEY_DATA_VERSION) || '';

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
