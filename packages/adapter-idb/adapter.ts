import {
  AdapterNotReadyError, AdapterUnavailableError, InvalidQueryError,
  DbContest, DbOIer, DbSchool,
  IAdapter, NormalizedPage, PageParams, RequestOptions,
  GetContestResult, GetOIerResult, GetSchoolResult,
  ListContestsQuery, ListContestsResult,
  ListOIersQuery, ListOIersResult,
  ListSchoolsQuery, ListSchoolsResult,
  SearchContestsQuery, SearchContestsResult,
  SearchOIersQuery, SearchOIersResult,
  SearchSchoolsQuery, SearchSchoolsResult,
  StatusResult, SummaryResult,
  normalizePageParams, throwIfAborted,
} from '@oierdb/core';
import Dexie, { type Collection, type Table } from 'dexie';

import { createDatabase, type OIerDbDexie, type StoredOIer } from './database';
import type { IDBLoadFromStreamOptions, IDBLoadOptions, IDBLoadSession } from './loader';
import { createLoadSession } from './loader';

interface PageResult<T> extends NormalizedPage {
  items: T[];
  total: number;
  totalPages: number;
}

interface QueryCandidate<T> {
  collection: Collection<T>;
  ordered: boolean;
  covers: readonly string[];
}

export class IDBAdapter implements IAdapter {
  readonly type = 'idb' as const;

  private readonly db: OIerDbDexie;
  private loadRequest?: Promise<void>;
  private loadAbort?: AbortController;
  private activeLoad?: IDBLoadSession;
  private closed = false;

  constructor() {
    try {
      this.db = createDatabase();
    } catch (error) {
      throw new AdapterUnavailableError('IndexedDB is unavailable', this.type, error);
    }
  }

  async status(): Promise<StatusResult> {
    const version = await this.db.meta.get('version');
    return version
      ? { ready: true, version: version.value as string }
      : { ready: false, version: null };
  }

  async summary(options: RequestOptions = {}): Promise<SummaryResult> {
    throwIfAborted(options.signal);

    const [versionMeta, provinceMeta, yearMeta, typeMeta, awardMeta] = await this.db.meta.bulkGet([
      'version', 'provinces', 'enrollMiddleYears', 'contestTypes', 'awards',
    ]);
    if (!versionMeta || !provinceMeta || !yearMeta || !typeMeta || !awardMeta) {
      throw new AdapterNotReadyError('IndexedDB adapter is not ready', this.type);
    }
    const version = versionMeta.value as string;

    const [oierCount, schoolCount, contestCount] = await Promise.all([
      this.db.oiers.count(),
      this.db.schools.count(),
      this.db.contests.count(),
    ]);

    throwIfAborted(options.signal);
    await this.assertVersionUnchanged(version);
    return {
      version,
      provinces: provinceMeta.value as string[],
      enrollMiddleYears: yearMeta.value as number[],
      contestTypes: typeMeta.value as string[],
      awards: awardMeta.value as string[],
      oierCount,
      schoolCount,
      contestCount,
    };
  }

  async getOIer(uid: number, options: RequestOptions = {}): Promise<GetOIerResult | null> {
    throwIfAborted(options.signal);

    const [version, oier] = await Promise.all([
      this.requireVersion(),
      this.db.oiers.get(uid),
    ]);
    if (!oier) {
      await this.assertVersionUnchanged(version);
      return null;
    }

    const records = await this.db.recordEntries.where('uid').equals(uid).toArray();
    const [[hydratedOIer], schoolsMap, contestsMap] = await Promise.all([
      this.hydrateOIers([oier]),
      this.bulkMap(this.db.schools, records.map(record => record.schoolId), school => school.id),
      this.bulkMap(this.db.contests, records.map(record => record.contestId), contest => contest.id),
    ]);

    throwIfAborted(options.signal);
    await this.assertVersionUnchanged(version);
    return { version, oier: hydratedOIer, records, schoolsMap, contestsMap };
  }

  async listOIers(
    query: ListOIersQuery = {},
    options: RequestOptions = {}
  ): Promise<ListOIersResult> {
    return this.queryOIers(query, undefined, options);
  }

  async searchOIers(
    query: SearchOIersQuery,
    options: RequestOptions = {}
  ): Promise<SearchOIersResult> {
    const search = normalizeSearch(query.search);
    return this.queryOIers(query, search, options);
  }

