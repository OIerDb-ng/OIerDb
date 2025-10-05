import type {
  IAdapter,
  GetOIerResponse,
  ListOIersResponse,
  GetSchoolResponse,
  ListSchoolsResponse,
  GetContestResponse,
  ListContestsResponse,
  ListOIersQuery,
  ListSchoolsQuery,
  ListContestsQuery,
} from './interface';

export class OIerDbClient {
  private adapter: IAdapter;

  constructor(adapter: IAdapter) {
    this.adapter = adapter;
  }

  setAdapter(adapter: IAdapter): void {
    this.adapter = adapter;
  }

  getAdapter(): IAdapter {
    return this.adapter;
  }

  /**
   * 检查可用性
   * @param targetVersion 期望数据版本
   */
  async checkAvailability(targetVersion: string): Promise<boolean> {
    return this.adapter.checkAvailability(targetVersion);
  }

  /**
   * 获取选手信息
   * @param uid 选手 UID
   * @returns 选手信息及相关记录，若不存在则返回 null
   */
  async getOIer(uid: number): Promise<GetOIerResponse | null> {
    return this.adapter.getOIer(uid);
  }

  /**
   * 获取选手列表
   * @param query 查询参数
   * @returns 符合查询条件的选手列表及相关信息
   */
  async listOIers(query: ListOIersQuery = {}): Promise<ListOIersResponse> {
    return this.adapter.listOIers(query);
  }

  /**
   * 获取学校信息
   * @param id 学校 ID
   * @returns 学校信息及相关记录，若不存在则返回 null
   */
  async getSchool(id: number): Promise<GetSchoolResponse | null> {
    return this.adapter.getSchool(id);
  }

  /**
   * 获取学校列表
   * @param query 查询参数
   * @returns 符合查询条件的学校列表及相关信息
   */
  async listSchools(query: ListSchoolsQuery = {}): Promise<ListSchoolsResponse> {
    return this.adapter.listSchools(query);
  }

  /**
   * 获取比赛信息
   * @param id 比赛 ID
   * @returns 比赛信息及相关记录，若不存在则返回 null
   */
  async getContest(id: number): Promise<GetContestResponse | null> {
    return this.adapter.getContest(id);
  }

  /**
   * 获取比赛列表
   * @param query 查询参数
   * @returns 符合查询条件的比赛列表及相关信息
   */
  async listContests(query: ListContestsQuery = {}): Promise<ListContestsResponse> {
    return this.adapter.listContests(query);
  }
}
