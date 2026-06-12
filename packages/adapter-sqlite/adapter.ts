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

import {
  META_KEY_DATA_VERSION,
  META_KEY_LOADING_PROGRESS,
  normalizePaginationParams,
} from '@oierdb/core';
import { AsyncDatabase } from './async-database';

export class SQLiteAdapter implements IAdapterWithLoader {
  private db: AsyncDatabase;
  private cachedVersion: string | null = null;

  constructor() {
    this.db = new AsyncDatabase(':memory:');
  }

  async initialize(): Promise<void> {
    await this.createSchema();
  }

  private async createSchema(): Promise<void> {
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

  // ── Metadata Helpers ──────────────────────────────────────────

  private async getMetadata(key: string): Promise<string | null> {
    const result = await this.db.get<{ value: string }>(
      'SELECT value FROM meta WHERE key = ?',
      key,
    );
    return result?.value ?? null;
  }

  private async setMetadata(key: string, value: string): Promise<void> {
    await this.db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
  }

  private async getDataVersion(): Promise<string> {
    if (this.cachedVersion === null) {
      this.cachedVersion = (await this.getMetadata(META_KEY_DATA_VERSION)) || '';
    }
    return this.cachedVersion;
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

  // ── SQL Helpers ───────────────────────────────────────────────

  /** Builds a `column IN (?, ?, ...)` clause, returning [sql, params]. */
  private whereIn(column: string, ids: number[]): [string, number[]] {
    if (ids.length === 0) return ['1=0', []];
    return [`${column} IN (${ids.map(() => '?').join(',')})`, ids];
  }

  /** Fetches all rows from `table` where `column` matches one of `ids`. */
  private async fetchRows<T = any>(table: string, column: string, ids: number[]): Promise<T[]> {
    if (ids.length === 0) return [];
    const [clause, params] = this.whereIn(column, ids);
    return this.db.all<T>(`SELECT * FROM ${table} WHERE ${clause}`, ...params);
  }

  /** Groups rows by `keyField`, collecting `valueField` into arrays. */
  private groupBy<K, V>(
    rows: Record<string, any>[],
    keyField: string,
    valueField: string,
  ): Map<K, V[]> {
    const map = new Map<K, V[]>();
    for (const row of rows) {
      const key = row[keyField] as K;
      const value = row[valueField] as V;
      const arr = map.get(key) ?? [];
      arr.push(value);
      map.set(key, arr);
    }
    return map;
  }

  // ── Entity Reconstruction ─────────────────────────────────────

  private reconstructRecord(row: any): DbRecord {
    return {
      uid: row.uid,
      contest_id: row.contest_id,
      school_id: row.school_id,
      level: row.level,
      score: row.score,
      rank: row.rank,
      province: row.province,
      enroll_middle:
        row.enroll_middle_is_stay_down !== null && row.enroll_middle_value !== null
          ? {
              is_stay_down: row.enroll_middle_is_stay_down === 1,
              value: row.enroll_middle_value,
            }
          : undefined,
    };
  }

  /** Batch-reconstructs OIers from flat rows, fetching junction data in bulk. */
  private async reconstructOIers(rows: any[]): Promise<DbOIer[]> {
    if (rows.length === 0) return [];
    const uids = rows.map((r) => r.uid);

    const [pClause, pParams] = this.whereIn('uid', uids);
    const [sClause, sParams] = this.whereIn('uid', uids);
    const [cClause, cParams] = this.whereIn('uid', uids);

    const [provinces, schoolIds, contestIds] = await Promise.all([
      this.db.all<{ uid: number; province: string }>(
        `SELECT uid, province FROM oier_provinces WHERE ${pClause} ORDER BY uid, province`,
        ...pParams,
      ),
      this.db.all<{ uid: number; school_id: number }>(
        `SELECT uid, school_id FROM oier_schools WHERE ${sClause} ORDER BY uid, school_id`,
        ...sParams,
      ),
      this.db.all<{ uid: number; contest_id: number }>(
        `SELECT uid, contest_id FROM oier_contests WHERE ${cClause} ORDER BY uid, contest_id`,
        ...cParams,
      ),
    ]);

    const provincesByUid = this.groupBy<number, string>(provinces, 'uid', 'province');
    const schoolIdsByUid = this.groupBy<number, number>(schoolIds, 'uid', 'school_id');
    const contestIdsByUid = this.groupBy<number, number>(contestIds, 'uid', 'contest_id');

    return rows.map((row) => ({
      ...row,
      provinces: provincesByUid.get(row.uid) ?? [],
      school_ids: schoolIdsByUid.get(row.uid) ?? [],
      contest_ids: contestIdsByUid.get(row.uid) ?? [],
    }));
  }

  /** Batch-reconstructs Schools from flat rows, fetching member_ids in bulk. */
  private async reconstructSchools(rows: any[]): Promise<DbSchool[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);

    const [clause, params] = this.whereIn('school_id', ids);
    const memberRows = await this.db.all<{ school_id: number; uid: number }>(
      `SELECT school_id, uid FROM oier_schools WHERE ${clause} ORDER BY school_id, uid`,
      ...params,
    );

    const membersById = this.groupBy<number, number>(memberRows, 'school_id', 'uid');

    return rows.map((row) => ({
      ...row,
      award_counts: JSON.parse(row.award_counts),
      member_ids: membersById.get(row.id) ?? [],
    }));
  }

  /** Batch-reconstructs Contests from flat rows, fetching contestant_ids in bulk. */
  private async reconstructContests(rows: any[]): Promise<DbContest[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);

    const [clause, params] = this.whereIn('contest_id', ids);
    const contestantRows = await this.db.all<{ contest_id: number; uid: number }>(
      `SELECT contest_id, uid FROM oier_contests WHERE ${clause} ORDER BY contest_id, uid`,
      ...params,
    );

    const contestantsById = this.groupBy<number, number>(contestantRows, 'contest_id', 'uid');

    return rows.map((row) => ({
      ...row,
      fall_semester: row.fall_semester === 1,
      level_counts: JSON.parse(row.level_counts),
      contestant_ids: contestantsById.get(row.id) ?? [],
    }));
  }

