/**
 * @jest-environment node
 */

import { parseOIerDbData } from '@oierdb/parser';
import 'fake-indexeddb/auto';

import { IDBAdapter } from '../adapter';

const RESULT_TXT_URL =
  'https://raw.githubusercontent.com/OIerDb-ng/OIerDb-data-generator/refs/heads/gh-pages/result.txt';
const STATIC_JSON_URL =
  'https://raw.githubusercontent.com/OIerDb-ng/OIerDb-data-generator/refs/heads/gh-pages/static.json';

describe('IDBAdapter with Real Data', () => {
  let adapter: IDBAdapter;

  beforeAll(async () => {
    // 从远程 URL 加载真实数据
    console.log('正在从远程 URL 加载数据...');

    try {
      const startDownload = Date.now();
      const [resultText, staticJsonText] = await Promise.all([
        fetch(RESULT_TXT_URL).then((res) => res.text()),
        fetch(STATIC_JSON_URL).then((res) => res.text()),
      ]);
      console.log(`数据下载完成，耗时 ${Date.now() - startDownload}ms`);

      // 解析数据
      const startParse = Date.now();
      const parseResult = parseOIerDbData(resultText, staticJsonText);
      console.log(
        `解析完成，耗时 ${Date.now() - startParse}ms: oiers=${parseResult.oiers.length}, schools=${parseResult.schools.length}, contests=${parseResult.contests.length}, records=${parseResult.records.length}`,
      );

      // 创建 adapter 并加载数据
      adapter = new IDBAdapter(indexedDB, IDBKeyRange);
      const startLoad = Date.now();
      await adapter.loadData(parseResult);
      console.log(`数据加载完成，耗时 ${Date.now() - startLoad}ms！`);
    } catch (error) {
      console.error('数据加载失败:', error);
      throw error;
    }
  }, 300000); // 增加超时时间到 5 分钟

  afterAll(async () => {
    // 清理数据库
    if (indexedDB.databases) {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases.map((db) => {
          if (db.name) {
            const deleteReq = indexedDB.deleteDatabase(db.name);
            return new Promise<void>((resolve, reject) => {
              deleteReq.onsuccess = () => resolve();
              deleteReq.onerror = () => reject(deleteReq.error);
              deleteReq.onblocked = () => {
                setTimeout(() => resolve(), 100);
              };
            });
          }
          return Promise.resolve();
        }),
      );
    }
  });

  describe('测试真实选手数据 - 虞皓翔', () => {
    const YU_HAO_XIANG_UID = 23851;

    it('应该能够获取虞皓翔的详细信息', async () => {
      const response = await adapter.getOIer(YU_HAO_XIANG_UID);

      expect(response).not.toBeNull();
      expect(response!.uid).toBe(YU_HAO_XIANG_UID);
      expect(response!.oier.name).toBe('虞皓翔');
      expect(response!.oier.initials).toBe('yhx');
    });

    it('应该返回虞皓翔的所有比赛记录', async () => {
      const response = await adapter.getOIer(YU_HAO_XIANG_UID);

      expect(response).not.toBeNull();
      expect(response!.records.length).toBeGreaterThan(0);

      // 验证记录包含完整的信息
      response!.records.forEach((record) => {
        expect(record.uid).toBe(YU_HAO_XIANG_UID);
        expect(record.contest_id).toBeDefined();
        expect(record.school_id).toBeDefined();
        expect(record.level).toBeDefined();
      });
    });

    it('应该返回虞皓翔关联的学校和比赛信息', async () => {
      const response = await adapter.getOIer(YU_HAO_XIANG_UID);

      expect(response).not.toBeNull();
      expect(Object.keys(response!.schools_map).length).toBeGreaterThan(0);
      expect(Object.keys(response!.contests_map).length).toBeGreaterThan(0);

      // 验证关联数据的完整性
      response!.records.forEach((record) => {
        expect(response!.schools_map[record.school_id]).toBeDefined();
        expect(response!.contests_map[record.contest_id]).toBeDefined();
      });
    });

    it('应该能够通过名字搜索到虞皓翔', async () => {
      const response = await adapter.listOIers({ name: '虞皓翔', page: 1, perPage: 10 });

      expect(response.oiers.length).toBeGreaterThan(0);
      const found = response.oiers.some((oier) => oier.uid === YU_HAO_XIANG_UID);
      expect(found).toBe(true);
    });

    it('应该能够通过拼音首字母搜索到虞皓翔', async () => {
      const response = await adapter.listOIers({ initials: 'yhx', page: 1, perPage: 10 });

      expect(response.oiers.length).toBeGreaterThan(0);
      const found = response.oiers.some((oier) => oier.uid === YU_HAO_XIANG_UID);
      expect(found).toBe(true);
    });

    it('应该能通过拼音首字母和省份搜索到虞皓翔', async () => {
      const response = await adapter.listOIers({
        initials: 'yhx',
        province: '浙江',
        page: 1,
        perPage: 10,
      });

      expect(response.oiers.length).toBeGreaterThan(0);
      const found = response.oiers.some((oier) => oier.uid === YU_HAO_XIANG_UID);
      expect(found).toBe(true);
    });
  });

  describe('测试真实学校数据 - 宁波市镇海中学', () => {
    const NINGBO_ZHENHAI_SCHOOL_ID = 34;

    it('应该能够获取宁波市镇海中学的详细信息', async () => {
      const response = await adapter.getSchool(NINGBO_ZHENHAI_SCHOOL_ID);

      expect(response).not.toBeNull();
      expect(response!.id).toBe(NINGBO_ZHENHAI_SCHOOL_ID);
      expect(response!.school.name).toContain('镇海');
      expect(response!.school.province).toBe('浙江');
      expect(response!.school.city).toBe('宁波市');
    });

    it('应该返回宁波市镇海中学的所有成员', async () => {
      const response = await adapter.getSchool(NINGBO_ZHENHAI_SCHOOL_ID);

      expect(response).not.toBeNull();
      expect(response!.school.member_ids.length).toBeGreaterThan(0);
      expect(Object.keys(response!.members_map).length).toBeGreaterThan(0);

      // 验证成员数据的一致性
      response!.school.member_ids.forEach((uid) => {
        expect(response!.members_map[uid]).toBeDefined();
      });
    });

    it('应该能够通过省份和城市筛选到该学校', async () => {
      const response = await adapter.listSchools({
        province: '浙江',
        city: '宁波市',
        page: 1,
        perPage: 100,
      });

      expect(response.schools.length).toBeGreaterThan(0);
      const found = response.schools.some((school) => school.id === NINGBO_ZHENHAI_SCHOOL_ID);
      expect(found).toBe(true);
    });
  });

  describe('测试真实比赛数据 - NOIP2024', () => {
    const NOIP2024_ID = 125;

    it('应该能够获取 NOIP2024 的详细信息', async () => {
      const response = await adapter.getContest(NOIP2024_ID);

      expect(response).not.toBeNull();
      expect(response!.id).toBe(NOIP2024_ID);
      expect(response!.contest.name).toContain('NOIP');
      expect(response!.contest.name).toContain('2024');
      expect(response!.contest.year).toBe(2024);
    });

    it('应该返回 NOIP2024 的所有参赛记录', async () => {
      const response = await adapter.getContest(NOIP2024_ID);

      expect(response).not.toBeNull();
      expect(response!.records.length).toBeGreaterThan(0);

      // 验证记录的完整性
      response!.records.forEach((record) => {
        expect(record.contest_id).toBe(NOIP2024_ID);
        expect(record.uid).toBeDefined();
        expect(record.school_id).toBeDefined();
      });
    });

    it('应该包含参赛选手和学校的映射信息', async () => {
      const response = await adapter.getContest(NOIP2024_ID);

      expect(response).not.toBeNull();
      expect(Object.keys(response!.oiers_map).length).toBeGreaterThan(0);
      expect(Object.keys(response!.schools_map).length).toBeGreaterThan(0);

      // 验证映射数据的一致性
      response!.records.forEach((record) => {
        expect(response!.oiers_map[record.uid]).toBeDefined();
        expect(response!.schools_map[record.school_id]).toBeDefined();
      });
    });

    it('应该能够通过年份和类型筛选到该比赛', async () => {
      const response = await adapter.listContests({
        year: 2024,
        type: 'NOIP',
        page: 1,
        perPage: 10,
      });

      expect(response.contests.length).toBeGreaterThan(0);
      const found = response.contests.some((contest) => contest.id === NOIP2024_ID);
      expect(found).toBe(true);
    });

    it('应该支持分页获取比赛记录', async () => {
      // 获取第一页
      const page1 = await adapter.getContest(NOIP2024_ID, 1, 10);
      expect(page1).not.toBeNull();
      expect(page1!.page).toBe(1);
      expect(page1!.perPage).toBe(10);
      expect(page1!.records.length).toBeLessThanOrEqual(10);
      expect(page1!.total).toBeGreaterThan(0);
      expect(page1!.totalPages).toBeGreaterThan(0);

      // 获取第二页
      const page2 = await adapter.getContest(NOIP2024_ID, 2, 10);
      expect(page2).not.toBeNull();
      expect(page2!.page).toBe(2);
      expect(page2!.records.length).toBeLessThanOrEqual(10);
      expect(page2!.total).toBe(page1!.total); // 总数应该相同

      // 确保两页的记录不重复
      const page1Uids = new Set(page1!.records.map((r) => r.uid));
      const page2Uids = new Set(page2!.records.map((r) => r.uid));
      const intersection = [...page1Uids].filter((uid) => page2Uids.has(uid));
      expect(intersection.length).toBe(0);
    });

    it('应该按 rank 升序返回记录', async () => {
      const response = await adapter.getContest(NOIP2024_ID, 1, 50);
      expect(response).not.toBeNull();

      for (let i = 1; i < response!.records.length; i++) {
        expect(response!.records[i].rank).toBeGreaterThanOrEqual(response!.records[i - 1].rank);
      }
    });

    it('应该使用默认分页参数', async () => {
      const response = await adapter.getContest(NOIP2024_ID);
      expect(response).not.toBeNull();
      expect(response!.page).toBe(1);
      expect(response!.perPage).toBe(20); // 默认每页 20 条
      expect(response!.records.length).toBeLessThanOrEqual(20);
    });

    it('分页查询应该比获取全部记录更快', async () => {
      // 获取第一页（只有 20 条记录）
      const startPaginated = Date.now();
      const paginatedResponse = await adapter.getContest(NOIP2024_ID, 1, 20);
      const paginatedTime = Date.now() - startPaginated;

      // 获取大量记录（100 条）
      const startLarge = Date.now();
      const largeResponse = await adapter.getContest(NOIP2024_ID, 1, 100);
      const largeTime = Date.now() - startLarge;

      expect(paginatedResponse).not.toBeNull();
      expect(largeResponse).not.toBeNull();
      expect(paginatedResponse!.records.length).toBe(20);
      expect(largeResponse!.records.length).toBeGreaterThanOrEqual(100);

      // 分页查询应该更快（允许一些误差）
      console.log(`分页查询 (20 条): ${paginatedTime}ms`);
      console.log(`大量查询 (100 条): ${largeTime}ms`);
      expect(paginatedTime).toBeLessThan(largeTime * 2); // 宽松的性能要求
    });
  });

  describe('数据完整性和一致性测试', () => {
    it('数据版本应该存在', async () => {
      const oierResponse = await adapter.getOIer(23851);
      expect(oierResponse).not.toBeNull();
      expect(oierResponse!.data_version).toBeDefined();
      expect(oierResponse!.data_version).not.toBe('');
    });

    it('选手、学校、比赛的引用应该保持一致', async () => {
      const oierResponse = await adapter.getOIer(23851);
      expect(oierResponse).not.toBeNull();

      oierResponse!.records.forEach((record) => {
        expect(oierResponse!.schools_map[record.school_id]).toBeDefined();
        expect(oierResponse!.contests_map[record.contest_id]).toBeDefined();
      });
    });

    it('分页功能应该正常工作', async () => {
      const page1 = await adapter.listOIers({ page: 1, perPage: 10 });
      const page2 = await adapter.listOIers({ page: 2, perPage: 10 });

      expect(page1.oiers.length).toBeGreaterThan(0);
      expect(page2.oiers.length).toBeGreaterThan(0);
      expect(page1.total).toBe(page2.total);

      // 确保两页的数据不重复
      const page1Uids = new Set(page1.oiers.map((o) => o.uid));
      const page2Uids = new Set(page2.oiers.map((o) => o.uid));
      const intersection = [...page1Uids].filter((uid) => page2Uids.has(uid));
      expect(intersection.length).toBe(0);
    });
  });
});
