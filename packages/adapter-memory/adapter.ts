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

export class MemoryAdapter implements IAdapterWithLoader {
  // Primary storage - Maps for O(1) lookups
  private oiers: Map<number, DbOIer> = new Map();
  private schools: Map<number, DbSchool> = new Map();
  private contests: Map<number, DbContest> = new Map();

  // Records stored as array (need to support compound key filtering)
  private records: DbRecord[] = [];

  // Metadata storage
  private metadata: Map<string, string> = new Map();

  getType(): string {
    return 'memory';
  }

  // ==============================
  // IAdapterWithLoader Interface
  // ==============================

  async loadData(data: DbParseResult): Promise<void> {
    // Clear all existing data
    this.oiers.clear();
    this.schools.clear();
    this.contests.clear();
    this.records = [];
    this.metadata.clear();

    // Load new data into storage structures
    for (const oier of data.oiers) {
      this.oiers.set(oier.uid, oier);
    }

    for (const school of data.schools) {
      this.schools.set(school.id, school);
    }

    for (const contest of data.contests) {
      this.contests.set(contest.id, contest);
    }

    this.records = [...data.records];

    // Set metadata
    this.metadata.set(META_KEY_DATA_VERSION, data.data_version);
    this.metadata.set(META_KEY_LOADING_PROGRESS, 'loaded');
  }

  // ==============================
  // IAdapter Interface
  // ==============================

  async checkAvailability(targetVersion: string): Promise<boolean> {
    const version = this.metadata.get(META_KEY_DATA_VERSION);
    const progress = this.metadata.get(META_KEY_LOADING_PROGRESS);

    return version === targetVersion && progress === 'loaded';
  }

  async getVersion(): Promise<VersionResponse> {
    const version = this.metadata.get(META_KEY_DATA_VERSION) || '';

    return {
      data_version: version,
    };
  }

  async getOIer(uid: number): Promise<GetOIerResponse | null> {
    const oier = this.oiers.get(uid);
    if (!oier) {
      return null;
    }

    // Get records for this oier
    const records = this.records.filter((r) => r.uid === uid);

    // Get related schools
    const schools = oier.school_ids
      .map((id) => this.schools.get(id))
      .filter((s): s is DbSchool => s !== undefined);

    // Get related contests from records
    const contestIds = Array.from(new Set(records.map((r) => r.contest_id)));
    const contests = contestIds
      .map((id) => this.contests.get(id))
      .filter((c): c is DbContest => c !== undefined);

    const version = this.metadata.get(META_KEY_DATA_VERSION) || '';

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

    // Convert Map to array and apply filters
    let oiers = Array.from(this.oiers.values());

    if (name) {
      oiers = oiers.filter((o) => o.name === name);
    }
    if (initials) {
      oiers = oiers.filter((o) => o.initials === initials.toLowerCase());
    }
    if (enroll_middle) {
      oiers = oiers.filter((o) => o.enroll_middle === enroll_middle);
    }
    if (gender !== null && gender !== undefined) {
      oiers = oiers.filter((o) => o.gender === gender);
    }
    if (province) {
      oiers = oiers.filter((o) => o.provinces.includes(province));
    }

    // Sort by rank
    oiers.sort((a, b) => a.rank - b.rank);

    // Calculate total and apply pagination
    const total = oiers.length;
    const paginatedOiers = oiers.slice((page - 1) * perPage, page * perPage);

    const version = this.metadata.get(META_KEY_DATA_VERSION) || '';

    return {
      oiers: paginatedOiers,
      total,
      totalPages: Math.ceil(total / perPage),
      page,
      perPage,
      data_version: version,
    };
  }

  async getSchool(id: number): Promise<GetSchoolResponse | null> {
    const school = this.schools.get(id);
    if (!school) {
      return null;
    }

    // Get records for this school
    const records = this.records.filter((r) => r.school_id === id);

    // Get members
    const members = school.member_ids
      .map((uid) => this.oiers.get(uid))
      .filter((m): m is DbOIer => m !== undefined);

    // Get unique contest IDs from records
    const contestIds = Array.from(new Set(records.map((r) => r.contest_id)));
    const contests = contestIds
      .map((id) => this.contests.get(id))
      .filter((c): c is DbContest => c !== undefined);

    const version = this.metadata.get(META_KEY_DATA_VERSION) || '';

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

    // Convert Map to array and apply filters
    let schools = Array.from(this.schools.values());

    if (name) {
      // Substring match (case-insensitive)
      const lowerName = name.toLowerCase();
      schools = schools.filter((s) => s.name.toLowerCase().includes(lowerName));
    }
    if (province) {
      schools = schools.filter((s) => s.province === province);
    }
    if (province && city) {
      schools = schools.filter((s) => s.city === city);
    }

    // Sort by rank
    schools.sort((a, b) => a.rank - b.rank);

    // Calculate total and apply pagination
    const total = schools.length;
    const paginatedSchools = schools.slice((page - 1) * perPage, page * perPage);

    const version = this.metadata.get(META_KEY_DATA_VERSION) || '';

    return {
      schools: paginatedSchools,
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
    const contest = this.contests.get(id);
    if (!contest) {
      return null;
    }

    const { page, perPage } = normalizePaginationParams(_page, _perPage);

    // Get all records for this contest
    let records = this.records.filter((r) => r.contest_id === id);

    // Sort by rank
    records.sort((a, b) => a.rank - b.rank);

    // Calculate total
    const total = records.length;

    // Apply pagination
    const paginatedRecords = records.slice((page - 1) * perPage, page * perPage);

    // Get related schools and oiers from paginated records
    const schoolIds = Array.from(new Set(paginatedRecords.map((r) => r.school_id)));
    const uids = Array.from(new Set(paginatedRecords.map((r) => r.uid)));

    const schools = schoolIds
      .map((id) => this.schools.get(id))
      .filter((s): s is DbSchool => s !== undefined);
    const oiers = uids
      .map((uid) => this.oiers.get(uid))
      .filter((o): o is DbOIer => o !== undefined);

    const version = this.metadata.get(META_KEY_DATA_VERSION) || '';

    return {
      id,
      contest,
      records: paginatedRecords,
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

    // Convert Map to array and apply filters
    let contests = Array.from(this.contests.values());

    if (type) {
      contests = contests.filter((c) => c.type === type);
    }
    if (year) {
      contests = contests.filter((c) => c.year === year);
    }

    // Sort by id descending (most recent first)
    contests.sort((a, b) => b.id - a.id);

    // Calculate total and apply pagination
    const total = contests.length;
    const paginatedContests = contests.slice((page - 1) * perPage, page * perPage);

    const version = this.metadata.get(META_KEY_DATA_VERSION) || '';

    return {
      contests: paginatedContests,
      total,
      totalPages: Math.ceil(total / perPage),
      page,
      perPage,
      data_version: version,
    };
  }
}
