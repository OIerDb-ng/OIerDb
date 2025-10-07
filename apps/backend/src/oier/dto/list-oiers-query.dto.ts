import type { Gender } from '@oierdb/core';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListOIersQueryDto {
  /**
   * 姓名
   */
  @IsOptional()
  @IsString()
  name?: string;

  /**
   * 姓名拼音首字母
   */
  @IsOptional()
  @IsString()
  initials?: string;

  /**
   * 初中入学年份
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1990)
  @Max(2990)
  enroll_middle?: number;

  /**
   * 性别（-1: 女；0: 未知；1: 男）
   */
  @IsOptional()
  @Type(() => Number)
  @IsIn([-1, 0, 1])
  gender?: Gender;

  /**
   * 省份
   */
  @IsOptional()
  @IsString()
  province?: string;

  /**
   * 页码（默认为 1）
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /**
   * 每页数量（默认为 20，最大 100）
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;
}
