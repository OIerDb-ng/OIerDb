import { parseInfo, parseStatic, ResultParser } from '@oierdb/parser';
import type { DataInfo, ParsedStatic } from '@oierdb/parser';
import { trackEvent } from '@/libs/plausible';
import promiseAny from '@/utils/promiseAny';
import { OIerDbDataBuilder } from './OIerDbDataBuilder';
import type { OIerDbData } from './OIerDbDataBuilder';
import { beginResultCacheWrite, clearResultCache, readResultCache } from './OIerDbCache';
import type { ResultCacheVersion, ResultChunkCacheWriter } from './OIerDbCache';

export { Contest, OIer, OIerDbDataBuilder, School } from './OIerDbDataBuilder';
export type { OIerDbData, Record } from './OIerDbDataBuilder';

const infoUrls = [
  // 'http://localhost:30002',
  'https://oier.api.baoshuo.dev',
];

const urls = [
  // 'http://localhost:30002',
  'https://cos-1.cdn.baoshuo.xyz/oier',
  'https://oier.api.baoshuo.dev',
];

let __DATA__: OIerDbData = null;

interface DownloadOptions {
  onProgress?: (receivedBytes: number) => void;
  onAttemptStart?: () => void | Promise<void>;
  trackLabel?: string;
}

interface StreamDownloadOptions extends DownloadOptions {
  onChunk: (chunk: Uint8Array) => void | Promise<void>;
}

const trackDownload = (
  label: string | undefined,
  url: string,
  startTime: number,
  processTime: number
) => {
  if (!label) return;

  const timeUsed = performance.now() - startTime - processTime;
  trackEvent('Download: ' + label, {
    props: {
      url,
      time:
        timeUsed < 100
          ? Math.floor(timeUsed / 25) * 25
          : Math.floor(timeUsed / 100) * 100,
    },
  });
};

const getTextData = async (
  sources: string | string[],
  options: DownloadOptions
): Promise<string> => {
  const startTime = performance.now();
  const sourceList = Array.isArray(sources) ? sources : [sources];

  for (const url of sourceList) {
    try {
      await options.onAttemptStart?.();

      const response = await fetch(url);
      if (!response.ok || !response.body) continue;

      let receivedSize = 0;
      const decoder = new TextDecoder();
      const buffered: string[] = [];
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedSize += value.byteLength;
        buffered.push(decoder.decode(value, { stream: true }));
        options.onProgress?.(receivedSize);
      }

      const rest = decoder.decode();
      if (rest) buffered.push(rest);
      trackDownload(options.trackLabel, url, startTime, 0);
      return buffered.join('');
    } catch (error) {
      console.error(error);
    }
  }

  throw new Error('Failed to fetch data');
};

const streamData = async (
  sources: string | string[],
  options: StreamDownloadOptions
): Promise<void> => {
  const startTime = performance.now();
  const sourceList = Array.isArray(sources) ? sources : [sources];

  for (const url of sourceList) {
    try {
      await options.onAttemptStart?.();

      const response = await fetch(url);
      if (!response.ok || !response.body) continue;

      let receivedSize = 0;
      let chunkProcessTime = 0;
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedSize += value.byteLength;

        const processStartTime = performance.now();
        await options.onChunk(value);
        chunkProcessTime += performance.now() - processStartTime;
        options.onProgress?.(receivedSize);
      }

      trackDownload(options.trackLabel, url, startTime, chunkProcessTime);
      return;
    } catch (error) {
      console.error(error);
    }
  }

  throw new Error('Failed to fetch data');
};

const abortCacheWriter = async (writer: ResultChunkCacheWriter | null) => {
  if (!writer) return;
  try {
    await writer.abort();
  } catch (error) {
    console.error('Failed to abort result cache write:', error);
  }
};

const tryReadCachedData = async (
  version: ResultCacheVersion,
  setProgressPercent: (p: number) => void
): Promise<OIerDbData | null> => {
  try {
    const cached = await readResultCache(version);
    if (!cached) return null;

    const parser = new ResultParser();
    const builder = new OIerDbDataBuilder(cached.staticData);
    let processedBytes = 0;

    setProgressPercent(91);
    for await (const chunk of cached.chunks) {
      builder.push(parser.push(chunk));
      processedBytes += chunk.byteLength;
      if (cached.manifest.byteCount) {
        setProgressPercent(91 + Math.floor((processedBytes / cached.manifest.byteCount) * 8));
      }
    }
    builder.push(parser.finish());

    const data = builder.finish();
    setProgressPercent(100);
    return data;
  } catch (error) {
    console.error('Failed to read cached result data:', error);
    try {
      await clearResultCache();
    } catch (clearError) {
      console.error('Failed to clear invalid result cache:', clearError);
    }
    return null;
  }
};

