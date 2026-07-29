import type { DbContest, DbOIer, DbRecord, DbSchool, DbSummary, Gender } from './interface';
import { KeyRange, type IDataStore } from './store';
import { normalizePositiveInteger } from './util';

export type AdapterType = 'http' | 'idb' | 'memory';

export interface PageParams {
  page?: number;
  perPage?: number;
}

export interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface ResultBase {
  version: string;
}

export interface StatusResult {
  ready: boolean;
  version: string | null;
}

export type SummaryResult = DbSummary;

export interface GetOIerResult extends ResultBase {
  oier: DbOIer;
  records: DbRecord[];
  schoolsMap: Record<number, DbSchool>;
  contestsMap: Record<number, DbContest>;
}

interface OIerCommonFilters {
  enrollMiddle?: number;
  gender?: Gender;
  province?: number;
}

export interface ListOIersQuery extends PageParams, OIerCommonFilters {
  name?: string;
  initials?: string;
}

export interface ListOIersResult extends ResultBase, PaginationInfo {
  oiers: DbOIer[];
}

export interface SearchOIersQuery extends PageParams, OIerCommonFilters {
  /** search 模糊匹配 name / loweredName / initials */
  search: string;
}

export interface SearchOIersResult extends ResultBase, PaginationInfo {
  oiers: DbOIer[];
}

export interface GetSchoolResult extends ResultBase {
  school: DbSchool;
  membersMap: Record<number, DbOIer>;
  contestsMap: Record<number, DbContest>;
}

interface SchoolCommonFilters {
  province?: number;
  city?: string;
}

export interface ListSchoolsQuery extends PageParams, SchoolCommonFilters {
  name?: string | null;
}

export interface ListSchoolsResult extends ResultBase, PaginationInfo {
  schools: DbSchool[];
}

export interface SearchSchoolsQuery extends PageParams, SchoolCommonFilters {
  /** search 模糊匹配 name */
  search: string;
}

export interface SearchSchoolsResult extends ResultBase, PaginationInfo {
  schools: DbSchool[];
}

export interface GetContestResult extends ResultBase, PaginationInfo {
  contest: DbContest;
  records: DbRecord[];
  oiersMap: Record<number, DbOIer>;
  schoolsMap: Record<number, DbSchool>;
}

interface ContestCommonFilters {
  type?: number;
  year?: number;
}

export interface ListContestsQuery extends PageParams, ContestCommonFilters {
  name?: string;
}

export interface ListContestsResult extends ResultBase, PaginationInfo {
  contests: DbContest[];
}

export interface SearchContestsQuery extends PageParams, ContestCommonFilters {
  /** search 模糊匹配 name */
  search: string;
}

export interface SearchContestsResult extends ResultBase, PaginationInfo {
  contests: DbContest[];
}

export interface IAdapter {
  readonly type: AdapterType;

  status(): Promise<StatusResult>;
  summary(): Promise<SummaryResult>;

  getOIer(uid: number): Promise<GetOIerResult | null>;
  listOIers(query: ListOIersQuery): Promise<ListOIersResult>;
  searchOIers(query: SearchOIersQuery): Promise<SearchOIersResult>;

  getSchool(id: number): Promise<GetSchoolResult | null>;
  listSchools(query: ListSchoolsQuery): Promise<ListSchoolsResult>;
  searchSchools(query: SearchSchoolsQuery): Promise<SearchSchoolsResult>;

  getContest(id: number, page?: PageParams): Promise<GetContestResult | null>;
  listContests(query: ListContestsQuery): Promise<ListContestsResult>;
  searchContests(query: SearchContestsQuery): Promise<SearchContestsResult>;
}

export class QueryEngine implements IAdapter {
  constructor(
    private readonly store: IDataStore,
    public readonly type: AdapterType = 'idb'
  ) {}

  private async requireVersion() {
    const version = await this.store.get('meta', 'version');
    if (!version) throw new Error('QueryEngine is not ready');
    return version.value;
  }

  private normalizePage({ page, perPage }: PageParams = {}) {
    const normalizedPage = normalizePositiveInteger(page, 1);
    const normalizedPerPage = normalizePositiveInteger(perPage, 20, 100);

    return {
      page: normalizedPage,
      perPage: normalizedPerPage,
      offset: (normalizedPage - 1) * normalizedPerPage,
    };
  }

  async status() {
    const version = await this.store.get('meta', 'version');
    return { ready: !!version, version: version?.value ?? null };
  }

