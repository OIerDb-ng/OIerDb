import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type GetSchoolResponse,
  type ListSchoolsQuery,
  type ListSchoolsResponse,
  type OIerDbClient,
} from '@oierdb/core';

import { OIERDB_CLIENT } from '~/common/oierdb';

@Injectable()
export class SchoolService {
  constructor(@Inject(OIERDB_CLIENT) private readonly oierDbClient: OIerDbClient) {}

  /**
   * 获取学校详细信息
   * @param id 学校 ID
   * @returns 学校信息及相关记录
   */
  async getSchool(id: number): Promise<GetSchoolResponse> {
    const result = await this.oierDbClient.getSchool(id);

    if (!result) {
      throw new NotFoundException(`School ${id} not found`);
    }

    return result;
  }

  /**
   * 获取学校列表
   * @param query 查询参数
   * @returns 符合条件的学校列表
   */
  async listSchools(query: ListSchoolsQuery = {}): Promise<ListSchoolsResponse> {
    return this.oierDbClient.listSchools(query);
  }
}
