import { ApiPropertyOptional } from '@nestjs/swagger';
import type { Gender } from '@oierdb/core';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListOIersQueryDto {
  /**
   * 姓名
   */
  @ApiPropertyOptional({
    description: '姓名',
    example: '张三',
  })
  @IsOptional()
  @IsString()
  name?: string;

  /**
   * 姓名拼音首字母
   */
  @ApiPropertyOptional({
    description: '姓名拼音首字母（小写）',
    example: 'zs',
  })
  @IsOptional()
  @IsString()
  initials?: string;

  /**
   * 初中入学年份
   */
  @ApiPropertyOptional({
    description: '初中入学年份',
    minimum: 1990,
    maximum: 2990,
    example: 2020,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1990)
  @Max(2990)
  enroll_middle?: number;

  /**
   * 性别（-1: 女；0: 未知；1: 男）
   */
  @ApiPropertyOptional({
    description: '性别（-1: 女；0: 未知；1: 男）',
    enum: [-1, 0, 1],
    example: 1,
    enumName: 'Gender',
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([-1, 0, 1])
  gender?: Gender;

  /**
   * 省份
   */
  @ApiPropertyOptional({
    description: '省份',
    example: '北京',
  })
  @IsOptional()
  @IsString()
  province?: string;

  /**
   * 页码（默认为 1）
   */
  @ApiPropertyOptional({
    description: '页码',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /**
   * 每页数量（默认为 20，最大 100）
   */
  @ApiPropertyOptional({
    description: '每页数量',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;
}
