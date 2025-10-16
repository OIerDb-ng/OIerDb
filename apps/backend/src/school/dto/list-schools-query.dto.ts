import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListSchoolsQueryDto {
  /**
   * 学校名称（包含匹配）
   */
  @ApiPropertyOptional({
    description: '学校名称',
    example: '实验中学',
  })
  @IsOptional()
  @IsString()
  name?: string;

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
   * 城市
   */
  @ApiPropertyOptional({
    description: '城市',
    example: '北京',
  })
  @IsOptional()
  @IsString()
  city?: string;

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
