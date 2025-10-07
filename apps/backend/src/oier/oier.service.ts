import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetOIerResponse, ListOIersQuery, ListOIersResponse, OIerDbClient } from '@oierdb/core';

import { OIERDB_CLIENT } from '../common/oierdb';

@Injectable()
export class OierService {
  constructor(
    @Inject(OIERDB_CLIENT)
    private readonly oierDbClient: OIerDbClient
  ) {}

  /**
   * 获取选手详细信息
   * @param uid 选手 UID
   * @returns 选手信息及相关记录
   */
  async getOIer(uid: number): Promise {
    const result = await this.oierDbClient.getOIer(uid);

    if (!result) {
      throw new NotFoundException(`OIer ${uid} not found`);
    }

    return result;
  }

  /**
   * 获取选手列表
   * @param query 查询参数
   * @returns 符合条件的选手列表
   */
  async listOIers(query: ListOIersQuery = {}): Promise {
    return this.oierDbClient.listOIers(query);
  }
}
