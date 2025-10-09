import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListSchoolsQueryDto {
  /**
   * 学校名称（包含匹配）
   */
  @IsOptional()
  @IsString()
  name?: string;

  /**
   * 省份
   */
  @IsOptional()
  @IsString()
  province?: string;

  /**
   * 城市
   */
  @IsOptional()
  @IsString()
  city?: string;

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
