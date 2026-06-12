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

import { normalizePaginationParams } from '@oierdb/core';

export class MemoryAdapter implements IAdapterWithLoader {
  private oiers: Map<number, DbOIer> = new Map();
  private schools: Map<number, DbSchool> = new Map();
  private contests: Map<number, DbContest> = new Map();

  // Pre-sorted arrays for list queries — built once at load time
  private oiersSortedByRank: DbOIer[] = [];
  private schoolsSortedByRank: DbSchool[] = [];
  private contestsSortedByIdDesc: DbContest[] = [];

  // Record indexes for O(1) lookup — built once at load time
  private recordsByUid: Map<number, DbRecord[]> = new Map();
  private recordsBySchoolId: Map<number, DbRecord[]> = new Map();
  private recordsByContestId: Map<number, DbRecord[]> = new Map();

  private dataVersion = '';
  private loaded = false;

  getType(): string {
    return 'memory';
  }

  async loadData(data: DbParseResult): Promise<void> {
    this.oiers.clear();
    this.schools.clear();
    this.contests.clear();
    this.recordsByUid.clear();
    this.recordsBySchoolId.clear();
    this.recordsByContestId.clear();

    for (const oier of data.oiers) {
      this.oiers.set(oier.uid, oier);
    }
    for (const school of data.schools) {
      this.schools.set(school.id, school);
    }
    for (const contest of data.contests) {
      this.contests.set(contest.id, contest);
    }

    for (const record of data.records) {
      appendToMapList(this.recordsByUid, record.uid, record);
      appendToMapList(this.recordsBySchoolId, record.school_id, record);
      appendToMapList(this.recordsByContestId, record.contest_id, record);
    }

    // Sort contest records by rank once at load time
    for (const records of this.recordsByContestId.values()) {
      records.sort((a, b) => a.rank - b.rank);
    }

    this.oiersSortedByRank = Array.from(this.oiers.values()).sort((a, b) => a.rank - b.rank);
    this.schoolsSortedByRank = Array.from(this.schools.values()).sort((a, b) => a.rank - b.rank);
    this.contestsSortedByIdDesc = Array.from(this.contests.values()).sort((a, b) => b.id - a.id);

    this.dataVersion = data.data_version;
    this.loaded = true;
  }

  async checkAvailability(targetVersion: string): Promise<boolean> {
    return this.loaded && this.dataVersion === targetVersion;
  }

  async getVersion(): Promise<VersionResponse> {
    return { data_version: this.dataVersion };
  }

  async getOIer(uid: number): Promise<GetOIerResponse | null> {
    const oier = this.oiers.get(uid);
    if (!oier) return null;

    const records = this.recordsByUid.get(uid) ?? [];

    const schools = oier.school_ids
      .map((id) => this.schools.get(id))
      .filter((s): s is DbSchool => s !== undefined);

    const contestIds = Array.from(new Set(records.map((r) => r.contest_id)));
    const contests = contestIds
      .map((id) => this.contests.get(id))
      .filter((c): c is DbContest => c !== undefined);

    return {
      uid,
      oier,
      records,
      schools_map: Object.fromEntries(schools.map((s) => [s.id, s])),
      contests_map: Object.fromEntries(contests.map((c) => [c.id, c])),
      data_version: this.dataVersion,
    };
  }

  async listOIers(query: ListOIersQuery): Promise<ListOIersResponse> {
    const { name, initials, enroll_middle, gender, province } = query;
    const { page, perPage } = normalizePaginationParams(query.page, query.perPage);

    let oiers = this.oiersSortedByRank;

    if (name) oiers = oiers.filter((o) => o.name === name);
    if (initials) oiers = oiers.filter((o) => o.initials === initials.toLowerCase());
    if (enroll_middle) oiers = oiers.filter((o) => o.enroll_middle === enroll_middle);
    if (gender != null) oiers = oiers.filter((o) => o.gender === gender);
    if (province) oiers = oiers.filter((o) => o.provinces.includes(province));

    const { items, total, totalPages } = paginate(oiers, page, perPage);

    return {
      oiers: items,
      total,
      totalPages,
      page,
      perPage,
      data_version: this.dataVersion,
    };
  }

