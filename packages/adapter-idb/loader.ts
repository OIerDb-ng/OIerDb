import {
  awards,
  contestTypes,
  provinces,
  throwIfAborted,
  type DbContest,
  type DbRecord,
  type DbSchool,
} from '@oierdb/core';
import { ResultParser, type ParsedOIer, type ParsedStatic } from '@oierdb/parser';

import { LOAD_BATCH_SIZE } from './constants';
import type { OIerDbDexie, OIerProvince, StoredOIer } from './database';

export interface IDBDataVersion {
  staticSha512: string;
  resultSha512: string;
}

export type IDBLoadPhase = 'parsing' | 'finalizing' | 'complete';

export interface IDBLoadProgress {
  phase: IDBLoadPhase;
  parsedOIers: number;
  committedOIers: number;
  committedRecords: number;
  resumeOffset: number;
}

export interface IDBLoadOptions {
  version: IDBDataVersion;
  staticData: ParsedStatic;
  signal?: AbortSignal;
  onProgress?: (progress: IDBLoadProgress) => void;
}

export interface IDBLoadSession {
  /** Committed OIer count, not a byte offset. Replay the same version's stream from the start. */
  readonly resumeOffset: number;
  readonly alreadyLoaded: boolean;

  pushChunk(chunk: string | Uint8Array): Promise<void>;
  finish(): Promise<void>;
  abort(): Promise<void>;
}

export interface IDBLoadFromStreamOptions extends IDBLoadOptions {
  /** Called under the load lock if needed; return the complete target version's stream from the start. */
  chunks: () => AsyncIterable<string | Uint8Array> | Promise<AsyncIterable<string | Uint8Array>>;
}

function formatDataVersion(version: IDBDataVersion): string {
  const { staticSha512, resultSha512 } = version;
  if (!staticSha512 || !resultSha512) {
    throw new TypeError('Both staticSha512 and resultSha512 are required');
  }
  return `${staticSha512}:${resultSha512}`;
}

const TARGET_VERSION_KEY = 'targetVersion';
const COMMITTED_OIERS_KEY = 'committedOIers';
const COMMITTED_RECORDS_KEY = 'committedRecords';

interface LoaderCheckpoint {
  committedOIers: number;
  committedRecords: number;
}

interface LoaderAggregates {
  enrollMiddleYears: Set<number>;
  schoolAwardCounts: Map<number, Record<number, number>>;
  contestLevelCounts: Map<number, Record<number, number>>;
  contestLengths: Map<number, number>;
}

export async function createLoadSession(
  db: OIerDbDexie,
  options: IDBLoadOptions,
  onClose: () => void
): Promise<IDBLoadSession> {
  const targetVersion = formatDataVersion(options.version);

  const published = await db.meta.get('version');
  if (published?.value === targetVersion) {
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      onClose();
    };
    return {
      resumeOffset: 0,
      alreadyLoaded: true,
      async pushChunk() {},
      async finish() {
        close();
      },
      async abort() {
        close();
      },
    };
  }

  const [target, committedOIers, committedRecords] = await db.loaderState.bulkGet([
    TARGET_VERSION_KEY,
    COMMITTED_OIERS_KEY,
    COMMITTED_RECORDS_KEY,
  ]);
  const checkpoint: LoaderCheckpoint = typeof target?.value === 'string' && target.value === targetVersion
    ? {
        committedOIers: typeof committedOIers?.value === 'number' ? committedOIers.value : 0,
        committedRecords: typeof committedRecords?.value === 'number' ? committedRecords.value : 0,
      }
    : await resetForLoad(db, targetVersion);

  return new StreamingLoadSession(
    db,
    options.staticData,
    targetVersion,
    checkpoint,
    options.signal,
    options.onProgress,
    onClose
  );
}

class StreamingLoadSession implements IDBLoadSession {
  readonly alreadyLoaded = false;
  readonly resumeOffset: number;

  private readonly parser = new ResultParser();
  private readonly aggregates: LoaderAggregates = {
    enrollMiddleYears: new Set(),
    schoolAwardCounts: new Map(),
    contestLevelCounts: new Map(),
    contestLengths: new Map(),
  };