const downloadAndBuildData = async (
  staticInfo: DataInfo,
  resultInfo: DataInfo,
  setProgressPercent: (p: number) => void
): Promise<OIerDbData> => {
  const version: ResultCacheVersion = {
    staticSha512: staticInfo.sha512,
    resultSha512: resultInfo.sha512,
  };
  const received = {
    static: 0,
    result: 0,
  };
  const totalSize = staticInfo.size + resultInfo.size;
  const reportProgress = () => {
    const receivedSize = Math.min(received.static + received.result, totalSize);
    const progress = totalSize
      ? 4 + Math.floor((receivedSize / totalSize) * 86)
      : 90;
    setProgressPercent(progress);
  };

  const staticPromise: Promise<ParsedStatic> = getTextData(
    urls.map(url => `${url}/static.${staticInfo.sha512.substring(0, 7)}.json`),
    {
      onProgress: (receivedBytes) => {
        received.static = receivedBytes;
        reportProgress();
      },
      onAttemptStart: () => {
        received.static = 0;
        reportProgress();
      },
      trackLabel: 'static.json',
    }
  ).then(parseStatic);

  let parser = new ResultParser();
  let builderPromise = staticPromise.then(staticData => new OIerDbDataBuilder(staticData));
  let cacheWriter: ResultChunkCacheWriter | null = null;

  try {
    await streamData(
      urls.map(url => `${url}/result.${resultInfo.sha512.substring(0, 7)}.txt`),
      {
        onProgress: (receivedBytes) => {
          received.result = receivedBytes;
          reportProgress();
        },
        onAttemptStart: async () => {
          await abortCacheWriter(cacheWriter);
          cacheWriter = null;
          parser = new ResultParser();
          builderPromise = staticPromise.then(staticData => new OIerDbDataBuilder(staticData));
          received.result = 0;
          reportProgress();

          try {
            cacheWriter = await beginResultCacheWrite(version);
          } catch (error) {
            console.error('Failed to initialize result cache:', error);
          }
        },
        onChunk: async (chunk) => {
          if (cacheWriter) {
            try {
              await cacheWriter.append(chunk);
            } catch (error) {
              console.error('Failed to cache result chunk:', error);
              await abortCacheWriter(cacheWriter);
              cacheWriter = null;
            }
          }

          const builder = await builderPromise;
          builder.push(parser.push(chunk));
        },
        trackLabel: 'result.txt',
      }
    );

    const [staticData, builder] = await Promise.all([staticPromise, builderPromise]);
    builder.push(parser.finish());

    if (cacheWriter) {
      try {
        await cacheWriter.commit(staticData);
        cacheWriter = null;
      } catch (error) {
        console.error('Failed to commit result cache:', error);
        await abortCacheWriter(cacheWriter);
        cacheWriter = null;
      }
    }

    const data = builder.finish();
    setProgressPercent(100);
    return data;
  } catch (error) {
    await abortCacheWriter(cacheWriter);
    throw error;
  }
};

export const initDb = async (setProgressPercent?: (p: number) => void) => {
  if (__DATA__) return __DATA__;

  const updateProgress = setProgressPercent ?? (() => {});
  const [staticInfo, resultInfo]: DataInfo[] = await Promise.all([
    promiseAny(
      infoUrls.map(url => fetch(`${url}/static.info.json?_=${+new Date()}`))
    ).then(res => res.text()).then(parseInfo),
    promiseAny(
      infoUrls.map(url => fetch(`${url}/result.info.json?_=${+new Date()}`))
    ).then(res => res.text()).then(parseInfo),
  ]);

  updateProgress(4);
  const version: ResultCacheVersion = {
    staticSha512: staticInfo.sha512,
    resultSha512: resultInfo.sha512,
  };
  const cached = await tryReadCachedData(version, updateProgress);
  if (cached) return (__DATA__ = cached);

  return (__DATA__ = await downloadAndBuildData(staticInfo, resultInfo, updateProgress));
};

// 展示用常量统一来自 @oierdb/core，保持原有的导出名不变
export { awardColors, contestTypes, provinces } from '@oierdb/core/constants';
export { awards as awardLevels } from '@oierdb/core/constants';
export { provincesIdMap as provincesWithId } from '@oierdb/core/constants';

// 性别（与数据解析无关的展示常量）
export const genders = {
  [-1]: '女',
  1: '男',
  0: '不详',
};

export const gendersKeys = [-1, 0, 1];

export const searchableGenderKeys = [-1, 1];
