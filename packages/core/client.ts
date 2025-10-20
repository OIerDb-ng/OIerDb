import QuickLRU from 'quick-lru';

import type {
  GetContestResponse,
  GetOIerResponse,
  GetSchoolResponse,
  IAdapter,
  ListContestsQuery,
  ListContestsResponse,
  ListOIersQuery,
  ListOIersResponse,
  ListSchoolsQuery,
  ListSchoolsResponse,
  VersionResponse,
} from './interface';

export interface OIerDbClientOptions {
  /**
   * 缓存配置
   */
  cache?: {
    /**
     * 是否启用缓存，默认为 true
     */
    enabled?: boolean;
    /**
     * 缓存的最大条目数，默认为 1000
     */
    maxSize?: number;
  };
}

export class OIerDbClient {
  private adapter: IAdapter;
  private cacheEnabled: boolean;
  private cache: QuickLRU<string, GetOIerResponse | GetSchoolResponse | GetContestResponse | null>;

  constructor(adapter: IAdapter, options: OIerDbClientOptions = {}) {
    this.adapter = adapter;

    const cacheConfig = options.cache ?? {};
    this.cacheEnabled = cacheConfig.enabled ?? true;
    const maxSize = cacheConfig.maxSize ?? 2000;

    this.cache = new QuickLRU({ maxSize });
  }

  private getCacheKey(type: 'oier' | 'school' | 'contest', id: number, ...extra: any[]): string {
    return `${type}:${id}:${extra.join(':')}`;
  }

  setAdapter(adapter: IAdapter): void {
    this.adapter = adapter;
    this.clearCache();
  }

  getAdapter(): IAdapter {
    return this.adapter;
  }

  clearCache(): void {
    this.cache.clear();
  }

  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }

  isCacheEnabled(): boolean {
    return this.cacheEnabled;
  }

  /**
   * 检查可用性
   * @param targetVersion 期望数据版本
   */
  async checkAvailability(targetVersion: string): Promise<boolean> {
    return this.adapter.checkAvailability(targetVersion);
  }

  /**
   * 获取数据版本
   * @returns 数据版本信息
   */
  async getVersion(): Promise<VersionResponse> {
    return this.adapter.getVersion();
  }

  /**
   * 获取选手信息
   * @param uid 选手 UID
   * @returns 选手信息及相关记录，若不存在则返回 null
   */
  async getOIer(uid: number): Promise<GetOIerResponse | null> {
    const cacheKey = this.getCacheKey('oier', uid);

    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as GetOIerResponse | null;
    }

    const result = await this.adapter.getOIer(uid);

    if (this.cacheEnabled) {
      this.cache.set(cacheKey, result);
    }

    return result;
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
    const cacheKey = this.getCacheKey('school', id);

    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as GetSchoolResponse | null;
    }

    const result = await this.adapter.getSchool(id);

    if (this.cacheEnabled) {
      this.cache.set(cacheKey, result);
    }

    return result;
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
  async getContest(
    id: number,
    page?: number,
    perPage?: number,
  ): Promise<GetContestResponse | null> {
    const cacheKey = this.getCacheKey('contest', id, page, perPage);

    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as GetContestResponse | null;
    }

    const result = await this.adapter.getContest(id, page, perPage);

    if (this.cacheEnabled) {
      this.cache.set(cacheKey, result);
    }

    return result;
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
