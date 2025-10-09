import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import type { GetSchoolResponse, ListSchoolsResponse } from '@oierdb/core';

import { ListSchoolsQueryDto } from './dto';
import { SchoolService } from './school.service';

@Controller('school')
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  /**
   * 获取学校详细信息
   * GET /school/:id
   */
  @Get(':id')
  getSchool(@Param('id', ParseIntPipe) id: number): Promise<GetSchoolResponse> {
    return this.schoolService.getSchool(id);
  }

  /**
   * 获取学校列表
   * GET /school/list?name=xxx&province=xxx&city=xxx&page=1&perPage=20
   */
  @Get()
  listSchools(@Query() query: ListSchoolsQueryDto): Promise<ListSchoolsResponse> {
    return this.schoolService.listSchools(query);
  }
}
