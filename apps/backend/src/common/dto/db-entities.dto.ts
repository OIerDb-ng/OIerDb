import { ApiProperty } from '@nestjs/swagger';
import type { DbContest, DbOIer, DbRecord, DbSchool, Gender } from '@oierdb/core';

export class EnrollMiddleDto {
  @ApiProperty({ description: '是否留级', example: false })
  is_stay_down!: boolean;

  @ApiProperty({ description: '初中入学年份', example: 2020 })
  value!: number;
}

export class DbOIerDto implements DbOIer {
  @ApiProperty({ description: 'OIerDb UID', example: 1 })
  uid!: number;

  @ApiProperty({ description: '姓名', example: '张三' })
  name!: string;

  @ApiProperty({ description: '姓名（小写）', example: '张三' })
  lowered_name!: string;

  @ApiProperty({ description: '姓名拼音首字母（小写）', example: 'zs' })
  initials!: string;

  @ApiProperty({ description: '初中入学年份', example: 2020 })
  enroll_middle!: number;

  @ApiProperty({ description: '性别（-1：女；0：未知；1：男）', example: 1, enum: [-1, 0, 1] })
  gender!: Gender;

  @ApiProperty({ description: '省份列表', example: ['北京'], type: [String] })
  provinces!: string[];

  @ApiProperty({ description: '学校 ID 列表', example: [1, 2], type: [Number] })
  school_ids!: number[];

  @ApiProperty({ description: '参加的比赛 ID 列表', example: [1, 2, 3], type: [Number] })
  contest_ids!: number[];

  @ApiProperty({ description: 'OIerDb 分数', example: 100 })
  oierdb_score!: number;

  @ApiProperty({ description: 'CCF 等级', example: 1 })
  ccf_level!: number;

  @ApiProperty({ description: 'CCF 分数', example: 95 })
  ccf_score!: number;

  @ApiProperty({ description: 'OIerDb 排名（从 0 开始）', example: 0 })
  rank!: number;
}

export class DbRecordDto implements DbRecord {
  @ApiProperty({ description: '比赛 ID', example: 1 })
  contest_id!: number;

  @ApiProperty({ description: '学校 ID', example: 1 })
  school_id!: number;

  @ApiProperty({ description: '选手 ID', example: 1 })
  uid!: number;

  @ApiProperty({ description: '奖项', example: '金牌' })
  level!: string;

  @ApiProperty({ description: '分数', example: 100 })
  score!: number;

  @ApiProperty({ description: '名次', example: 1 })
  rank!: number;

  @ApiProperty({ description: '省份', example: '北京' })
  province!: string;

  @ApiProperty({
    description: '初中入学年份信息（可选）',
    required: false,
    type: EnrollMiddleDto,
    example: { is_stay_down: false, value: 2020 },
  })
  enroll_middle?: EnrollMiddleDto;
}

export class DbContestDto implements DbContest {
  @ApiProperty({ description: '比赛 ID', example: 1 })
  id!: number;

  @ApiProperty({ description: '比赛名称', example: 'NOI 2024' })
  name!: string;

  @ApiProperty({ description: '比赛年份', example: 2024 })
  year!: number;

  @ApiProperty({ description: '比赛类型', example: 'NOI' })
  type!: string;

  @ApiProperty({ description: '获奖选手 UID 列表', example: [1, 2, 3], type: [Number] })
  contestant_ids!: number[];

  @ApiProperty({ description: '是否为秋季学期', example: false })
  fall_semester!: boolean;

  @ApiProperty({ description: '满分', example: 600 })
  full_score!: number;

  @ApiProperty({ description: '参赛总人数', example: 300 })
  capacity!: number;

  @ApiProperty({ description: '获奖人数', example: 150 })
  length!: number;

  @ApiProperty({
    description: '奖项统计',
    type: 'object',
    additionalProperties: {
      type: 'number',
    },
    example: { 金牌: 30, 银牌: 60, 铜牌: 60 },
  })
  level_counts!: Record<string, number>;
}

export class DbSchoolDto implements DbSchool {
  @ApiProperty({ description: '学校 ID', example: 1 })
  id!: number;

  @ApiProperty({ description: '学校名称', example: '北京某中学' })
  name!: string;

  @ApiProperty({ description: '省份', example: '北京' })
  province!: string;

  @ApiProperty({ description: '城市', example: '北京市' })
  city!: string;

  @ApiProperty({ description: '学校分数', example: 1000 })
  score!: number;

  @ApiProperty({ description: '学校排名', example: 1 })
  rank!: number;

  @ApiProperty({ description: '学校成员 UID 列表', example: [1, 2, 3], type: [Number] })
  member_ids!: number[];

  @ApiProperty({
    description: '学校奖项统计（比赛类型 -> 年份 -> 奖项 -> 数量）',
    type: 'object',
    additionalProperties: true,
    example: { NOI: { '2024': { 金牌: 5, 银牌: 10 } } },
  })
  award_counts!: Record<string, Record<string, Record<string, number>>>;
}