  private bufferedOIers: StoredOIer[] = [];
  private bufferedProvinces: OIerProvince[] = [];
  private bufferedRecords: DbRecord[] = [];
  private committedOIers: number;
  private committedRecords: number;
  private readonly committedRecordsAtResume: number;
  private replayedRecords = 0;
  private closed = false;

  constructor(
    private readonly db: OIerDbDexie,
    private readonly staticData: ParsedStatic,
    private readonly targetVersion: string,
    checkpoint: LoaderCheckpoint,
    private readonly signal: AbortSignal | undefined,
    private readonly onProgress: ((progress: IDBLoadProgress) => void) | undefined,
    private readonly onClose: () => void
  ) {
    this.resumeOffset = checkpoint.committedOIers;
    this.committedOIers = checkpoint.committedOIers;
    this.committedRecords = checkpoint.committedRecords;
    this.committedRecordsAtResume = checkpoint.committedRecords;
  }

  async pushChunk(chunk: string | Uint8Array): Promise<void> {
    if (this.closed) throw new Error('The load session is already closed');
    throwIfAborted(this.signal);

    await this.consume(this.parser.push(chunk));
  }

  async finish(): Promise<void> {
    if (this.closed) throw new Error('The load session is already closed');

    try {
      throwIfAborted(this.signal);
      await this.consume(this.parser.finish());
      if (this.parser.count < this.resumeOffset) {
        throw new Error(
          `Result stream ended before resume offset ${this.resumeOffset} (got ${this.parser.count})`
        );
      }

      await this.flush();
      this.emitProgress('finalizing');

      throwIfAborted(this.signal);
      await this.publish();
      this.emitProgress('complete');
    } finally {
      this.close();
    }
  }

  async abort(): Promise<void> {
    this.close();
  }

  private async consume(parsed: readonly ParsedOIer[]): Promise<void> {
    const start = this.parser.count - parsed.length;
    for (let offset = 0; offset < parsed.length; offset += 1) {
      const oier = parsed[offset];
      throwIfAborted(this.signal);
      const index = start + offset;
      this.accumulate(oier);

      if (index < this.resumeOffset) {
        this.replayedRecords += oier.records.length;
        if (index + 1 === this.resumeOffset && this.replayedRecords !== this.committedRecordsAtResume) {
          throw new Error(
            `Resume checkpoint record count mismatch: expected ${this.committedRecordsAtResume}, got ${this.replayedRecords}`
          );
        }
        continue;
      }

      const { records, ...fields } = oier;
      this.bufferedOIers.push(fields);
      const provinces = [...new Set(records.map(record => record.province))];
      this.bufferedProvinces.push(...provinces.map((province, position) => ({
        uid: oier.uid, province, rank: oier.rank, position,
      })));
      this.bufferedRecords.push(...records);
      if (this.bufferedOIers.length >= LOAD_BATCH_SIZE) await this.flush();
    }

    this.emitProgress('parsing');
  }

  private accumulate(oier: ParsedOIer): void {
    this.aggregates.enrollMiddleYears.add(oier.enrollMiddle);
    for (const record of oier.records) {
      const schoolCounts = this.aggregates.schoolAwardCounts.get(record.schoolId) ?? {};
      schoolCounts[record.award] = (schoolCounts[record.award] ?? 0) + 1;
      this.aggregates.schoolAwardCounts.set(record.schoolId, schoolCounts);

      const contestCounts = this.aggregates.contestLevelCounts.get(record.contestId) ?? {};
      contestCounts[record.award] = (contestCounts[record.award] ?? 0) + 1;
      this.aggregates.contestLevelCounts.set(record.contestId, contestCounts);
      this.aggregates.contestLengths.set(
        record.contestId,
        (this.aggregates.contestLengths.get(record.contestId) ?? 0) + 1
      );
    }
  }