  async getSchool(
    id: number,
    params: PageParams = {},
    options: RequestOptions = {}
  ): Promise<GetSchoolResult | null> {
    throwIfAborted(options.signal);
    const page = normalizePageParams(params);

    const [version, school] = await Promise.all([
      this.requireVersion(),
      this.db.schools.get(id),
    ]);
    if (!school) {
      await this.assertVersionUnchanged(version);
      return null;
    }

    const collection = this.db.recordEntries.where('schoolId').equals(id);
    const [total, records] = await Promise.all([
      collection.clone().count(),
      collection.clone().offset(page.offset).limit(page.perPage).toArray(),
    ]);
    const [membersMap, contestsMap] = await Promise.all([
      this.bulkOIersMap(records.map(record => record.uid)),
      this.bulkMap(this.db.contests, records.map(record => record.contestId), contest => contest.id),
    ]);

    throwIfAborted(options.signal);
    await this.assertVersionUnchanged(version);
    return {
      version,
      school,
      records,
      membersMap,
      contestsMap,
      page: page.page,
      perPage: page.perPage,
      total,
      totalPages: Math.ceil(total / page.perPage),
    };
  }

  async listSchools(
    query: ListSchoolsQuery = {},
    options: RequestOptions = {}
  ): Promise<ListSchoolsResult> {
    return this.querySchools(query, undefined, options);
  }

  async searchSchools(
    query: SearchSchoolsQuery,
    options: RequestOptions = {}
  ): Promise<SearchSchoolsResult> {
    const search = normalizeSearch(query.search);
    return this.querySchools(query, search, options);
  }

  async getContest(
    id: number,
    params: PageParams = {},
    options: RequestOptions = {}
  ): Promise<GetContestResult | null> {
    throwIfAborted(options.signal);
    const page = normalizePageParams(params);

    const [version, contest] = await Promise.all([
      this.requireVersion(),
      this.db.contests.get(id),
    ]);
    if (!contest) {
      await this.assertVersionUnchanged(version);
      return null;
    }

    const collection = this.db.recordEntries
      .where('[contestId+rank]')
      .between([id, Dexie.minKey], [id, Dexie.maxKey], true, true);
    const [total, records] = await Promise.all([
      collection.clone().count(),
      collection.offset(page.offset).limit(page.perPage).toArray(),
    ]);
    const [oiersMap, schoolsMap] = await Promise.all([
      this.bulkOIersMap(records.map(record => record.uid)),
      this.bulkMap(this.db.schools, records.map(record => record.schoolId), school => school.id),
    ]);

    throwIfAborted(options.signal);
    await this.assertVersionUnchanged(version);
    return {
      version,
      contest,
      records,
      oiersMap,
      schoolsMap,
      page: page.page,
      perPage: page.perPage,
      total,
      totalPages: Math.ceil(total / page.perPage),
    };
  }

  async listContests(
    query: ListContestsQuery = {},
    options: RequestOptions = {}
  ): Promise<ListContestsResult> {
    return this.queryContests(query, undefined, options);
  }

  async searchContests(
    query: SearchContestsQuery,
    options: RequestOptions = {}
  ): Promise<SearchContestsResult> {
    const search = normalizeSearch(query.search);
    return this.queryContests(query, search, options);
  }

