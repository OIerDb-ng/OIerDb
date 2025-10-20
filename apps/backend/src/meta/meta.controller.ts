import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { VersionResponse } from '@oierdb/core';

import { MetaService } from './meta.service';

@ApiTags('meta')
@Controller('meta')
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  /**
   * 获取数据版本信息
   * @returns 版本信息
   */
  @Get('version')
  @ApiOperation({
    summary: '获取数据版本信息',
  })
  @ApiOkResponse({
    description: '数据版本信息',
  })
  async getVersion(): Promise<VersionResponse> {
    return await this.metaService.getVersion();
  }
}
