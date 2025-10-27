import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { GetOIerResponse, ListOIersResponse } from '@oierdb/core';

import { GetOIerResponseDto, ListOIersQueryDto, ListOIersResponseDto } from './dto';
import { OIerService } from './oier.service';

@ApiTags('选手')
@Controller('oier')
export class OIerController {
  constructor(private readonly oierService: OIerService) {}

  /**
   * 获取选手详细信息
   * GET /oier/:uid
   */
  @Get(':uid')
  @ApiOperation({ summary: '获取选手详细信息', description: '根据选手 ID 获取选手的详细信息' })
  @ApiParam({ name: 'uid', description: '选手 ID', type: Number, example: 1 })
  @ApiOkResponse({ description: '成功返回选手信息', type: GetOIerResponseDto })
  @ApiResponse({ status: 404, description: '选手不存在' })
  getOIer(@Param('uid', ParseIntPipe) uid: number): Promise<GetOIerResponse> {
    return this.oierService.getOIer(uid);
  }

  /**
   * 获取选手列表
   * GET /oier/list?name=xxx&initials=xxx&enroll_middle=2020&gender=1&province=xxx&page=1&perPage=20
   */
  @Get()
  @ApiOperation({ summary: '获取选手列表', description: '根据条件查询选手列表，支持分页' })
  @ApiOkResponse({ description: '成功返回选手列表', type: ListOIersResponseDto })
  listOIers(@Query() query: ListOIersQueryDto): Promise<ListOIersResponse> {
    return this.oierService.listOIers(query);
  }
}