  async summary() {
    const [version, provinces, enrollMiddleYears, contestTypes, awards]
      = await this.store.bulkGet('meta', ['version', 'provinces', 'enrollMiddleYears', 'contestTypes', 'awards']);

    if (!version || !provinces || !enrollMiddleYears || !contestTypes || !awards) {
      throw new Error('QueryEngine is not ready');
    }

    const [oierCount, schoolCount, contestCount] = await Promise.all([
      this.store.count('oiers'),
      this.store.count('schools'),
      this.store.count('contests'),
    ]);

    return {
      version: version.value,
      provinces: provinces.value,
      enrollMiddleYears: enrollMiddleYears.value,
      contestTypes: contestTypes.value,
      awards: awards.value,
      oierCount, schoolCount, contestCount,
    };
  }

  async getOIer(uid: number) {
    const [version, oier] = await Promise.all([
      this.requireVersion(),
      this.store.get('oiers', uid),
    ]);
    if (!oier) return null;

    const records = await this.store.indexRange({
      table: 'records',
      index: 'uid',
      range: KeyRange.only(uid),
    });
    const [schools, contests] = await Promise.all([
      this.store.bulkGet('schools', [...new Set(records.map(record => record.schoolId))]),
      this.store.bulkGet('contests', [...new Set(records.map(record => record.contestId))]),
    ]);

    return {
      version,
      oier,
      records,
      schoolsMap: Object.fromEntries(
        schools.filter(school => school !== undefined).map(school => [school.id, school])
      ),
      contestsMap: Object.fromEntries(
        contests.filter(contest => contest !== undefined).map(contest => [contest.id, contest])
      ),
    };
  }

  async listOIers(_: ListOIersQuery = {}): Promise<ListOIersResult> {
    throw new Error('listOIers is not implemented yet');
  }

  async searchOIers(_: SearchOIersQuery): Promise<SearchOIersResult> {
    throw new Error('searchOIers is not implemented yet');
  }

  async getSchool(id: number) {
    const [version, school] = await Promise.all([
      this.requireVersion(),
      this.store.get('schools', id),
    ]);
    if (!school) return null;

    const records = await this.store.indexRange({
      table: 'records',
      index: 'schoolId',
      range: KeyRange.only(id),
    });
    const [members, contests] = await Promise.all([
      this.store.bulkGet('oiers', [...new Set(records.map(record => record.uid))]).then(results => results.filter(Boolean) as DbOIer[]),
      this.store.bulkGet('contests', [...new Set(records.map(record => record.contestId))]).then(results => results.filter(Boolean) as DbContest[]),
    ]);

    return {
      version,
      school,
      membersMap: Object.fromEntries(members.map(member => [member.uid, member])),
      contestsMap: Object.fromEntries(contests.map(contest => [contest.id, contest])),
    };
  }

  async listSchools(_: ListSchoolsQuery = {}): Promise<ListSchoolsResult> {
    throw new Error('listSchools is not implemented yet');
  }

  async searchSchools(_: SearchSchoolsQuery): Promise<SearchSchoolsResult> {
    throw new Error('searchSchools is not implemented yet');
  }

  async getContest(id: number, pageParams?: PageParams) {
    const { page, perPage, offset } = this.normalizePage(pageParams);
    const [version, contest] = await Promise.all([
      this.requireVersion(),
      this.store.get('contests', id),
    ]);
    if (!contest) return null;

    const [total, records] = await Promise.all([
      this.store.count('records', 'contestId', KeyRange.only(id)),
      this.store.indexRange({
        table: 'records',
        index: 'contestId+rank',
        range: KeyRange.bound(
          [id, Number.NEGATIVE_INFINITY],
          [id, Number.POSITIVE_INFINITY]
        ),
        offset,
        limit: perPage,
      }),
    ]);
    const [oiers, schools] = await Promise.all([
      this.store.bulkGet('oiers', [...new Set(records.map(record => record.uid))]).then(results => results.filter(Boolean) as DbOIer[]),
      this.store.bulkGet('schools', [...new Set(records.map(record => record.schoolId))]).then(results => results.filter(Boolean) as DbSchool[]),
    ]);

    return {
      version, contest, records,
      oiersMap: Object.fromEntries(oiers.map(oier => [oier.uid, oier])),
      schoolsMap: Object.fromEntries(schools.map(school => [school.id, school])),
      page, perPage, total, totalPages: Math.ceil(total / perPage),
    };
  }

  async listContests(_: ListContestsQuery = {}): Promise<ListContestsResult> {
    throw new Error('listContests is not implemented yet');
  }

  async searchContests(_: SearchContestsQuery): Promise<SearchContestsResult> {
    throw new Error('searchContests is not implemented yet');
  }
}
