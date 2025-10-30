import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import type { GetOIerResponse, ListOIersResponse } from '@oierdb/core';

import { DbContestDto, DbOIerDto, DbRecordDto, DbSchoolDto } from '~/common/dto';
import { ResponseBaseDto } from '~/common/dto/response-base.dto';

@ApiExtraModels(DbSchoolDto, DbContestDto)
export class GetOIerResponseDto extends ResponseBaseDto implements GetOIerResponse {
  @ApiProperty({ description: '选手 UID', example: 1 })
  uid!: number;

  @ApiProperty({ description: '选手信息', type: DbOIerDto })
  oier!: DbOIerDto;

  @ApiProperty({ description: '选手参赛记录', type: [DbRecordDto] })
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
    description: '比赛信息映射（key: contest_id）',
    type: 'object',
    additionalProperties: {
      $ref: getSchemaPath(DbContestDto),
    },
  })
  contests_map!: Record<number, DbContestDto>;
}

export class ListOIersResponseDto extends ResponseBaseDto implements ListOIersResponse {
  @ApiProperty({ description: '当前页码', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页数量', example: 20 })
  perPage!: number;

  @ApiProperty({ description: '总数量', example: 100 })
  total!: number;

  @ApiProperty({ description: '总页数', example: 5 })
  totalPages!: number;

  @ApiProperty({ description: '选手列表', type: [DbOIerDto] })
  oiers!: DbOIerDto[];
}
