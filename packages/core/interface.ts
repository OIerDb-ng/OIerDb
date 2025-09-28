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

export interface OIer {
  uid: number; // OIerDb UID（为选手相关记录在 raw.txt 中首次出现的有效行号）
  name: string; // 姓名
  lowered_name: string; // 姓名（小写）
  initials: string; // 姓名拼音首字母（小写）
  enroll_middle: number; // 初中入学年份
  gender: Gender; // 性别
  provinces: string[]; // 省份列表
  school_ids: number[]; // 学校 ID 列表
  record_ids: number[]; // 记录 ID 列表
  oierdb_score: number; // OIerDb 分数
  ccf_level: number; // CCF 等级
  ccf_score: number; // CCF 分数
  rank: number; // OIerDb 排名（从 0 开始）
}

export interface Record {
  contest_id: number; // 比赛 ID
  school_id: number; // 学校 ID
  uid: number; // 选手 ID

  level: string; // 奖项
  score: number; // 分数
  rank: number; // 名次
  province: string; // 省份
}

export interface Contest {
  id: number; // 比赛 ID
  name: string; // 比赛名称
  year: number; // 比赛年份
  type: string; // 比赛类型（如 NOI、IOI、CCPC 等）
  contestant_ids: number[]; // 获奖选手 UID 列表
  fall_semester: boolean; // 是否为秋季学期
  full_score: number; // 满分
  capacity: number; // 参赛总人数（可能与 contestants.length 不同，因为有些选手可能没有成绩记录）
  length: number; // 获奖人数
  level_counts: Map<string, number>; // 奖项统计
}

export interface School {
  id: number; // 学校 ID
  name: string; // 学校名称
  province: string; // 省份
  city: string; // 城市
  score: number; // 学校分数
  rank: number; // 学校排名
  member_ids: number[]; // 学校成员 UID 列表
  record_ids: number[]; // 学校成员的记录 ID 列表
  award_counts: Map<string, Map<string, number>>; // 学校奖项统计（奖项 -> 年份 -> 数量）
}

export interface MetadataKV {
  key: string;
  value: string;
}

export interface ParseResult {
  needClearOldData: boolean;
  oiers: OIer[];
  schools: School[];
  contests: Contest[];
  records: Record[];
  metadata: MetadataKV[];
}

// ==============================
// Response Interfaces
// ==============================

export interface ResponseBase {
  success: boolean;
  message?: string; // 错误信息（仅在 success 为 false 时存在）
  backend_data_version: string; // 后端数据版本（通常为 SHA256 哈希值）
}

export interface GetOIerResponse extends ResponseBase {
  uid: number;
  oier: OIer;
  records: Map<number, Record>; // key: record_id
  schools: Map<number, School>; // key: school_id
  contests: Map<number, Contest>; // key: contest_id
}

export interface ListOIersResponse extends ResponseBase, PaginationInfo {
  oiers: OIer[];
}

export interface GetSchoolResponse extends ResponseBase {
  id: number;
  school: School;
  members: Map<number, OIer>; // key: uid
  contests: Map<number, Contest>; // key: contest_id
}

export interface ListSchoolsResponse extends ResponseBase, PaginationInfo {
  schools: School[];
}

export interface GetContestResponse extends ResponseBase {
  id: number;
  contest: Contest;
  records: Map<number, Record>; // key: record_id
  schools: Map<number, School>; // key: school_id
  oiers: Map<number, OIer>; // key: uid
}

export interface ListContestsResponse extends ResponseBase, PaginationInfo {
  contests: Contest[];
}

// ==============================
// Adapter Interface
// ==============================

export interface IAdapter {
  /**
   * 检查可用性
   */
  checkAvailability(): Promise<boolean>;

  /**
   * 获取选手信息
   * @param uid 选手 UID
   * @returns 选手信息及相关记录，若不存在则返回 null
   */
  getOIer(uid: number): Promise<GetOIerResponse | null>;

  /**
   * 获取选手列表
   * @param name 姓名（完全匹配）
   * @param initials 姓名拼音首字母（完全匹配）
   * @param enroll_middle 初中入学年份
   * @param gender 性别
   * @param province 省份
   * @param page 页码
   * @param perPage 每页数量（最大 100）
   * @returns 符合查询条件的选手列表及相关信息
   */
  listOIers(
    name: string | null, // full match
    initials: string | null, // full match
    enroll_middle: number | null,
    gender: Gender | null,
    province: string | null,
    page: number,
    perPage: number
  ): Promise<ListOIersResponse>;

  /**
   * 获取学校信息
   * @param id 学校 ID
   * @returns 学校信息及相关记录，若不存在则返回 null
   */
  getSchool(id: number): Promise<GetSchoolResponse | null>;

  /**
   * 获取学校列表
   * @param name 学校名称（模糊匹配）
   * @param province 省份
   * @param city 城市
   * @param page 页码
   * @param perPage 每页数量（最大 100）
   * @returns 符合查询条件的学校列表及相关信息
   */
  listSchools(
    name: string | null, // includes, not full match
    province: string | null,
    city: string | null,
    page: number,
    perPage: number
  ): Promise<ListSchoolsResponse>;

  /**
   * 获取比赛信息
   * @param id 比赛 ID
   * @returns 比赛信息及相关记录，若不存在则返回 null
   */
  getContest(id: number): Promise<GetContestResponse | null>;

  /**
   * 获取比赛列表
   * @param type 比赛类型
   * @param year 比赛年份
   * @param page 页码
   * @param perPage 每页数量（最大 100）
   */
  listContests(
    type: string | null,
    year: number | null,
    page: number,
    perPage: number
  ): Promise<ListContestsResponse>;
}

export interface IAdapterWithLoader extends IAdapter {
  loadData(result: ParseResult): Promise<void>;
}
