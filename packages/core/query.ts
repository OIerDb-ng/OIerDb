import { AdapterFeatureUnsupportedError, AdapterNotReadyError } from './errors';
import type { DbContest, DbOIer, DbRecord, DbSchool, DbSummary, Gender } from './interface';
import { KeyRange, type IDataStore, type StorePrimaryKey, type StoreRecord } from './store';
import { normalizePositiveInteger, throwIfAborted } from './util';

export type AdapterType = 'http' | 'idb';

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface PageParams {
  page?: number;
  perPage?: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

export interface NormalizedPage {
  page: number;
  perPage: number;
  offset: number;
}

export function normalizePageParams(params: PageParams = {}): NormalizedPage {
  const page = normalizePositiveInteger(params.page, DEFAULT_PAGE);
  const perPage = normalizePositiveInteger(params.perPage, DEFAULT_PER_PAGE, MAX_PER_PAGE);
  return { page, perPage, offset: (page - 1) * perPage };
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

export interface GetSchoolResult extends ResultBase, PaginationInfo {
  school: DbSchool;
  membersMap: Record<number, DbOIer>;
  contestsMap: Record<number, DbContest>;
}

interface SchoolCommonFilters {
  province?: number;
  city?: string;
}

export interface ListSchoolsQuery extends PageParams, SchoolCommonFilters {
  name?: string;
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

export interface IAdapterCore {
  readonly type: AdapterType;

  status(): Promise<StatusResult>;
}

export interface IAdapterOperations {
  summary(options?: RequestOptions): Promise<SummaryResult>;

  getOIer(uid: number, options?: RequestOptions): Promise<GetOIerResult | null>;
  listOIers(query: ListOIersQuery, options?: RequestOptions): Promise<ListOIersResult>;
  searchOIers(query: SearchOIersQuery, options?: RequestOptions): Promise<SearchOIersResult>;

  getSchool(id: number, pageParams?: PageParams, options?: RequestOptions): Promise<GetSchoolResult | null>;
  listSchools(query: ListSchoolsQuery, options?: RequestOptions): Promise<ListSchoolsResult>;
  searchSchools(query: SearchSchoolsQuery, options?: RequestOptions): Promise<SearchSchoolsResult>;

  getContest(id: number, pageParams?: PageParams, options?: RequestOptions): Promise<GetContestResult | null>;
  listContests(query: ListContestsQuery, options?: RequestOptions): Promise<ListContestsResult>;
  searchContests(query: SearchContestsQuery, options?: RequestOptions): Promise<SearchContestsResult>;
}

export interface IAdapter extends IAdapterCore, IAdapterOperations {}

export type AdapterOperation = keyof IAdapterOperations;

export type AdapterOperationResults = {
  [K in AdapterOperation]: Awaited<ReturnType<IAdapterOperations[K]>>;
};

export class QueryEngine implements IAdapter {
  constructor(
    private readonly store: IDataStore,
    public readonly type: AdapterType
  ) {}

  private async requireVersion() {
    const version = await this.store.get('meta', 'version');
    if (!version) throw new AdapterNotReadyError('QueryEngine is not ready', this.type);
    return version.value;
  }

  private async assertVersionUnchanged(version: string) {
    const current = await this.store.get('meta', 'version');
    if (!current || current.value !== version) {
      throw new AdapterNotReadyError('Data version changed while querying', this.type);
    }
  }

  private async bulkMap<Table extends 'oiers' | 'schools' | 'contests'>(
    table: Table,
    ids: readonly number[],
    keyOf: (item: StoreRecord<Table>) => number
  ): Promise<Record<number, StoreRecord<Table>>> {
    const items = await this.store.bulkGet(
      table, [...new Set(ids)] as unknown as StorePrimaryKey<Table>[]
    ) as unknown as (StoreRecord<Table> | undefined)[];
    const map: Record<number, StoreRecord<Table>> = {};
    for (const item of items) {
      if (item !== undefined) map[keyOf(item)] = item;
    }
    return map;
  }

  async status() {
    const version = await this.store.get('meta', 'version');
    return { ready: !!version, version: version?.value ?? null };
  }

  async summary(options: RequestOptions = {}) {
    throwIfAborted(options.signal);
    const [version, provinces, enrollMiddleYears, contestTypes, awards]
      = await this.store.bulkGet('meta', ['version', 'provinces', 'enrollMiddleYears', 'contestTypes', 'awards']);

    if (!version || !provinces || !enrollMiddleYears || !contestTypes || !awards) {
      throw new AdapterNotReadyError('QueryEngine is not ready', this.type);
    }

    const [oierCount, schoolCount, contestCount] = await Promise.all([
      this.store.count('oiers'),
      this.store.count('schools'),
      this.store.count('contests'),
    ]);
    await this.assertVersionUnchanged(version.value);

    return {
      version: version.value,
      provinces: provinces.value,
      enrollMiddleYears: enrollMiddleYears.value,
      contestTypes: contestTypes.value,
      awards: awards.value,
      oierCount, schoolCount, contestCount,
    };
  }

  async getOIer(uid: number, options: RequestOptions = {}) {
    throwIfAborted(options.signal);
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
    const [schoolsMap, contestsMap] = await Promise.all([
      this.bulkMap('schools', records.map(record => record.schoolId), school => school.id),
      this.bulkMap('contests', records.map(record => record.contestId), contest => contest.id),
    ]);
    await this.assertVersionUnchanged(version);

    return { version, oier, records, schoolsMap, contestsMap };
  }

  async listOIers(_query: ListOIersQuery = {}, _options?: RequestOptions): Promise<ListOIersResult> {
    throw new AdapterFeatureUnsupportedError('listOIers');
  }

  async searchOIers(_query: SearchOIersQuery, _options?: RequestOptions): Promise<SearchOIersResult> {
    throw new AdapterFeatureUnsupportedError('searchOIers');
  }

  async getSchool(id: number, pageParams?: PageParams, options: RequestOptions = {}) {
    throwIfAborted(options.signal);
    const { page, perPage, offset } = normalizePageParams(pageParams);
    const [version, school] = await Promise.all([
      this.requireVersion(),
      this.store.get('schools', id),
    ]);
    if (!school) return null;

    const [total, records] = await Promise.all([
      this.store.count('records', 'schoolId', KeyRange.only(id)),
      this.store.indexRange({
        table: 'records',
        index: 'schoolId',
        range: KeyRange.only(id),
        offset,
        limit: perPage,
      }),
    ]);
    const [membersMap, contestsMap] = await Promise.all([
      this.bulkMap('oiers', records.map(record => record.uid), oier => oier.uid),
      this.bulkMap('contests', records.map(record => record.contestId), contest => contest.id),
    ]);
    await this.assertVersionUnchanged(version);

    return {
      version, school, records, membersMap, contestsMap,
      page, perPage, total, totalPages: Math.ceil(total / perPage),
    };
  }

  async listSchools(_query: ListSchoolsQuery = {}, _options?: RequestOptions): Promise<ListSchoolsResult> {
    throw new AdapterFeatureUnsupportedError('listSchools');
  }

  async searchSchools(_query: SearchSchoolsQuery, _options?: RequestOptions): Promise<SearchSchoolsResult> {
    throw new AdapterFeatureUnsupportedError('searchSchools');
  }

  async getContest(id: number, pageParams?: PageParams, options: RequestOptions = {}) {
    throwIfAborted(options.signal);
    const { page, perPage, offset } = normalizePageParams(pageParams);
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
    const [oiersMap, schoolsMap] = await Promise.all([
      this.bulkMap('oiers', records.map(record => record.uid), oier => oier.uid),
      this.bulkMap('schools', records.map(record => record.schoolId), school => school.id),
    ]);
    await this.assertVersionUnchanged(version);

    return {
      version, contest, records, oiersMap, schoolsMap,
      page, perPage, total, totalPages: Math.ceil(total / perPage),
    };
  }

  async listContests(_query: ListContestsQuery = {}, _options?: RequestOptions): Promise<ListContestsResult> {
    throw new AdapterFeatureUnsupportedError('listContests');
  }

  async searchContests(_query: SearchContestsQuery, _options?: RequestOptions): Promise<SearchContestsResult> {
    throw new AdapterFeatureUnsupportedError('searchContests');
  }
}
