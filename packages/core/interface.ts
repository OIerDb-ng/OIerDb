// ==============================
// Utility Types and Interfaces
// ==============================

export type Gender = -1 | 0 | 1; // 性别（-1：女；0：未知；1：男）

export interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

// ==============================
// Basic Interfaces
// ==============================

export interface DbOIer {
  uid: number; // OIerDb UID（为选手相关记录在 raw.txt 中首次出现的有效行号）
  name: string; // 姓名
  lowered_name: string; // 姓名（小写）
  initials: string; // 姓名拼音首字母（小写）
  enroll_middle: number; // 初中入学年份
  gender: Gender; // 性别
  provinces: string[]; // 省份列表
  school_ids: number[]; // 学校 ID 列表
  contest_ids: number[]; // 参加的比赛 ID 列表（记录通过 uid + contest_id 复合主键关联）
  oierdb_score: number; // OIerDb 分数
  ccf_level: number; // CCF 等级
  ccf_score: number; // CCF 分数
  rank: number; // OIerDb 排名（从 0 开始）
}

export interface DbRecord {
  contest_id: number; // 比赛 ID
  school_id: number; // 学校 ID
  uid: number; // 选手 ID

  level: string; // 奖项
  score: number; // 分数
  rank: number; // 名次
  province: string; // 省份
  enroll_middle?: {
    // 初中入学年份信息（可选）
    is_stay_down: boolean; // 是否留级
    value: number; // 初中入学年份
  };
}

export interface DbContest {
  id: number; // 比赛 ID
  name: string; // 比赛名称
  year: number; // 比赛年份
  type: string; // 比赛类型（如 NOI、IOI、CCPC 等）
  contestant_ids: number[]; // 获奖选手 UID 列表
  fall_semester: boolean; // 是否为秋季学期
  full_score: number; // 满分
  capacity: number; // 参赛总人数（可能与 contestants.length 不同，因为有些选手可能没有成绩记录）
  length: number; // 获奖人数
  level_counts: Record<string, number>; // 奖项统计
}

export interface DbSchool {
  id: number; // 学校 ID
  name: string; // 学校名称
  province: string; // 省份
  city: string; // 城市
  score: number; // 学校分数
  rank: number; // 学校排名
  member_ids: number[]; // 学校成员 UID 列表
  award_counts: Record<string, Record<string, Record<string, number>>>; // 学校奖项统计（比赛类型 -> 年份 -> 奖项 -> 数量）
}

export interface DbMetadata {
  key: string;
  value: string;
}

export interface DbParseResult {
  oiers: DbOIer[];
  schools: DbSchool[];
  contests: DbContest[];
  records: DbRecord[];
  meta: Record<string, string>;
}

// ==============================
// Response Interfaces
// ==============================

export interface ResponseBase {
  backend_data_version: string; // 后端数据版本（通常为 SHA256 哈希值）
}

export interface GetOIerResponse extends ResponseBase {
  uid: number;
  oier: DbOIer;
  records: DbRecord[];
  schools_map: Record<number, DbSchool>; // key: school_id
  contests_map: Record<number, DbContest>; // key: contest_id
}

export interface ListOIersResponse extends ResponseBase, PaginationInfo {
  oiers: DbOIer[];
}

export interface GetSchoolResponse extends ResponseBase {
  id: number;
  school: DbSchool;
  members_map: Record<number, DbOIer>; // key: uid
  contests_map: Record<number, DbContest>; // key: contest_id
}

export interface ListSchoolsResponse extends ResponseBase, PaginationInfo {
  schools: DbSchool[];
}

export interface GetContestResponse extends ResponseBase {
  id: number;
  contest: DbContest;
  records: DbRecord[];
  schools: Record<number, DbSchool>; // key: school_id
  oiers: Record<number, DbOIer>; // key: uid
}

export interface ListContestsResponse extends ResponseBase, PaginationInfo {
  contests: DbContest[];
}

// ==============================
// Query Parameters Interfaces
// ==============================

export interface ListOIersQuery {
  name?: string | null; // 姓名（完全匹配）
  initials?: string | null; // 姓名拼音首字母（完全匹配）
  enroll_middle?: number | null; // 初中入学年份
  gender?: Gender | null; // 性别
  province?: string | null; // 省份
  page?: number; // 页码（默认为 1）
  perPage?: number; // 每页数量（默认为 20，最大 100）
}

export interface ListSchoolsQuery {
  name?: string | null; // 学校名称（包含匹配）
  province?: string | null; // 省份
  city?: string | null; // 城市
  page?: number; // 页码（默认为 1）
  perPage?: number; // 每页数量（默认为 20，最大 100）
}

export interface ListContestsQuery {
  type?: string | null; // 比赛类型
  year?: number | null; // 比赛年份
  page?: number; // 页码（默认为 1）
  perPage?: number; // 每页数量（默认为 20，最大 100）
}

// ==============================
// Adapter Interface
// ==============================

export interface IAdapter {
  /**
   * 检查可用性
   */
  checkAvailability(targetVersion: string): Promise<boolean>;

  /**
   * 获取选手信息
   * @param uid 选手 UID
   * @returns 选手信息及相关记录，若不存在则返回 null
   */
  getOIer(uid: number): Promise<GetOIerResponse | null>;

  /**
   * 获取选手列表
   * @param query 查询参数
   * @returns 符合查询条件的选手列表及相关信息
   */
  listOIers(query: ListOIersQuery): Promise<ListOIersResponse>;

  /**
   * 获取学校信息
   * @param id 学校 ID
   * @returns 学校信息及相关记录，若不存在则返回 null
   */
  getSchool(id: number): Promise<GetSchoolResponse | null>;

  /**
   * 获取学校列表
   * @param query 查询参数
   * @returns 符合查询条件的学校列表及相关信息
   */
  listSchools(query: ListSchoolsQuery): Promise<ListSchoolsResponse>;

  /**
   * 获取比赛信息
   * @param id 比赛 ID
   * @returns 比赛信息及相关记录，若不存在则返回 null
   */
  getContest(id: number): Promise<GetContestResponse | null>;

  /**
   * 获取比赛列表
   * @param query 查询参数
   * @returns 符合查询条件的比赛列表及相关信息
   */
  listContests(query: ListContestsQuery): Promise<ListContestsResponse>;
}

export interface IAdapterWithLoader extends IAdapter {
  loadData(result: DbParseResult): Promise<void>;
}
