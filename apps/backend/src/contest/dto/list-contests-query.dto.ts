import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListContestsQueryDto {
  /**
   * 比赛类型
   */
  @ApiPropertyOptional({
    description: '比赛类型',
    example: 'NOI',
  })
  @IsOptional()
  @IsString()
  type?: string;

  /**
   * 比赛年份
   */
  @ApiPropertyOptional({
    description: '比赛年份',
    minimum: 1980,
    maximum: 2100,
    example: 2024,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1980)
  @Max(2100)
  year?: number;

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