  private async flush(): Promise<void> {
    if (this.bufferedOIers.length === 0) return;

    const oiers = this.bufferedOIers;
    const provinces = this.bufferedProvinces;
    const records = this.bufferedRecords;
    const nextOIers = this.committedOIers + oiers.length;
    const nextRecords = this.committedRecords + records.length;

    await this.db.transaction(
      'rw',
      this.db.oiers,
      this.db.oierProvinces,
      this.db.recordEntries,
      this.db.loaderState,
      async () => {
        await this.db.oiers.bulkAdd(oiers);
        if (provinces.length > 0) await this.db.oierProvinces.bulkAdd(provinces);
        if (records.length > 0) await this.db.recordEntries.bulkAdd(records);
        await this.db.loaderState.bulkPut([
          { key: COMMITTED_OIERS_KEY, value: nextOIers },
          { key: COMMITTED_RECORDS_KEY, value: nextRecords },
        ]);
      }
    );

    this.bufferedOIers = [];
    this.bufferedProvinces = [];
    this.bufferedRecords = [];
    this.committedOIers = nextOIers;
    this.committedRecords = nextRecords;
  }

  private async publish(): Promise<void> {
    const schools = buildSchools(this.staticData, this.aggregates.schoolAwardCounts);
    const contests: DbContest[] = this.staticData.contests.map(contest => ({
      ...contest,
      length: this.aggregates.contestLengths.get(contest.id) ?? 0,
      levelCounts: this.aggregates.contestLevelCounts.get(contest.id) ?? {},
    }));
    const enrollMiddleYears = [...this.aggregates.enrollMiddleYears].sort((a, b) => a - b);

    await this.db.transaction(
      'rw',
      this.db.schools,
      this.db.contests,
      this.db.meta,
      this.db.loaderState,
      async () => {
        await Promise.all([this.db.schools.clear(), this.db.contests.clear(), this.db.meta.clear()]);
        await Promise.all([
          this.db.schools.bulkAdd(schools),
          this.db.contests.bulkAdd(contests),
        ]);
        await this.db.meta.bulkPut([
          { key: 'provinces', value: [...provinces] },
          { key: 'enrollMiddleYears', value: enrollMiddleYears },
          { key: 'contestTypes', value: [...contestTypes] },
          { key: 'awards', value: [...awards] },
          { key: 'oierCount', value: this.committedOIers },
          { key: 'version', value: this.targetVersion },
        ]);
        await this.db.loaderState.clear();
        // 事务内抛出，中止时整体回滚
        throwIfAborted(this.signal);
      }
    );
  }

  private emitProgress(phase: IDBLoadProgress['phase']): void {
    this.onProgress?.({
      phase,
      parsedOIers: this.parser.count,
      committedOIers: this.committedOIers,
      committedRecords: this.committedRecords,
      resumeOffset: this.resumeOffset,
    });
  }

  private close(): void {
    if (this.closed) return;

    this.closed = true;
    this.bufferedOIers = [];
    this.bufferedProvinces = [];
    this.bufferedRecords = [];

    this.onClose();
  }
}

async function resetForLoad(db: OIerDbDexie, version: string): Promise<LoaderCheckpoint> {
  await db.transaction(
    'rw',
    [db.oiers, db.oierProvinces, db.schools, db.contests, db.recordEntries, db.meta, db.loaderState],
    async () => {
      await Promise.all([
        db.oiers.clear(),
        db.oierProvinces.clear(),
        db.schools.clear(),
        db.contests.clear(),
        db.recordEntries.clear(),
        db.meta.clear(),
        db.loaderState.clear(),
      ]);
      await db.loaderState.bulkAdd([
        { key: TARGET_VERSION_KEY, value: version },
        { key: COMMITTED_OIERS_KEY, value: 0 },
        { key: COMMITTED_RECORDS_KEY, value: 0 },
      ]);
    }
  );

  return { committedOIers: 0, committedRecords: 0 };
}

function buildSchools(
  data: ParsedStatic,
  counts: Map<number, Record<number, number>>
): DbSchool[] {
  const sorted = [...data.schools]
    .sort((a, b) => b.score === a.score ? a.id - b.id : b.score - a.score);
  let lastScore = NaN;
  let lastRank = 0;

  return sorted.map((school, index) => {
    const rank = school.score === lastScore ? lastRank : index;
    lastScore = school.score;
    lastRank = rank;
    return { ...school, rank, awardCounts: counts.get(school.id) ?? {} };
  });
}