  async beginLoad(options: IDBLoadOptions): Promise<IDBLoadSession> {
    if (this.closed) throw new AdapterUnavailableError('IndexedDB adapter is closed', this.type);
    if (this.loadRequest) throw new Error('An IndexedDB load session is already active');
    const locks = globalThis.navigator?.locks;
    if (!locks) throw new AdapterUnavailableError('Web Locks API is unavailable', this.type);

    const loadAbort = new AbortController();
    this.loadAbort = loadAbort;
    let resolveSession!: (session: IDBLoadSession) => void;
    let rejectSession!: (error: unknown) => void;
    const acquired = new Promise<IDBLoadSession>((resolve, reject) => {
      resolveSession = resolve;
      rejectSession = reject;
    });
    const onAbort = () => {
      loadAbort.abort(options.signal?.reason);
      void this.activeLoad?.abort().catch(() => {});
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) onAbort();

    let request: Promise<void>;
    try {
      request = locks.request(`${this.db.name}:load`, { mode: 'exclusive', signal: loadAbort.signal }, async () => {
        let release!: () => void;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        throwIfAborted(loadAbort.signal);

        const session = await createLoadSession(this.db, { ...options, signal: loadAbort.signal }, release);
        if (loadAbort.signal.aborted) {
          await session.abort();
          throw new DOMException('The operation was aborted', 'AbortError');
        }

        let pending: Promise<void> = Promise.resolve();
        const enqueue = (work: () => Promise<void>): Promise<void> => {
          const result = pending.then(work);
          pending = result.catch(() => {});
          return result;
        };
        const locked: IDBLoadSession = {
          resumeOffset: session.resumeOffset,
          alreadyLoaded: session.alreadyLoaded,
          pushChunk: chunk => enqueue(async () => {
            try {
              await session.pushChunk(chunk);
            } catch (error) {
              await session.abort();
              await request;
              throw error;
            }
          }),
          finish: () => enqueue(async () => {
            try {
              await session.finish();
            } finally {
              await request;
            }
          }),
          abort: () => enqueue(async () => {
            try {
              await session.abort();
            } finally {
              await request;
            }
          }),
        };

        this.activeLoad = locked;
        resolveSession(locked);
        await held;
      }).finally(() => {
        options.signal?.removeEventListener('abort', onAbort);
        this.activeLoad = undefined;
        this.loadAbort = undefined;
        this.loadRequest = undefined;
      });
    } catch (error) {
      options.signal?.removeEventListener('abort', onAbort);
      this.loadAbort = undefined;
      throw error;
    }

    this.loadRequest = request;
    void request.catch(rejectSession);
    return acquired;
  }

