import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import type { GetOIerResponse, ListOIersResponse } from '@oierdb/core';

import { ListOIersQueryDto } from './dto';
import { OierService } from './oier.service';

@Controller('oier')
export class OierController {
  constructor(private readonly oierService: OierService) {}

  /**
   * 获取选手详细信息
   * GET /oier/:uid
   */
  @Get(':uid')
  async getOIer(@Param('uid', ParseIntPipe) uid: number): Promise {
    return this.oierService.getOIer(uid);
  }

  /**
   * 获取选手列表
   * GET /oier/list?name=xxx&initials=xxx&enroll_middle=2020&gender=1&province=xxx&page=1&perPage=20
   */
  @Get()
  async listOIers(@Query() query: ListOIersQueryDto): Promise {
    return this.oierService.listOIers(query);
  }
}
