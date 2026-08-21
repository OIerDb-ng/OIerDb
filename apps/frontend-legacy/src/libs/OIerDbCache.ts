import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { ParsedStatic } from '@oierdb/parser';

const DATABASE_NAME = 'OIerDb';
const DATABASE_VERSION = 3;
const MAIN_STORE = 'main';
const RESULT_CHUNKS_STORE = 'result-chunks';
const STATIC_DATA_KEY = 'parsed-static';
const LEGACY_RESULT_KEY = 'parsed-oiers';
const RESULT_MANIFEST_KEY = 'result-manifest';

export interface ResultCacheVersion {
  staticSha512: string;
  resultSha512: string;
}

export interface ResultCacheManifest extends ResultCacheVersion {
  chunkCount: number;
  byteCount: number;
}

export interface CachedResult {
  staticData: ParsedStatic;
  manifest: ResultCacheManifest;
  chunks: AsyncIterable<Uint8Array>;
}

const openDatabase = () => openDB(DATABASE_NAME, DATABASE_VERSION, {
  upgrade(db, _oldVersion, _newVersion, transaction) {
    if (!db.objectStoreNames.contains(MAIN_STORE)) db.createObjectStore(MAIN_STORE);
    if (!db.objectStoreNames.contains(RESULT_CHUNKS_STORE)) db.createObjectStore(RESULT_CHUNKS_STORE);
    transaction.objectStore(MAIN_STORE).delete(LEGACY_RESULT_KEY);
  },
});

const isManifest = (value: unknown): value is ResultCacheManifest => {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as Partial<ResultCacheManifest>;
  return typeof manifest.staticSha512 === 'string'
    && typeof manifest.resultSha512 === 'string'
    && Number.isSafeInteger(manifest.chunkCount)
    && (manifest.chunkCount ?? -1) >= 0
    && Number.isSafeInteger(manifest.byteCount)
    && (manifest.byteCount ?? -1) >= 0;
};

const clearResultStores = async (db: IDBPDatabase<unknown>) => {
  const transaction = db.transaction([MAIN_STORE, RESULT_CHUNKS_STORE], 'readwrite');
  transaction.objectStore(MAIN_STORE).delete(RESULT_MANIFEST_KEY);
  transaction.objectStore(MAIN_STORE).delete(LEGACY_RESULT_KEY);
  transaction.objectStore(RESULT_CHUNKS_STORE).clear();
  await transaction.done;
};

export class ResultChunkCacheWriter {
  private chunkCount = 0;
  private byteCount = 0;
  private closed = false;

  constructor(
    private readonly db: IDBPDatabase<unknown>,
    private readonly version: ResultCacheVersion
  ) {}

  async append(chunk: Uint8Array): Promise<void> {
    this.assertOpen();
    const transaction = this.db.transaction(RESULT_CHUNKS_STORE, 'readwrite');
    transaction.objectStore(RESULT_CHUNKS_STORE).put(chunk, this.chunkCount);
    await transaction.done;
    this.chunkCount += 1;
    this.byteCount += chunk.byteLength;
  }

  async commit(staticData: ParsedStatic): Promise<void> {
    this.assertOpen();
    const manifest: ResultCacheManifest = {
      ...this.version,
      chunkCount: this.chunkCount,
      byteCount: this.byteCount,
    };
    const transaction = this.db.transaction(MAIN_STORE, 'readwrite');
    const store = transaction.objectStore(MAIN_STORE);
    store.put(staticData, STATIC_DATA_KEY);
    store.put(manifest, RESULT_MANIFEST_KEY);
    await transaction.done;
    this.close();
  }

  async abort(): Promise<void> {
    if (this.closed) return;
    try {
      await clearResultStores(this.db);
    } finally {
      this.close();
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Result chunk cache writer is closed');
  }

  private close(): void {
    this.closed = true;
    this.db.close();
  }
}

export async function beginResultCacheWrite(version: ResultCacheVersion): Promise<ResultChunkCacheWriter> {
  const db = await openDatabase();
  try {
    await clearResultStores(db);
    return new ResultChunkCacheWriter(db, version);
  } catch (error) {
    db.close();
    throw error;
  }
}

export async function clearResultCache(): Promise<void> {
  const db = await openDatabase();
  try {
    await clearResultStores(db);
  } finally {
    db.close();
  }
}

export async function readResultCache(expected: ResultCacheVersion): Promise<CachedResult | null> {
  const db = await openDatabase();
  const transaction = db.transaction(MAIN_STORE);
  const store = transaction.objectStore(MAIN_STORE);
  const [staticData, manifest] = await Promise.all([
    store.get(STATIC_DATA_KEY),
    store.get(RESULT_MANIFEST_KEY),
    transaction.done,
  ]);

  if (!staticData || !isManifest(manifest)
    || manifest.staticSha512 !== expected.staticSha512
    || manifest.resultSha512 !== expected.resultSha512) {
    db.close();
    return null;
  }

  const chunks = async function* (): AsyncGenerator<Uint8Array> {
    let byteCount = 0;
    try {
      for (let index = 0; index < manifest.chunkCount; index += 1) {
        const chunk = await db.get(RESULT_CHUNKS_STORE, index);
        if (!(chunk instanceof Uint8Array)) {
          throw new Error(`Result cache chunk ${index} is missing or invalid`);
        }
        byteCount += chunk.byteLength;
        yield chunk;
      }
      if (byteCount !== manifest.byteCount) {
        throw new Error('Result cache byte count does not match its manifest');
      }
    } finally {
      db.close();
    }
  };

  return {
    staticData: staticData as ParsedStatic,
    manifest,
    chunks: chunks(),
  };
}
