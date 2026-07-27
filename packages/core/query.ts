import type { DbContest, DbOIer, DbRecord, DbSchool, DbSummary, Gender } from './interface';

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

  getSchool(id: number, page?: PageParams): Promise<GetSchoolResult | null>;
  listSchools(query: ListSchoolsQuery): Promise<ListSchoolsResult>;
  searchSchools(query: SearchSchoolsQuery): Promise<SearchSchoolsResult>;

  getContest(id: number, page?: PageParams): Promise<GetContestResult | null>;
  listContests(query: ListContestsQuery): Promise<ListContestsResult>;
  searchContests(query: SearchContestsQuery): Promise<SearchContestsResult>;
}
