import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type GetContestResponse,
  type ListContestsQuery,
  type ListContestsResponse,
  type OIerDbClient,
} from '@oierdb/core';

import { OIERDB_CLIENT } from '~/common/oierdb';

@Injectable()
export class ContestService {
  constructor(@Inject(OIERDB_CLIENT) private readonly oierDbClient: OIerDbClient) {}

  /**
   * 获取比赛详细信息
   * @param id 比赛 ID
   * @returns 比赛信息及相关记录
   */
  async getContest(id: number, page?: number, perPage?: number): Promise<GetContestResponse> {
    const result = await this.oierDbClient.getContest(id, page, perPage);

    if (!result) {
      throw new NotFoundException(`Contest ${id} not found`);
    }

    return result;
  }

  /**
   * 获取比赛列表
   * @param query 查询参数
   * @returns 符合条件的比赛列表
   */
  async listContests(query: ListContestsQuery = {}): Promise<ListContestsResponse> {
    return this.oierDbClient.listContests(query);
  }
}
