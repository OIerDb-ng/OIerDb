import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import type { GetContestResponse, ListContestsResponse } from '@oierdb/core';

import { ContestService } from './contest.service';
import { ListContestsQueryDto } from './dto';

@Controller('contest')
export class ContestController {
  constructor(private readonly contestService: ContestService) {}

  /**
   * 获取比赛详细信息
   * GET /contest/:id?page=1&perPage=20
   */
  @Get(':id')
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
  listContests(@Query() query: ListContestsQueryDto): Promise<ListContestsResponse> {
    return this.contestService.listContests(query);
  }
}