  // ── Pagination Helper ─────────────────────────────────────────

  /**
   * Executes a paginated SELECT and its count query in parallel,
   * then reconstructs the result rows.
   */
  private async paginatedQuery<T>(opts: {
    selectExpr: string;
    fromClause: string;
    whereClauses: string[];
    params: any[];
    orderBy: string;
    page: number;
    perPage: number;
    countExpr?: string;
    reconstruct: (rows: any[]) => Promise<T[]>;
  }): Promise<{ items: T[]; total: number; totalPages: number }> {
    const {
      selectExpr,
      fromClause,
      whereClauses,
      params,
      orderBy,
      page,
      perPage,
      countExpr = 'COUNT(*) as count',
      reconstruct,
    } = opts;
    const where = whereClauses.length > 0 ? ' WHERE ' + whereClauses.join(' AND ') : '';
    const offset = (page - 1) * perPage;

    const [rows, countResult] = await Promise.all([
      this.db.all(
        `${selectExpr} ${fromClause}${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
        ...params,
        perPage,
        offset,
      ),
      this.db.get<{ count: number }>(`SELECT ${countExpr} ${fromClause}${where}`, ...params),
    ]);

    const total = countResult!.count;
    return { items: await reconstruct(rows), total, totalPages: Math.ceil(total / perPage) };
  }

  // ── IAdapterWithLoader Interface ──────────────────────────────

  async loadData(data: DbParseResult): Promise<void> {
    this.cachedVersion = null;

    const currentVersion = await this.getMetadata(META_KEY_DATA_VERSION);
    if (currentVersion !== data.data_version) {
      await this.clearAllData();
    }

    await this.db.serialize(async () => {
      await this.db.run('BEGIN TRANSACTION');

      try {
        await this.setMetadata(META_KEY_DATA_VERSION, data.data_version);
        await this.setMetadata(META_KEY_LOADING_PROGRESS, 'loading');

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

          for (const province of oier.provinces) {
            await this.db.run(
              'INSERT INTO oier_provinces (uid, province) VALUES (?, ?)',
              oier.uid,
              province,
            );
          }

          for (const schoolId of oier.school_ids) {
            await this.db.run(
              'INSERT INTO oier_schools (uid, school_id) VALUES (?, ?)',
              oier.uid,
              schoolId,
            );
          }

          for (const contestId of oier.contest_ids) {
            await this.db.run(
              'INSERT INTO oier_contests (uid, contest_id) VALUES (?, ?)',
              oier.uid,
              contestId,
            );
          }
        }

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
        const [oiersCount, schoolsCount, contestsCount, recordsCount] = await Promise.all([
          this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM oiers'),
          this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM schools'),
          this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM contests'),
          this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM records'),
        ]);

        if (
          oiersCount!.count !== data.oiers.length ||
          schoolsCount!.count !== data.schools.length ||
          contestsCount!.count !== data.contests.length ||
          recordsCount!.count !== data.records.length
        ) {
          throw new Error(
            'Data validation failed: actual counts do not match expected counts. Data may be corrupted.',
          );
        }

        await this.setMetadata(META_KEY_LOADING_PROGRESS, 'loaded');
        await this.db.run('COMMIT');
      } catch (error) {
        await this.db.run('ROLLBACK');
        throw error;
      }
    });

    this.cachedVersion = data.data_version;
  }

  // ── IAdapter Interface ────────────────────────────────────────

  async checkAvailability(targetVersion: string): Promise<boolean> {
    const version = await this.getMetadata(META_KEY_DATA_VERSION);
    const progress = await this.getMetadata(META_KEY_LOADING_PROGRESS);
    return version === targetVersion && progress === 'loaded';
  }

  async getVersion(): Promise<VersionResponse> {
    return { data_version: await this.getDataVersion() };
  }

  async getOIer(uid: number): Promise<GetOIerResponse | null> {
    const oierRow = await this.db.get<any>('SELECT * FROM oiers WHERE uid = ?', uid);
    if (!oierRow) return null;

    const [oiers, records, version] = await Promise.all([
      this.reconstructOIers([oierRow]),
      this.db.all<any>('SELECT * FROM records WHERE uid = ?', uid),
      this.getDataVersion(),
    ]);
    const oier = oiers[0];

    const [schools, contests] = await Promise.all([
      this.fetchRows('schools', 'id', oier.school_ids).then((r) => this.reconstructSchools(r)),
      this.fetchRows('contests', 'id', oier.contest_ids).then((r) => this.reconstructContests(r)),
    ]);

    return {
      uid,
      oier,
      records: records.map((r) => this.reconstructRecord(r)),
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

    const whereClauses: string[] = [];
    const params: any[] = [];
    let fromClause = 'FROM oiers o';

    if (province) {
      fromClause += ' INNER JOIN oier_provinces op ON o.uid = op.uid';
      whereClauses.push('op.province = ?');
      params.push(province);
    }
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
    if (gender != null) {
      whereClauses.push('o.gender = ?');
      params.push(gender);
    }

    const { items, total, totalPages } = await this.paginatedQuery<DbOIer>({
      selectExpr: 'SELECT o.*',
      fromClause,
      whereClauses,
      params,
      orderBy: 'o.rank',
      page,
      perPage,
      countExpr: 'COUNT(DISTINCT o.uid) as count',
      reconstruct: (rows) => this.reconstructOIers(rows),
    });

    return {
      oiers: items,
      total,
      totalPages,
      page,
      perPage,
      data_version: await this.getDataVersion(),
    };
  }

  async getSchool(id: number): Promise<GetSchoolResponse | null> {
    const schoolRow = await this.db.get<any>('SELECT * FROM schools WHERE id = ?', id);
    if (!schoolRow) return null;

    const [schools, version] = await Promise.all([
      this.reconstructSchools([schoolRow]),
      this.getDataVersion(),
    ]);
    const school = schools[0];

    const [records, memberRows] = await Promise.all([
      this.db.all<any>('SELECT * FROM records WHERE school_id = ?', id),
      this.fetchRows('oiers', 'uid', school.member_ids),
    ]);

    const contestIds = Array.from(new Set(records.map((r) => r.contest_id)));

    const [members, contests] = await Promise.all([
      this.reconstructOIers(memberRows),
      this.fetchRows('contests', 'id', contestIds).then((r) => this.reconstructContests(r)),
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

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (name) {
      whereClauses.push('name = ?');
      params.push(name);
    }
    if (province) {
      whereClauses.push('province = ?');
      params.push(province);
    }
    if (province && city) {
      whereClauses.push('city = ?');
      params.push(city);
    }

    const { items, total, totalPages } = await this.paginatedQuery<DbSchool>({
      selectExpr: 'SELECT *',
      fromClause: 'FROM schools',
      whereClauses,
      params,
      orderBy: 'rank',
      page,
      perPage,
      reconstruct: (rows) => this.reconstructSchools(rows),
    });

    return {
      schools: items,
      total,
      totalPages,
      page,
      perPage,
      data_version: await this.getDataVersion(),
    };
  }

  async getContest(
    id: number,
    _page?: number,
    _perPage?: number,
  ): Promise<GetContestResponse | null> {
    const contestRow = await this.db.get<any>('SELECT * FROM contests WHERE id = ?', id);
    if (!contestRow) return null;

    const { page, perPage } = normalizePaginationParams(_page, _perPage);
    const offset = (page - 1) * perPage;

    const [contests, records, totalResult, version] = await Promise.all([
      this.reconstructContests([contestRow]),
      this.db.all<any>(
        'SELECT * FROM records WHERE contest_id = ? ORDER BY rank LIMIT ? OFFSET ?',
        id,
        perPage,
        offset,
      ),
      this.db.get<{ count: number }>(
        'SELECT COUNT(*) as count FROM records WHERE contest_id = ?',
        id,
      ),
      this.getDataVersion(),
    ]);

    const contest = contests[0];
    const total = totalResult!.count;
    const schoolIds = Array.from(new Set(records.map((r) => r.school_id)));
    const uids = Array.from(new Set(records.map((r) => r.uid)));

    const [schools, oiers] = await Promise.all([
      this.fetchRows('schools', 'id', schoolIds).then((r) => this.reconstructSchools(r)),
      this.fetchRows('oiers', 'uid', uids).then((r) => this.reconstructOIers(r)),
    ]);

    return {
      id,
      contest,
      records: records.map((r) => this.reconstructRecord(r)),
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

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (type) {
      whereClauses.push('type = ?');
      params.push(type);
    }
    if (year) {
      whereClauses.push('year = ?');
      params.push(year);
    }

    const { items, total, totalPages } = await this.paginatedQuery<DbContest>({
      selectExpr: 'SELECT *',
      fromClause: 'FROM contests',
      whereClauses,
      params,
      orderBy: 'id DESC',
      page,
      perPage,
      reconstruct: (rows) => this.reconstructContests(rows),
    });

    return {
      contests: items,
      total,
      totalPages,
      page,
      perPage,
      data_version: await this.getDataVersion(),
    };
  }
}
