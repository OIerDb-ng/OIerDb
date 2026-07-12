/** 性别（-1：女；0：未知；1：男） */
export type Gender = -1 | 0 | 1;

export interface DbSummary {
  /** 数据版本；这个需要等待重构数据生成器的时候改成目前的 delta 序号，目前为数据的 sha 值 */
  version: string;
  /** 省份列表 */
  provinces: string[];
  /** 出现过的初中入学年份列表 */
  enrollMiddleYears: number[];
  /** 出现过的比赛类型列表 */
  contestTypes: string[];
  /** 奖项名称 */
  awards: string[];
  /** OIer 数量 */
  oierCount: number;
  /** 学校数量 */
  schoolCount: number;
  /** 比赛数量 */
  contestCount: number;
}

export interface DbOIer {
  // 主键 uid
  uid: number;

  /** 登记姓名 */
  name: string;
  loweredName: string;
  /** 拼音首字母 */
  initials: string;
  /** 初中入学年份 */
  enrollMiddle: number;
  /** 性别 */
  gender: Gender;
  /** 省份列表。根据 summary 的 provinces 确定名称 */
  provinces: number[];
  /** OIerDB 分数 */
  oierdbScore: number;
  /** CCF 等级 */
  ccfLevel: number;
  /** CCF 分数 */
  ccfScore: number;
  /** 排名 */
  rank: number;
}

export interface DbContest {
  // 主键 id
  id: number;

  /** 比赛名称 */
  name: string;
  /** 比赛年份 */
  year: number;
  /** 比赛类型。根据 summary 的 contestTypes 确定名称 */
  type: number;
  /** 是否秋季学期 */
  fallSemester: boolean;
  /** 满分 */
  fullScore: number;
  /** 比赛容量。部分比赛没有 */
  capacity?: number;
  /** 比赛时长（分钟） */
  length: number;
  /** 等级人数统计。根据 summary 的 awards 确定名称 */
  levelCounts: Record<number, number>;
}

export interface DbRecord {
  // 主键 (contestId, uid)
  contestId: number;
  uid: number;

  /** 学校 ID */
  schoolId: number;
  /** 奖项。需要根据 summary 的 awards 确定名称 */
  award: number;
  /** 得分 */
  score: number;
  /** 排名 */
  rank: number;
  /** 省份。根据 summary 的 provinces 确定名称 */
  province: number;
  /** 初中入学年份。根据 summary 的 enrollMiddleYears 确定年份 */
  enrollMiddle?: number;
  /** 是否留级（不可靠值） */
  isStayDown?: boolean;
}
