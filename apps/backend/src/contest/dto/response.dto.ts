import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { GetContestResponse, ListContestsResponse } from '@oierdb/core';

import { DbContestDto, DbOIerDto, DbRecordDto, DbSchoolDto } from '~/common/dto';
import { ResponseBaseDto } from '~/common/dto/response-base.dto';

@ApiExtraModels(DbSchoolDto, DbOIerDto)
export class GetContestResponseDto extends ResponseBaseDto implements GetContestResponse {
  @ApiProperty({ description: '比赛 ID', example: 1 })
  id!: number;

  @ApiProperty({ description: '比赛信息', type: DbContestDto })
  contest!: DbContestDto;

  @ApiProperty({ description: '参赛记录', type: [DbRecordDto] })
  records!: DbRecordDto[];

  @ApiProperty({
    description: '学校信息映射（key: school_id）',
    type: 'object',
    additionalProperties: {
      $ref: getSchemaPath(DbSchoolDto),
    },
  })
  schools_map!: Record<number, DbSchoolDto>;

  @ApiProperty({
    description: '选手信息映射（key: uid）',
    type: 'object',
    additionalProperties: {
      $ref: getSchemaPath(DbOIerDto),
    },
  })
  oiers_map!: Record<number, DbOIerDto>;

  @ApiProperty({ description: '当前页码', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页数量', example: 20 })
  perPage!: number;

  @ApiProperty({ description: '总数量', example: 100 })
  total!: number;

  @ApiProperty({ description: '总页数', example: 5 })
  totalPages!: number;
}

export class ListContestsResponseDto extends ResponseBaseDto implements ListContestsResponse {
  @ApiProperty({ description: '当前页码', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页数量', example: 20 })
  perPage!: number;

  @ApiProperty({ description: '总数量', example: 100 })
  total!: number;

  @ApiProperty({ description: '总页数', example: 5 })
  totalPages!: number;

  @ApiProperty({ description: '比赛列表', type: [DbContestDto] })
  contests!: DbContestDto[];
}
