import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { GetContestResponse, ListContestsResponse } from '@oierdb/core';

import { ContestService } from './contest.service';
import { ListContestsQueryDto } from './dto';

@ApiTags('比赛')
@Controller('contest')
export class ContestController {
  constructor(private readonly contestService: ContestService) {}

  /**
   * 获取比赛详细信息
   * GET /contest/:id?page=1&perPage=20
   */
  @Get(':id')
  @ApiOperation({
    summary: '获取比赛详细信息',
    description: '根据比赛 ID 获取比赛的详细信息及参赛选手',
  })
  @ApiParam({ name: 'id', description: '比赛 ID', type: Number, example: 1 })
  @ApiQuery({ name: 'page', required: false, description: '页码', type: Number, example: 1 })
  @ApiQuery({
    name: 'perPage',
    required: false,
    description: '每页数量',
    type: Number,
    example: 20,
  })
  @ApiResponse({ status: 200, description: '成功返回比赛信息' })
  @ApiResponse({ status: 404, description: '比赛不存在' })
  getContest(
    @Param('id', ParseIntPipe) id: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('perPage', new DefaultValuePipe(20), ParseIntPipe) perPage?: number,
  ): Promise<GetContestResponse> {
    return this.contestService.getContest(id, page, perPage);
  }

  /**
   * 获取比赛列表
   * GET /contest/list?type=NOI&year=2024&page=1&perPage=20
   */
  @Get()
  @ApiOperation({ summary: '获取比赛列表', description: '根据条件查询比赛列表，支持分页' })
  @ApiResponse({ status: 200, description: '成功返回比赛列表' })
  listContests(@Query() query: ListContestsQueryDto): Promise<ListContestsResponse> {
    return this.contestService.listContests(query);
  }
}
