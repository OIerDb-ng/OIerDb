import { Inject, Injectable } from '@nestjs/common';
import { type OIerDbClient, type VersionResponse } from '@oierdb/core';

import { OIERDB_CLIENT } from '~/common/oierdb';

@Injectable()
export class MetaService {
  constructor(@Inject(OIERDB_CLIENT) private readonly oierDbClient: OIerDbClient) {}

  /**
   * 获取数据版本信息
   * @returns 版本信息
   */
  async getVersion(): Promise<VersionResponse> {
    return this.oierDbClient.getVersion();
  }
}