  async getSchool(id: number): Promise<GetSchoolResponse | null> {
    const school = this.schools.get(id);
    if (!school) return null;

    const records = this.recordsBySchoolId.get(id) ?? [];

    const members = school.member_ids
      .map((uid) => this.oiers.get(uid))
      .filter((m): m is DbOIer => m !== undefined);

    const contestIds = Array.from(new Set(records.map((r) => r.contest_id)));
    const contests = contestIds
      .map((id) => this.contests.get(id))
      .filter((c): c is DbContest => c !== undefined);

    return {
      id,
      school,
      members_map: Object.fromEntries(members.map((m) => [m.uid, m])),
      contests_map: Object.fromEntries(contests.map((c) => [c.id, c])),
      data_version: this.dataVersion,
    };
  }

  async listSchools(query: ListSchoolsQuery): Promise<ListSchoolsResponse> {
    const { name, province, city } = query;
    const { page, perPage } = normalizePaginationParams(query.page, query.perPage);

    let schools = this.schoolsSortedByRank;

    if (name) {
      const lowerName = name.toLowerCase();
      schools = schools.filter((s) => s.name.toLowerCase().includes(lowerName));
    }
    if (province) schools = schools.filter((s) => s.province === province);
    if (city) schools = schools.filter((s) => s.city === city);

    const { items, total, totalPages } = paginate(schools, page, perPage);

    return {
      schools: items,
      total,
      totalPages,
      page,
      perPage,
      data_version: this.dataVersion,
    };
  }

  async getContest(
    id: number,
    page?: number,
    perPage?: number,
  ): Promise<GetContestResponse | null> {
    const contest = this.contests.get(id);
    if (!contest) return null;

    const { page: p, perPage: pp } = normalizePaginationParams(page, perPage);

    const allRecords = this.recordsByContestId.get(id) ?? [];
    const { items: paginatedRecords, total, totalPages } = paginate(allRecords, p, pp);

    const schoolIds = Array.from(new Set(paginatedRecords.map((r) => r.school_id)));
    const uids = Array.from(new Set(paginatedRecords.map((r) => r.uid)));

    const schools = schoolIds
      .map((sid) => this.schools.get(sid))
      .filter((s): s is DbSchool => s !== undefined);
    const oiers = uids
      .map((uid) => this.oiers.get(uid))
      .filter((o): o is DbOIer => o !== undefined);

    return {
      id,
      contest,
      records: paginatedRecords,
      schools_map: Object.fromEntries(schools.map((s) => [s.id, s])),
      oiers_map: Object.fromEntries(oiers.map((o) => [o.uid, o])),
      page: p,
      perPage: pp,
      total,
      totalPages,
      data_version: this.dataVersion,
    };
  }

  async listContests(query: ListContestsQuery): Promise<ListContestsResponse> {
    const { type, year } = query;
    const { page, perPage } = normalizePaginationParams(query.page, query.perPage);

    let contests = this.contestsSortedByIdDesc;

    if (type) contests = contests.filter((c) => c.type === type);
    if (year) contests = contests.filter((c) => c.year === year);

    const { items, total, totalPages } = paginate(contests, page, perPage);

    return {
      contests: items,
      total,
      totalPages,
      page,
      perPage,
      data_version: this.dataVersion,
    };
  }
}

function paginate<T>(
  items: T[],
  page: number,
  perPage: number,
): { items: T[]; total: number; totalPages: number } {
  const total = items.length;
  return {
    items: items.slice((page - 1) * perPage, page * perPage),
    total,
    totalPages: Math.ceil(total / perPage),
  };
}

function appendToMapList<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
