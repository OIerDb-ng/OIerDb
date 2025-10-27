import { ApiProperty } from '@nestjs/swagger';
import type { PaginationInfo } from '@oierdb/core';

export class PaginationInfoDto implements PaginationInfo {
  @ApiProperty({
    description: '当前页码',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: '每页数量',
    example: 20,
  })
  perPage!: number;

  @ApiProperty({
    description: '总数量',
    example: 100,
  })
  total!: number;

  @ApiProperty({
    description: '总页数',
    example: 5,
  })
  totalPages!: number;
}
