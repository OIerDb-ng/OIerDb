import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type GetOIerResponse,
  type ListOIersQuery,
  type ListOIersResponse,
  OIerDbClient,
} from '@oierdb/core';

import { OIERDB_CLIENT } from '~/common/oierdb';

@Injectable()
export class OIerService {
  constructor(@Inject(OIERDB_CLIENT) private readonly oierDbClient: OIerDbClient) {}

  /**
   * 获取选手详细信息
   * @param uid 选手 UID
   * @returns 选手信息及相关记录
   */
  async getOIer(uid: number): Promise<GetOIerResponse> {
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
  async listOIers(query: ListOIersQuery = {}): Promise<ListOIersResponse> {
    return this.oierDbClient.listOIers(query);
  }
}