  async loadFromStream(options: IDBLoadFromStreamOptions): Promise<void> {
    const session = await this.beginLoad(options);

    try {
      if (!session.alreadyLoaded) {
        throwIfAborted(options.signal);
        for await (const chunk of await options.chunks()) await session.pushChunk(chunk);
      }

      await session.finish();
    } finally {
      await session.abort();
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.loadAbort?.abort();
    try {
      await this.activeLoad?.abort();
      await this.loadRequest?.catch(() => {});
    } finally {
      this.db.close();
    }
  }

  private async queryOIers(
    query: ListOIersQuery | SearchOIersQuery,
    search: string | undefined,
    options: RequestOptions
  ): Promise<ListOIersResult> {
    throwIfAborted(options.signal);
    const page = normalizePageParams(query);
    const name = 'name' in query ? query.name : undefined;
    const initials = 'initials' in query ? query.initials?.toLowerCase() : undefined;
    const { enrollMiddle, gender, province } = query;

    const version = await this.requireVersion();

    const candidates: QueryCandidate<StoredOIer>[] = [];
    const filters: Record<string, (oier: StoredOIer) => boolean> = {};
    if (name !== undefined) {
      filters.name = oier => oier.name === name;
      candidates.push({
        collection: this.db.oiers.where('name').equals(name), ordered: false, covers: ['name'],
      });
    }
    if (initials !== undefined) {
      filters.initials = oier => oier.initials.toLowerCase() === initials;
      candidates.push({
        collection: this.db.oiers.where('initials').equalsIgnoreCase(initials), ordered: false, covers: ['initials'],
      });
    }
    if (enrollMiddle !== undefined) {
      filters.enrollMiddle = oier => oier.enrollMiddle === enrollMiddle;
      candidates.push({
        collection: this.db.oiers.where('enrollMiddle').equals(enrollMiddle), ordered: false, covers: ['enrollMiddle'],
      });
    }
    if (gender !== undefined) {
      filters.gender = oier => oier.gender === gender;
      candidates.push({
        collection: this.db.oiers.where('gender').equals(gender), ordered: false, covers: ['gender'],
      });
    }
    if (search !== undefined) {
      filters.search = oier => oier.loweredName.includes(search) || oier.initials.toLowerCase().includes(search);
    }

    const total = province === undefined && Object.keys(filters).length === 0
      ? await this.db.meta.get('oierCount')
      : undefined;
    const knownTotal = typeof total?.value === 'number' ? total.value : undefined;
    const plan = await selectQueryPlan(this.db.oiers.orderBy('[rank+uid]'), candidates, filters);
    const result = province === undefined
      ? await paginate(
          plan.collection, page,
          plan.ordered ? undefined : (a, b) => a.rank - b.rank || a.uid - b.uid,
          knownTotal)
      : await this.paginateProvinceOIers(
          province, page, Object.keys(filters).length > 0 ? plan.collection : undefined);
    const oiers = await this.hydrateOIers(result.items);

    throwIfAborted(options.signal);
    await this.assertVersionUnchanged(version);
    return {
      version,
      page: result.page,
      perPage: result.perPage,
      total: result.total,
      totalPages: result.totalPages,
      oiers,
    };
  }

  private async paginateProvinceOIers(
    province: number,
    page: NormalizedPage,
    matches?: Collection<StoredOIer>
  ): Promise<PageResult<StoredOIer>> {
    let collection = this.db.oierProvinces
      .where('[province+rank+uid]')
      .between([province, Dexie.minKey], [province, Dexie.maxKey], true, true);

    if (matches) {
      const uids = new Set(await matches.primaryKeys());
      if (uids.size === 0) return { ...page, items: [], total: 0, totalPages: 0 };
      collection = collection.filter(entry => uids.has(entry.uid));
    }

    const result = await paginate(collection, page);
    const oiers = await this.db.oiers.bulkGet(result.items.map(entry => entry.uid));
    return { ...result, items: oiers.filter(oier => oier !== undefined) };
  }

  private async querySchools(
    query: ListSchoolsQuery | SearchSchoolsQuery,
    search: string | undefined,
    options: RequestOptions
  ): Promise<ListSchoolsResult> {
    throwIfAborted(options.signal);
    const page = normalizePageParams(query);
    const name = 'name' in query ? query.name : undefined;
    const { province, city } = query;

    const version = await this.requireVersion();

    const candidates: QueryCandidate<DbSchool>[] = [];
    const filters: Record<string, (school: DbSchool) => boolean> = {};
    if (province !== undefined) filters.province = school => school.province === province;
    if (city !== undefined) filters.city = school => school.city === city;
    if (province !== undefined && city !== undefined) {
      candidates.push({
        collection: this.db.schools.where('[province+city]').equals([province, city]),
        ordered: false,
        covers: ['province', 'city'],
      });
    } else if (province !== undefined) {
      candidates.push({
        collection: this.db.schools.where('[province+rank+id]')
          .between([province, Dexie.minKey], [province, Dexie.maxKey], true, true),
        ordered: true,
        covers: ['province'],
      });
    } else if (city !== undefined) {
      candidates.push({
        collection: this.db.schools.where('city').equals(city), ordered: false, covers: ['city'],
      });
    }
    if (name !== undefined) {
      filters.name = school => school.name === name;
      candidates.push({
        collection: this.db.schools.where('name').equals(name), ordered: false, covers: ['name'],
      });
    }
    if (search !== undefined) {
      filters.search = school => school.name.toLowerCase().includes(search);
    }

    const plan = await selectQueryPlan(this.db.schools.orderBy('[rank+id]'), candidates, filters);
    const result = await paginate(
      plan.collection, page,
      plan.ordered ? undefined : (a, b) => a.rank - b.rank || a.id - b.id);

    throwIfAborted(options.signal);
    await this.assertVersionUnchanged(version);
    return {
      version,
      page: result.page,
      perPage: result.perPage,
      total: result.total,
      totalPages: result.totalPages,
      schools: result.items,
    };
  }

  private async queryContests(
    query: ListContestsQuery | SearchContestsQuery,
    search: string | undefined,
    options: RequestOptions
  ): Promise<ListContestsResult> {
    throwIfAborted(options.signal);
    const page = normalizePageParams(query);
    const name = 'name' in query ? query.name : undefined;
    const { type, year } = query;

    const version = await this.requireVersion();

    const candidates: QueryCandidate<DbContest>[] = [];
    const filters: Record<string, (contest: DbContest) => boolean> = {};
    if (type !== undefined) filters.type = contest => contest.type === type;
    if (year !== undefined) filters.year = contest => contest.year === year;
    if (type !== undefined && year !== undefined) {
      candidates.push({
        collection: this.db.contests.where('[type+year]').equals([type, year]),
        ordered: false,
        covers: ['type', 'year'],
      });
    } else if (type !== undefined) {
      candidates.push({
        collection: this.db.contests.where('type').equals(type), ordered: false, covers: ['type'],
      });
    } else if (year !== undefined) {
      candidates.push({
        collection: this.db.contests.where('year').equals(year), ordered: false, covers: ['year'],
      });
    }
    if (name !== undefined) {
      filters.name = contest => contest.name === name;
      candidates.push({
        collection: this.db.contests.where('name').equals(name), ordered: false, covers: ['name'],
      });
    }
    if (search !== undefined) {
      filters.search = contest => contest.name.toLowerCase().includes(search);
    }

    const plan = await selectQueryPlan(this.db.contests.orderBy('id').reverse(), candidates, filters);
    const result = await paginate(
      plan.collection, page,
      plan.ordered ? undefined : (a, b) => b.id - a.id);

    throwIfAborted(options.signal);
    await this.assertVersionUnchanged(version);
    return {
      version,
      page: result.page,
      perPage: result.perPage,
      total: result.total,
      totalPages: result.totalPages,
      contests: result.items,
    };
  }

  private async requireVersion(): Promise<string> {
    const version = await this.db.meta.get('version');
    if (!version) {
      throw new AdapterNotReadyError('IndexedDB adapter is not ready', this.type);
    }
    return version.value as string;
  }

  private async assertVersionUnchanged(version: string): Promise<void> {
    const current = await this.db.meta.get('version');
    if (current?.value !== version) {
      throw new AdapterNotReadyError('Data version changed while querying', this.type);
    }
  }

  private async hydrateOIers(oiers: readonly StoredOIer[]): Promise<DbOIer[]> {
    if (oiers.length === 0) return [];

    const entries = await this.db.oierProvinces.where('uid').anyOf(oiers.map(oier => oier.uid)).toArray();
    const provincesMap = new Map<number, number[]>();
    for (const entry of entries) {
      const provinces = provincesMap.get(entry.uid) ?? [];
      provinces[entry.position] = entry.province;
      provincesMap.set(entry.uid, provinces);
    }
    return oiers.map(oier => ({ ...oier, provinces: provincesMap.get(oier.uid) ?? [] }));
  }

  private async bulkOIersMap(ids: readonly number[]): Promise<Record<number, DbOIer>> {
    const oiers = await this.bulkMap(this.db.oiers, ids, oier => oier.uid);
    const hydrated = await this.hydrateOIers(Object.values(oiers));
    return Object.fromEntries(hydrated.map(oier => [oier.uid, oier]));
  }

  private async bulkMap<T>(
    table: Table<T, number>,
    ids: readonly number[],
    keyOf: (item: T) => number
  ): Promise<Record<number, T>> {
    const keys = [...new Set(ids)];
    const items = await table.bulkGet(keys);

    const map: Record<number, T> = {};
    for (const item of items) {
      if (item !== undefined) map[keyOf(item)] = item;
    }

    return map;
  }
}

async function selectQueryPlan<T>(
  fallback: Collection<T>,
  candidates: readonly QueryCandidate<T>[],
  filters: Readonly<Record<string, (item: T) => boolean>>
) {
  let plan: QueryCandidate<T> = { collection: fallback, ordered: true, covers: [] };
  if (candidates.length === 1) {
    plan = candidates[0];
  } else if (candidates.length > 1) {
    const counts = await Promise.all(candidates.map(candidate => candidate.collection.clone().count()));
    let selected = 0;
    for (let index = 1; index < counts.length; index += 1) {
      if (counts[index] < counts[selected]) selected = index;
    }
    plan = candidates[selected];
  }

  const remaining = Object.entries(filters)
    .filter(([key]) => !plan.covers.includes(key))
    .map(([, matches]) => matches);
  const collection = remaining.length > 0
    ? plan.collection.filter(item => remaining.every(matches => matches(item)))
    : plan.collection;
  return { collection, ordered: plan.ordered };
}

async function paginate<T, TKey>(
  collection: Collection<T, TKey>,
  page: NormalizedPage,
  compare?: (left: T, right: T) => number,
  knownTotal?: number
): Promise<PageResult<T>> {
  if (compare) {
    const matches = await collection.toArray();
    matches.sort(compare);
    const total = matches.length;

    return {
      ...page,
      items: matches.slice(page.offset, page.offset + page.perPage),
      total,
      totalPages: Math.ceil(total / page.perPage),
    };
  }

  const [total, items] = await Promise.all([
    knownTotal ?? collection.clone().count(),
    collection.clone().offset(page.offset).limit(page.perPage).toArray(),
  ]);

  return { ...page, items, total, totalPages: Math.ceil(total / page.perPage) };
}

function normalizeSearch(value: string): string {
  const search = value.trim().toLowerCase();
  if (!search) throw new InvalidQueryError('Search must not be empty', 'search');
  return search;
}
