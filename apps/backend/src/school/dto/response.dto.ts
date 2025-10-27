import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { GetSchoolResponse, ListSchoolsResponse } from '@oierdb/core';

import { DbContestDto, DbOIerDto, DbSchoolDto } from '../../common/dto';
import { ResponseBaseDto } from '../../common/dto/response-base.dto';

@ApiExtraModels(DbOIerDto, DbContestDto)
export class GetSchoolResponseDto extends ResponseBaseDto implements GetSchoolResponse {
  @ApiProperty({ description: '学校 ID', example: 1 })
  id!: number;

  @ApiProperty({ description: '学校信息', type: DbSchoolDto })
  school!: DbSchoolDto;

  @ApiProperty({
    description: '学校成员信息映射（key: uid）',
    type: 'object',
    additionalProperties: {
      $ref: getSchemaPath(DbOIerDto),
    },
  })
  members_map!: Record<number, DbOIerDto>;

  @ApiProperty({
    description: '比赛信息映射（key: contest_id）',
    type: 'object',
    additionalProperties: {
      $ref: getSchemaPath(DbContestDto),
    },
  })
  contests_map!: Record<number, DbContestDto>;
}

export class ListSchoolsResponseDto extends ResponseBaseDto implements ListSchoolsResponse {
  @ApiProperty({ description: '当前页码', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页数量', example: 20 })
  perPage!: number;

  @ApiProperty({ description: '总数量', example: 100 })
  total!: number;

  @ApiProperty({ description: '总页数', example: 5 })
  totalPages!: number;

  @ApiProperty({ description: '学校列表', type: [DbSchoolDto] })
  schools!: DbSchoolDto[];
}
